const { AppError } = require('../exceptions/AppError');
const { Roles } = require('../models/constants');
const { withRequestAuditContext } = require('../utils/requestAuditContext');

const ATTENDANCE_STATUSES = new Set(['present', 'late', 'absent']);
const SEAT_STATUSES = new Set(['active', 'trial']);
const ENROLLMENT_STATUSES = new Set(['active', 'waitlisted', 'trial', 'frozen', 'withdrawn', 'completed']);
const TERMINAL_ENROLLMENT_EPISODE_STATUSES = new Set(['withdrawn', 'completed']);
const DIRECTOR_ROLES = new Set([Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR]);
const ENROLLMENT_TRANSITIONS = Object.freeze({
  active:new Set(['frozen', 'withdrawn', 'completed']),
  trial:new Set(['active', 'waitlisted', 'withdrawn', 'completed']),
  waitlisted:new Set(['active', 'trial', 'withdrawn']),
  frozen:new Set(['active', 'withdrawn']),
  withdrawn:new Set(),
  completed:new Set(),
});

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(value = new Date()) {
  const date = asDate(value);
  return date ? date.toISOString() : null;
}

function enrollmentCoversSession(enrollment, session) {
  if (!enrollment || !session || enrollment.status === 'waitlisted') return false;
  const sessionDate = asDate(session.startsAt || session.starts_at);
  const startsAt = asDate(enrollment.startsAt || enrollment.starts_at || enrollment.enrolledAt || enrollment.enrolled_at);
  const endsValue = enrollment.endsAt || enrollment.ends_at;
  const endsAt = endsValue ? asDate(endsValue) : null;
  if (!sessionDate || !startsAt || sessionDate < startsAt || (endsAt && sessionDate >= endsAt)) return false;
  if (SEAT_STATUSES.has(enrollment.status)) return true;
  return ['frozen', 'withdrawn', 'completed'].includes(enrollment.status) && Boolean(endsAt);
}

function newestEnrollment(enrollments) {
  return [...enrollments].sort((left, right) => {
    const leftDate = asDate(left.startsAt || left.enrolledAt || left.createdAt)?.getTime() || 0;
    const rightDate = asDate(right.startsAt || right.enrolledAt || right.createdAt)?.getTime() || 0;
    return rightDate - leftDate;
  })[0] || null;
}

function enrollmentForSession(enrollments, session) {
  const covering = enrollments.filter((enrollment) => enrollmentCoversSession(enrollment, session));
  if (covering.length) return newestEnrollment(covering);
  const sessionDate = asDate(session?.startsAt || session?.starts_at);
  if (!sessionDate) return newestEnrollment(enrollments);
  const preceding = enrollments.filter((enrollment) => {
    const startsAt = asDate(enrollment.startsAt || enrollment.enrolledAt || enrollment.createdAt);
    return startsAt && startsAt <= sessionDate;
  });
  return newestEnrollment(preceding) || newestEnrollment(enrollments);
}

class AttendanceService {
  constructor(db, audit, accessPolicy = null, cacheService = null) {
    this.db = db;
    this.audit = audit;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
  }

  async inTransaction(work) {
    return this.db.transaction ? this.db.transaction(work) : work(this.db);
  }

  async auditWith(db, actorUserId, action, entity, entityId, metadata = {}) {
    return db.auditLogs.create({ actorUserId, action, entity, entityId, metadata:withRequestAuditContext(metadata) });
  }

  async invalidateJustifications(db, actorUserId, attendanceRecord, nextStatus, reviewedAt) {
    if (!attendanceRecord || attendanceRecord.status !== 'absent' || nextStatus === 'absent') return [];
    const active = (await db.absenceJustifications.all()).filter((row) => (
      row.attendanceRecordId === attendanceRecord.id && ['pending', 'approved'].includes(row.status)
    ));
    const invalidated = [];
    for (const justification of active) {
      const automaticNote = 'Automatically rejected because the attendance record was corrected from absent.';
      invalidated.push(await db.absenceJustifications.update(justification.id, {
        status:'rejected',
        reviewedBy:actorUserId,
        reviewedAt,
        reviewNotes:[justification.reviewNotes, automaticNote].filter(Boolean).join(' '),
      }));
    }
    return invalidated;
  }

  invalidateAttendanceCaches(extraTags = []) {
    if (this.cacheService) {
      this.cacheService.invalidateTags(['attendance', 'class-sessions', 'class-groups', 'class-group-enrollments', 'reports', ...extraTags]);
    }
  }

  assertValidWindow(from, to) {
    if (from && !asDate(from)) throw new AppError('Invalid from date', 422);
    if (to && !asDate(to)) throw new AppError('Invalid to date', 422);
    if (from && to && asDate(from) > asDate(to)) throw new AppError('from date must be before to date', 422);
  }

  assertAttendanceStatus(status) {
    if (!ATTENDANCE_STATUSES.has(status)) {
      throw new AppError('Attendance status must be present, late or absent', 422, { code:'INVALID_ATTENDANCE_STATUS' });
    }
  }

  assertEnrollmentDates(startsAt, endsAt) {
    const start = asDate(startsAt);
    const end = endsAt ? asDate(endsAt) : null;
    if (!start || (endsAt && !end)) throw new AppError('Invalid enrollment dates', 422);
    if (end && end < start) throw new AppError('Enrollment end must not be before its start', 422, { code:'INVALID_ENROLLMENT_WINDOW' });
  }

  async assertEnrollmentEpisodeDoesNotOverlap(db, studentId, classGroupId, startsAt, endsAt, excludedId = null) {
    const start = asDate(startsAt);
    const end = endsAt ? asDate(endsAt) : null;
    const overlaps = (await this.enrollmentsByStudentAndGroup(db, studentId, classGroupId)).filter((episode) => {
      if (episode.id === excludedId) return false;
      const episodeStart = asDate(episode.startsAt || episode.enrolledAt || episode.createdAt);
      const episodeEnd = episode.endsAt ? asDate(episode.endsAt) : null;
      if (!episodeStart) return true;
      return (!episodeEnd || start < episodeEnd) && (!end || episodeStart < end);
    });
    if (overlaps.length) {
      throw new AppError('Enrollment episodes for the same student and class group cannot overlap', 409, {
        code:'ENROLLMENT_EPISODE_OVERLAP',
        enrollmentIds:overlaps.map((episode) => episode.id),
      });
    }
  }

  async enrollmentsByStudentAndGroup(db, studentId, classGroupId) {
    return (await db.classGroupEnrollments.all())
      .filter((row) => row.studentId === studentId && row.classGroupId === classGroupId);
  }

  async assertEnrollmentReferences(db, studentId, classGroupId, requireActive = true) {
    const student = await db.students.findById(studentId);
    if (!student) throw new AppError('Student not found', 404);
    const classGroup = await db.classGroups.findById(classGroupId);
    if (!classGroup) throw new AppError('Class group not found', 404);
    if (student.branchId !== classGroup.branchId) {
      throw new AppError('Student and class group must belong to the same branch', 422, { code:'ENROLLMENT_BRANCH_MISMATCH' });
    }
    if (classGroup.level && student.level !== classGroup.level) {
      throw new AppError('Student and class group must have the same level', 422, { code:'ENROLLMENT_LEVEL_MISMATCH' });
    }
    if (requireActive && (student.active === false || classGroup.active === false)) {
      throw new AppError('Only active students and class groups can occupy a seat', 422, { code:'INACTIVE_ENROLLMENT_RESOURCE' });
    }
    return { student, classGroup };
  }

  async availableEnrollmentStatus(db, classGroup, requestedStatus, excludedEnrollmentId = null) {
    if (!SEAT_STATUSES.has(requestedStatus)) return requestedStatus;
    const capacity = Number(classGroup.capacity ?? 30);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
      throw new AppError('Class group capacity must be between 1 and 200', 422, { code:'INVALID_CLASS_CAPACITY' });
    }
    const now = new Date();
    const occupied = (await db.classGroupEnrollments.all()).filter((row) => (
      row.classGroupId === classGroup.id
      && row.id !== excludedEnrollmentId
      && SEAT_STATUSES.has(row.status)
      && (!row.endsAt || asDate(row.endsAt) >= now)
    )).length;
    return occupied >= capacity ? 'waitlisted' : requestedStatus;
  }

  async listEnrollments(actor) {
    const rows = await this.db.classGroupEnrollments.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'class-group-enrollments', rows) : rows;
  }

  async createEnrollment(actor, data) {
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(actor, 'class-group-enrollments', data);
    const created = await this.inTransaction(async (db) => {
      const previousEpisodes = await this.enrollmentsByStudentAndGroup(db, data.studentId, data.classGroupId);
      const blockingEpisodes = previousEpisodes.filter((episode) => (
        !TERMINAL_ENROLLMENT_EPISODE_STATUSES.has(episode.status)
      ));
      if (blockingEpisodes.length) {
        throw new AppError('Student already has a current enrollment episode in this class group', 409, {
          code:'ENROLLMENT_EXISTS',
          enrollmentIds:blockingEpisodes.map((episode) => episode.id),
          statuses:[...new Set(blockingEpisodes.map((episode) => episode.status))],
        });
      }
      const requestedStatus = data.status || 'active';
      if (!ENROLLMENT_STATUSES.has(requestedStatus)) throw new AppError('Invalid enrollment status', 422);
      const { classGroup } = await this.assertEnrollmentReferences(db, data.studentId, data.classGroupId, true);
      const now = new Date();
      const startsAt = data.startsAt || now.toISOString();
      const unclosedTerminalEpisodes = previousEpisodes.filter((episode) => !episode.endsAt);
      if (unclosedTerminalEpisodes.length) {
        throw new AppError('Previous terminal enrollment episodes require an end date before re-enrollment', 409, {
          code:'TERMINAL_ENROLLMENT_END_REQUIRED',
          enrollmentIds:unclosedTerminalEpisodes.map((episode) => episode.id),
        });
      }
      let endsAt = data.endsAt || null;
      if (['frozen', 'withdrawn', 'completed'].includes(requestedStatus) && !endsAt) endsAt = now.toISOString();
      if (requestedStatus === 'withdrawn' && !String(data.withdrawalReason || '').trim()) {
        throw new AppError('Withdrawal reason is required', 422, { code:'WITHDRAWAL_REASON_REQUIRED' });
      }
      this.assertEnrollmentDates(startsAt, endsAt);
      await this.assertEnrollmentEpisodeDoesNotOverlap(db, data.studentId, data.classGroupId, startsAt, endsAt);
      const status = await this.availableEnrollmentStatus(db, classGroup, requestedStatus);
      let row;
      try {
        row = await db.classGroupEnrollments.create({
          studentId:data.studentId,
          classGroupId:data.classGroupId,
          status,
          startsAt:iso(startsAt),
          endsAt:endsAt ? iso(endsAt) : null,
          enrolledAt:iso(data.enrolledAt || now),
          withdrawalReason:data.withdrawalReason || null,
          createdBy:actor.id,
          createdAt:now.toISOString(),
          updatedAt:now.toISOString(),
        });
      } catch (error) {
        if (error?.status === 409) {
          throw new AppError('Student already has a current enrollment episode in this class group', 409, {
            code:'ENROLLMENT_EXISTS',
          });
        }
        throw error;
      }
      await this.auditWith(db, actor.id, 'CLASS_GROUP_ENROLLMENT_CREATED', 'class_group_enrollments', row.id, {
        studentId:data.studentId,
        classGroupId:data.classGroupId,
        episodeNumber:previousEpisodes.length + 1,
        previousEnrollmentIds:previousEpisodes.map((episode) => episode.id),
        requestedStatus,
        status,
        waitlistedByCapacity:requestedStatus !== status,
      });
      return row;
    });
    this.invalidateAttendanceCaches(['students']);
    return created;
  }

  assertEnrollmentTransition(from, to) {
    if (from === to) return;
    if (!ENROLLMENT_TRANSITIONS[from]?.has(to)) {
      throw new AppError(`Enrollment cannot transition from ${from} to ${to}`, 409, { code:'INVALID_ENROLLMENT_TRANSITION' });
    }
  }

  async updateEnrollment(actor, id, updates) {
    const existing = await this.db.classGroupEnrollments.findById(id);
    if (!existing) throw new AppError('Class group enrollment not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'class-group-enrollments', existing, updates);

    const updated = await this.inTransaction(async (db) => {
      const current = await db.classGroupEnrollments.findById(id);
      if (!current) throw new AppError('Class group enrollment not found', 404);
      const requestedStatus = updates.status || current.status;
      this.assertEnrollmentTransition(current.status, requestedStatus);
      const { classGroup } = await this.assertEnrollmentReferences(
        db,
        current.studentId,
        current.classGroupId,
        SEAT_STATUSES.has(requestedStatus),
      );
      const now = new Date();
      let startsAt = updates.startsAt || current.startsAt;
      let endsAt = updates.endsAt !== undefined ? updates.endsAt : current.endsAt;
      let withdrawalReason = updates.withdrawalReason !== undefined ? updates.withdrawalReason : current.withdrawalReason;
      const status = await this.availableEnrollmentStatus(db, classGroup, requestedStatus, current.id);
      if (SEAT_STATUSES.has(status) && !SEAT_STATUSES.has(current.status)) {
        startsAt = updates.startsAt || now.toISOString();
        endsAt = null;
      }
      if (['frozen', 'withdrawn', 'completed'].includes(status) && !endsAt) endsAt = now.toISOString();
      if (status === 'withdrawn' && !String(withdrawalReason || '').trim()) {
        throw new AppError('Withdrawal reason is required', 422, { code:'WITHDRAWAL_REASON_REQUIRED' });
      }
      this.assertEnrollmentDates(startsAt, endsAt);
      await this.assertEnrollmentEpisodeDoesNotOverlap(
        db,
        current.studentId,
        current.classGroupId,
        startsAt,
        endsAt,
        current.id,
      );
      const row = await db.classGroupEnrollments.update(id, {
        status,
        startsAt:iso(startsAt),
        endsAt:endsAt ? iso(endsAt) : null,
        withdrawalReason:withdrawalReason || null,
        updatedAt:now.toISOString(),
      });
      await this.auditWith(db, actor.id, 'CLASS_GROUP_ENROLLMENT_UPDATED', 'class_group_enrollments', id, {
        before:{ status:current.status, startsAt:current.startsAt, endsAt:current.endsAt },
        after:{ status:row.status, startsAt:row.startsAt, endsAt:row.endsAt },
        requestedStatus,
        waitlistedByCapacity:requestedStatus !== status,
      });
      return row;
    });
    this.invalidateAttendanceCaches(['students']);
    return updated;
  }

  async buildRoster(db, session) {
    const classGroup = await db.classGroups.findById(session.classGroupId);
    if (!classGroup) throw new AppError('Class group not found', 404);
    const groupEnrollments = (await db.classGroupEnrollments.all()).filter((enrollment) => (
      enrollment.classGroupId === classGroup.id
    ));
    const enrollments = groupEnrollments.filter((enrollment) => enrollmentCoversSession(enrollment, session));
    const enrollmentEpisodesByStudent = new Map();
    for (const enrollment of groupEnrollments) {
      const episodes = enrollmentEpisodesByStudent.get(enrollment.studentId) || [];
      episodes.push(enrollment);
      enrollmentEpisodesByStudent.set(enrollment.studentId, episodes);
    }
    const enrollmentByStudent = new Map(
      [...enrollmentEpisodesByStudent.entries()]
        .map(([studentId, episodes]) => [studentId, enrollmentForSession(episodes, session)]),
    );
    const students = await db.students.all();
    const studentsById = new Map(students.map((student) => [student.id, student]));
    const attendanceRows = (await db.studentAttendance.all()).filter((row) => row.classSessionId === session.id);
    const attendanceByStudent = new Map(attendanceRows.map((row) => [row.studentId, row]));
    const rosterStudentIds = new Set(enrollments
      .filter((enrollment) => {
        const student = studentsById.get(enrollment.studentId);
        return Boolean(
          student
          && student.active !== false
          && student.branchId === classGroup.branchId
          && (!classGroup.level || student.level === classGroup.level)
        );
      })
      .map((enrollment) => enrollment.studentId));
    for (const attendance of attendanceRows) {
      const linkedEnrollment = enrollmentByStudent.get(attendance.studentId);
      if ((session.attendanceState || 'draft') === 'finalized' || enrollmentCoversSession(linkedEnrollment, session)) {
        rosterStudentIds.add(attendance.studentId);
      }
    }
    const roster = [...rosterStudentIds]
      .map((studentId) => ({
        enrollment:enrollmentByStudent.get(studentId) || null,
        student:studentsById.get(studentId),
        attendance:attendanceByStudent.get(studentId) || null,
      }))
      .filter((row) => row.student)
      .sort((left, right) => String(left.student.fullName || '').localeCompare(String(right.student.fullName || '')));
    return { classGroup, roster };
  }

  async getSessionRoster(actor, sessionId) {
    const session = await this.db.classSessions.findById(sessionId);
    if (!session) throw new AppError('Class session not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanRead(actor, 'class-sessions', session);
    const { classGroup, roster } = await this.buildRoster(this.db, session);
    return { session, classGroup, attendanceState:session.attendanceState || 'draft', roster };
  }

  assertSessionAcceptsAttendance(session, classGroup) {
    if (session.status === 'cancelled') {
      throw new AppError('Attendance cannot be recorded for a cancelled session', 409, { code:'SESSION_CANCELLED' });
    }
    const startsAt = asDate(session.startsAt || session.starts_at);
    if (!startsAt) throw new AppError('Class session has an invalid start date', 422);
    if (startsAt > new Date()) {
      throw new AppError('Attendance cannot be recorded before the class starts', 422, { code:'SESSION_NOT_STARTED' });
    }
    if (!classGroup || classGroup.active === false) {
      throw new AppError('Attendance cannot be recorded for an inactive class group', 422, { code:'CLASS_GROUP_INACTIVE' });
    }
  }

  assertSessionHasEnded(session) {
    const endsAt = asDate(session.endsAt || session.ends_at);
    if (!endsAt) throw new AppError('Class session has an invalid end date', 422, { code:'INVALID_SESSION_END' });
    if (endsAt > new Date()) {
      throw new AppError('Attendance cannot be finalized or corrected before the class ends', 422, {
        code:'SESSION_NOT_ENDED',
      });
    }
  }

  validateBatchRecords(records) {
    const ids = new Set();
    for (const record of records) {
      this.assertAttendanceStatus(record.status);
      if (ids.has(record.studentId)) throw new AppError('Attendance batch contains duplicate students', 422, { code:'DUPLICATE_BATCH_STUDENT' });
      ids.add(record.studentId);
    }
    return ids;
  }

  async recordSessionAttendance(actor, sessionId, data) {
    const initialSession = await this.db.classSessions.findById(sessionId);
    if (!initialSession) throw new AppError('Class session not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanRead(actor, 'class-sessions', initialSession);
    const desiredState = data.state || 'draft';
    if (!['draft', 'finalized'].includes(desiredState)) {
      throw new AppError('Attendance state must be draft or finalized', 422, { code:'INVALID_ATTENDANCE_STATE' });
    }
    const submittedIds = this.validateBatchRecords(data.records || []);

    const result = await this.inTransaction(async (db) => {
      const session = await db.classSessions.findById(sessionId);
      if (!session) throw new AppError('Class session not found', 404);
      const { classGroup, roster } = await this.buildRoster(db, session);
      this.assertSessionAcceptsAttendance(session, classGroup);
      if (desiredState === 'finalized') this.assertSessionHasEnded(session);
      const rosterIds = new Set(roster.map((row) => row.student.id));
      for (const studentId of submittedIds) {
        if (!rosterIds.has(studentId)) {
          throw new AppError('Attendance contains a student outside the session roster', 422, { code:'STUDENT_NOT_IN_ROSTER', studentId });
        }
      }
      if (desiredState === 'finalized' && (submittedIds.size !== rosterIds.size || [...rosterIds].some((id) => !submittedIds.has(id)))) {
        throw new AppError('Final attendance must contain the exact active session roster', 422, {
          code:'INCOMPLETE_FINAL_ROSTER',
          expectedStudentIds:[...rosterIds],
          receivedStudentIds:[...submittedIds],
        });
      }

      const existingRows = (await db.studentAttendance.all()).filter((row) => row.classSessionId === session.id);
      const existingByStudent = new Map(existingRows.map((row) => [row.studentId, row]));
      const changes = [];
      for (const record of data.records || []) {
        const existing = existingByStudent.get(record.studentId);
        const nextNotes = record.notes === undefined ? existing?.notes : record.notes;
        if (!existing || existing.status !== record.status || (record.notes !== undefined && existing.notes !== nextNotes)) {
          changes.push({ record, existing, nextNotes });
        }
      }

      const alreadyFinalized = (session.attendanceState || 'draft') === 'finalized';
      if (alreadyFinalized && desiredState !== 'finalized') {
        throw new AppError('Finalized attendance cannot return to draft', 409, { code:'ATTENDANCE_ALREADY_FINALIZED' });
      }
      if (alreadyFinalized && changes.length) {
        if (!DIRECTOR_ROLES.has(actor.role)) {
          throw new AppError('Only a director can correct finalized attendance', 403, { code:'FINAL_ATTENDANCE_DIRECTOR_REQUIRED' });
        }
        if (String(data.correctionReason || '').trim().length < 5) {
          throw new AppError('A correction reason is required after attendance is finalized', 422, { code:'CORRECTION_REASON_REQUIRED' });
        }
      }

      if (alreadyFinalized && !changes.length) {
        return { session, attendanceState:'finalized', records:existingRows, idempotent:true };
      }

      const persisted = [];
      const invalidatedJustificationIds = [];
      const now = new Date().toISOString();
      for (const { record, existing, nextNotes } of changes) {
        if (existing) {
          const invalidated = await this.invalidateJustifications(db, actor.id, existing, record.status, now);
          invalidatedJustificationIds.push(...invalidated.map((row) => row.id));
          persisted.push(await db.studentAttendance.update(existing.id, {
            status:record.status,
            notes:nextNotes,
            updatedBy:actor.id,
            correctionReason:alreadyFinalized ? String(data.correctionReason).trim() : null,
            version:Number(existing.version || 1) + 1,
            updatedAt:now,
          }));
        } else {
          persisted.push(await db.studentAttendance.create({
            studentId:record.studentId,
            classSessionId:session.id,
            status:record.status,
            notes:record.notes,
            recordedBy:actor.id,
            updatedBy:actor.id,
            correctionReason:alreadyFinalized ? String(data.correctionReason).trim() : null,
            version:1,
            createdAt:now,
            updatedAt:now,
          }));
        }
      }

      const updatedSession = await db.classSessions.update(session.id, {
        attendanceState:desiredState,
        ...(desiredState === 'finalized' ? {
          status:'completed',
          attendanceFinalizedAt:session.attendanceFinalizedAt || now,
          attendanceFinalizedBy:session.attendanceFinalizedBy || actor.id,
          completedAt:session.completedAt || now,
          completedBy:session.completedBy || actor.id,
        } : {}),
      });
      await this.auditWith(
        db,
        actor.id,
        alreadyFinalized ? 'STUDENT_ATTENDANCE_CORRECTED' : desiredState === 'finalized' ? 'SESSION_ATTENDANCE_FINALIZED' : 'SESSION_ATTENDANCE_DRAFT_SAVED',
        'class_sessions',
        session.id,
        {
          state:desiredState,
          changedStudentIds:changes.map(({ record }) => record.studentId),
          invalidatedJustificationIds,
          correctionReason:alreadyFinalized ? String(data.correctionReason).trim() : null,
        },
      );
      const finalRows = (await db.studentAttendance.all()).filter((row) => row.classSessionId === session.id);
      return { session:updatedSession, attendanceState:desiredState, records:finalRows, changedRecords:persisted };
    });

    this.invalidateAttendanceCaches();
    return result;
  }

  async recordStudentAttendance(actor, data) {
    this.assertAttendanceStatus(data.status);
    const student = await this.db.students.findById(data.studentId);
    if (!student) throw new AppError('Student not found', 404);
    if (student.active === false) throw new AppError('Attendance cannot be recorded for an inactive student', 422, { code:'STUDENT_INACTIVE' });
    const session = await this.db.classSessions.findById(data.classSessionId);
    if (!session) throw new AppError('Class session not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(actor, 'student-attendance', data);

    const record = await this.inTransaction(async (db) => {
      const currentSession = await db.classSessions.findById(data.classSessionId);
      const { classGroup, roster } = await this.buildRoster(db, currentSession);
      this.assertSessionAcceptsAttendance(currentSession, classGroup);
      if (!roster.some((row) => row.student.id === data.studentId)) {
        throw new AppError('Student is not in the class session roster', 422, { code:'STUDENT_NOT_IN_ROSTER' });
      }
      const existing = await db.studentAttendance.findByFields({ studentId:data.studentId, classSessionId:data.classSessionId });
      const isFinalized = (currentSession.attendanceState || 'draft') === 'finalized';
      if (existing && !isFinalized) throw new AppError('Attendance already recorded for this student and session', 409);
      if (isFinalized) {
        this.assertSessionHasEnded(currentSession);
        if (!existing) throw new AppError('Finalized roster is inconsistent', 409, { code:'FINAL_ROSTER_INCONSISTENT' });
        if (existing.status === data.status && (data.notes === undefined || existing.notes === data.notes)) {
          throw new AppError('Attendance already recorded for this student and session', 409);
        }
        if (!DIRECTOR_ROLES.has(actor.role)) throw new AppError('Only a director can correct finalized attendance', 403);
        if (String(data.correctionReason || '').trim().length < 5) throw new AppError('Correction reason is required', 422);
        const now = new Date().toISOString();
        const invalidated = await this.invalidateJustifications(db, actor.id, existing, data.status, now);
        const updated = await db.studentAttendance.update(existing.id, {
          status:data.status,
          notes:data.notes === undefined ? existing.notes : data.notes,
          updatedBy:actor.id,
          correctionReason:String(data.correctionReason).trim(),
          version:Number(existing.version || 1) + 1,
          updatedAt:now,
        });
        await this.auditWith(db, actor.id, 'STUDENT_ATTENDANCE_CORRECTED', 'student_attendance_records', updated.id, {
          before:{ status:existing.status, notes:existing.notes },
          after:{ status:updated.status, notes:updated.notes },
          correctionReason:String(data.correctionReason).trim(),
          invalidatedJustificationIds:invalidated.map((row) => row.id),
        });
        return updated;
      }

      const now = new Date().toISOString();
      const created = await db.studentAttendance.create({
        studentId:data.studentId,
        classSessionId:data.classSessionId,
        status:data.status,
        notes:data.notes,
        recordedBy:actor.id,
        updatedBy:actor.id,
        correctionReason:null,
        version:1,
        createdAt:now,
        updatedAt:now,
      });
      await db.classSessions.update(currentSession.id, { attendanceState:'draft' });
      await this.auditWith(db, actor.id, 'STUDENT_ATTENDANCE_RECORDED', 'student_attendance_records', created.id, { status:data.status });
      return created;
    });
    this.invalidateAttendanceCaches();
    return record;
  }

  async listTeacherAttendance(actor) {
    const rows = await this.db.teacherAttendance.all();
    const visible = this.accessPolicy ? await this.accessPolicy.filterList(actor, 'teacher-attendance', rows) : rows;
    return visible.sort((left, right) => new Date(right.checkInAt) - new Date(left.checkInAt));
  }

  async checkInTeacher(actor, data) {
    const teacher = await this.db.teachers.findById(data.teacherId);
    if (!teacher) throw new AppError('Teacher not found', 404);
    if (teacher.active === false) throw new AppError('Inactive teachers cannot check in', 422, { code:'TEACHER_INACTIVE' });
    if (!data.classSessionId) throw new AppError('Class session is required for teacher check-in', 422, { code:'CLASS_SESSION_REQUIRED' });
    const session = await this.db.classSessions.findById(data.classSessionId);
    if (!session) throw new AppError('Class session not found', 404);
    const group = session.classGroupId ? await this.db.classGroups.findById(session.classGroupId) : null;
    if (!group || group.active === false || group.teacherId !== teacher.id || group.branchId !== teacher.branchId) {
      throw new AppError('Teacher is not assigned to this active class session', 403, { code:'TEACHER_SESSION_MISMATCH' });
    }
    if (session.status !== 'scheduled') throw new AppError('Teacher check-in requires a scheduled class session', 409, { code:'SESSION_NOT_SCHEDULED' });
    const now = new Date();
    const windowStart = new Date(new Date(session.startsAt).getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(new Date(session.endsAt).getTime() + 60 * 60 * 1000);
    if (now < windowStart || now > windowEnd) {
      throw new AppError('Teacher check-in is only available from 60 minutes before until 60 minutes after the class', 409, {
        code:'CHECK_IN_OUTSIDE_SESSION_WINDOW',
        windowStart:windowStart.toISOString(),
        windowEnd:windowEnd.toISOString(),
      });
    }
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(actor, 'teacher-attendance', data);

    let record;
    try {
      record = await this.inTransaction(async (db) => {
        const currentTeacher = await db.teachers.findById(data.teacherId);
        if (!currentTeacher || currentTeacher.active === false) {
          throw new AppError('Inactive or missing teachers cannot check in', 422, { code:'TEACHER_INACTIVE' });
        }
        const rows = await db.teacherAttendance.all();
        if (rows.some((row) => row.teacherId === data.teacherId && !row.checkOutAt)) {
          throw new AppError('Teacher already has an open check-in', 409, { code:'OPEN_TEACHER_CHECK_IN' });
        }
        if (rows.some((row) => row.teacherId === data.teacherId && row.classSessionId === data.classSessionId)) {
          throw new AppError('Teacher attendance already exists for this class session', 409, { code:'DUPLICATE_TEACHER_SESSION_ATTENDANCE' });
        }
        const created = await db.teacherAttendance.create({
          ...data,
          checkInAt:new Date().toISOString(),
          checkOutAt:null,
          hourlyRateSnapshot:Number(currentTeacher.hourlyRate ?? 0),
          payableMinutes:null,
        });
        await this.auditWith(db, actor.id, 'TEACHER_CHECK_IN', 'teacher_attendance_records', created.id);
        return created;
      });
    } catch (error) {
      if (error?.code === '23505') throw new AppError('Teacher already has an open check-in', 409, { code:'OPEN_TEACHER_CHECK_IN' });
      throw error;
    }
    if (this.cacheService) this.cacheService.invalidateTags(['teacher-attendance', 'reports']);
    return record;
  }

  async checkOutTeacher(actor, recordId) {
    const record = await this.db.teacherAttendance.findById(recordId);
    if (!record) throw new AppError('Teacher attendance record not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'teacher-attendance', record);
    if (record.checkOutAt) throw new AppError('Teacher attendance record already checked out', 409);

    const updated = await this.inTransaction(async (db) => {
      const current = await db.teacherAttendance.findById(recordId);
      if (!current) throw new AppError('Teacher attendance record not found', 404);
      if (current.checkOutAt) throw new AppError('Teacher attendance record already checked out', 409);
      const checkOutAt = new Date();
      const checkInAt = new Date(current.checkInAt);
      if (checkOutAt < checkInAt) throw new AppError('Teacher check-out cannot precede check-in', 409, { code:'INVALID_TEACHER_ATTENDANCE_WINDOW' });
      const actualMinutes = Math.max(0, Math.round((checkOutAt - checkInAt) / 60000));
      let payableMinutes = Math.min(actualMinutes, 720);
      if (current.classSessionId) {
        const session = await db.classSessions.findById(current.classSessionId);
        if (session) {
          const scheduledMinutes = Math.max(0, Math.round((new Date(session.endsAt) - new Date(session.startsAt)) / 60000));
          payableMinutes = Math.min(actualMinutes, scheduledMinutes + 30, 720);
        }
      }
      const row = await db.teacherAttendance.update(recordId, { checkOutAt:checkOutAt.toISOString(), payableMinutes });
      await this.auditWith(db, actor.id, 'TEACHER_CHECK_OUT', 'teacher_attendance_records', recordId, { actualMinutes, payableMinutes });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['teacher-attendance', 'reports']);
    return updated;
  }

  async attendanceMetrics(studentId, from, to, repository = this.db) {
    this.assertValidWindow(from, to);
    const student = await repository.students.findById(studentId);
    if (!student) throw new AppError('Student not found', 404);
    const enrollments = (await repository.classGroupEnrollments.all()).filter((row) => row.studentId === studentId && row.status !== 'waitlisted');
    const enrollmentsByGroup = new Map();
    for (const enrollment of enrollments) {
      const episodes = enrollmentsByGroup.get(enrollment.classGroupId) || [];
      episodes.push(enrollment);
      enrollmentsByGroup.set(enrollment.classGroupId, episodes);
    }
    const records = (await repository.studentAttendance.all()).filter((row) => row.studentId === studentId);
    const recordsBySession = new Map(records.map((row) => [row.classSessionId, row]));
    const sessions = (await repository.classSessions.all()).filter((session) => {
      if (session.status === 'cancelled' || (session.attendanceState || 'draft') !== 'finalized') return false;
      const episodes = enrollmentsByGroup.get(session.classGroupId) || [];
      if (!episodes.length || (!episodes.some((enrollment) => enrollmentCoversSession(enrollment, session)) && !recordsBySession.has(session.id))) return false;
      const date = asDate(session.startsAt || session.starts_at);
      return date && (!from || date >= asDate(from)) && (!to || date <= asDate(to));
    });
    const sessionIds = new Set(sessions.map((session) => session.id));
    const approvedJustificationRecordIds = new Set(
      (await repository.absenceJustifications.all())
        .filter((row) => row.status === 'approved')
        .map((row) => row.attendanceRecordId),
    );

    let presentSessions = 0;
    let lateSessions = 0;
    let absentSessions = 0;
    let excusedSessions = 0;
    let missingRecords = 0;
    for (const session of sessions) {
      const record = recordsBySession.get(session.id);
      if (record?.status === 'absent' && approvedJustificationRecordIds.has(record.id)) {
        excusedSessions += 1;
        continue;
      }
      if (!record) {
        missingRecords += 1;
        absentSessions += 1;
      } else if (record.status === 'present') presentSessions += 1;
      else if (record.status === 'late') lateSessions += 1;
      else absentSessions += 1;
    }
    const countedSessions = sessions.length - excusedSessions;
    const attendedSessions = presentSessions + lateSessions;
    const attendanceRate = countedSessions ? attendedSessions / countedSessions : 0;
    return {
      studentId,
      attendanceRate,
      totalFinalizedSessions:sessions.length,
      countedSessions,
      excusedSessions,
      attendedSessions,
      presentSessions,
      lateSessions,
      absentSessions,
      missingRecords,
    };
  }

  async attendanceRate(studentId, from, to, repository = this.db) {
    return (await this.attendanceMetrics(studentId, from, to, repository)).attendanceRate;
  }
}

module.exports = { AttendanceService, enrollmentCoversSession, enrollmentForSession };
