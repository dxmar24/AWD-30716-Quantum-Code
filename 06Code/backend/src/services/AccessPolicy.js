const { AppError } = require('../exceptions/AppError');
const { Roles } = require('../models/constants');

const CURRENT_ENROLLMENT_STATUSES = new Set(['active', 'trial']);
const VISIBLE_ENROLLMENT_STATUSES = new Set(['active', 'trial', 'waitlisted', 'frozen']);

class AccessPolicy {
  constructor(db) {
    this.db = db;
  }

  isGlobal(user) {
    return [Roles.ADMIN, Roles.GENERAL_DIRECTOR].includes(user?.role);
  }

  deny(message = 'Insufficient permissions') {
    throw new AppError(message, 403);
  }

  async branchIdsForUser(user) {
    if (!user) return [];
    if (this.isGlobal(user)) return (await this.db.branches.all()).map((branch) => branch.id);
    if (user.role === Roles.BRANCH_DIRECTOR) {
      const rows = await this.db.userBranchAccess.all();
      return rows.filter((row) => row.userId === user.id).map((row) => row.branchId);
    }
    if (user.role === Roles.TEACHER) {
      const teacher = await this.db.teachers.findBy('userId', user.id);
      return teacher?.branchId ? [teacher.branchId] : [];
    }
    if (user.role === Roles.STUDENT) {
      const student = await this.db.students.findBy('userId', user.id);
      return student?.branchId ? [student.branchId] : [];
    }
    return [];
  }

  async canAccessBranch(user, branchId) {
    if (!branchId) return this.isGlobal(user);
    return (await this.branchIdsForUser(user)).includes(branchId);
  }

  async requireBranchAccess(user, branchId) {
    if (!(await this.canAccessBranch(user, branchId))) this.deny();
  }

  async userStudent(user) {
    return user?.id ? this.db.students.findBy('userId', user.id) : null;
  }

  async userTeacher(user) {
    return user?.id ? this.db.teachers.findBy('userId', user.id) : null;
  }

  async classGroupForSession(sessionOrId) {
    const session = typeof sessionOrId === 'string'
      ? await this.db.classSessions.findById(sessionOrId)
      : sessionOrId;
    if (!session?.classGroupId) return null;
    return this.db.classGroups.findById(session.classGroupId);
  }

  async enrollmentsFor(studentId, classGroupId) {
    if (!studentId || !classGroupId) return [];
    return (await this.db.classGroupEnrollments.all())
      .filter((row) => row.studentId === studentId && row.classGroupId === classGroupId)
      .sort((left, right) => new Date(right.startsAt || right.enrolledAt || 0) - new Date(left.startsAt || left.enrolledAt || 0));
  }

  async enrollmentFor(studentId, classGroupId, session = null) {
    const enrollments = await this.enrollmentsFor(studentId, classGroupId);
    if (session) {
      const covering = enrollments.find((enrollment) => this.enrollmentCoversSession(enrollment, session));
      if (covering) return covering;
    }
    return enrollments.find((enrollment) => VISIBLE_ENROLLMENT_STATUSES.has(enrollment.status)) || enrollments[0] || null;
  }

  async attendanceFor(studentId, classSessionId) {
    if (!studentId || !classSessionId) return null;
    if (this.db.studentAttendance.findByFields) {
      return this.db.studentAttendance.findByFields({ studentId, classSessionId });
    }
    return (await this.db.studentAttendance.all())
      .find((row) => row.studentId === studentId && row.classSessionId === classSessionId) || null;
  }

  enrollmentIsCurrent(enrollment, at = new Date()) {
    if (!enrollment || !CURRENT_ENROLLMENT_STATUSES.has(enrollment.status)) return false;
    const startsAt = new Date(enrollment.startsAt || enrollment.starts_at || enrollment.enrolledAt || enrollment.enrolled_at);
    const endsValue = enrollment.endsAt || enrollment.ends_at;
    const endsAt = endsValue ? new Date(endsValue) : null;
    return !Number.isNaN(startsAt.getTime())
      && startsAt <= at
      && (!endsAt || (!Number.isNaN(endsAt.getTime()) && endsAt >= at));
  }

  enrollmentCoversSession(enrollment, session) {
    if (!enrollment || !session || enrollment.status === 'waitlisted') return false;
    const sessionDate = new Date(session.startsAt || session.starts_at);
    const startsAt = new Date(enrollment.startsAt || enrollment.starts_at || enrollment.enrolledAt || enrollment.enrolled_at);
    const endsValue = enrollment.endsAt || enrollment.ends_at;
    const endsAt = endsValue ? new Date(endsValue) : null;
    if (Number.isNaN(sessionDate.getTime()) || Number.isNaN(startsAt.getTime())) return false;
    if (sessionDate < startsAt || (endsAt && sessionDate >= endsAt)) return false;
    if (CURRENT_ENROLLMENT_STATUSES.has(enrollment.status)) return true;
    return ['frozen', 'withdrawn', 'completed'].includes(enrollment.status) && Boolean(endsAt);
  }

  async assertClassGroupTeacherConsistency(data, existing = null) {
    const branchId = data.branchId ?? existing?.branchId;
    const styleId = data.styleId !== undefined ? data.styleId : existing?.styleId;
    const teacherId = data.teacherId !== undefined ? data.teacherId : existing?.teacherId;
    const branch = branchId ? await this.db.branches.findById(branchId) : null;
    if (!branch) throw new AppError('Class group branch not found', 404);
    if (branch.active === false) throw new AppError('Class groups cannot be assigned to an inactive branch', 422, { code:'BRANCH_INACTIVE' });
    if (styleId && !(await this.db.danceStyles.findById(styleId))) throw new AppError('Dance style not found', 404);
    if (!teacherId) return;
    const teacher = await this.db.teachers.findById(teacherId);
    if (!teacher) throw new AppError('Teacher not found', 404);
    if (teacher.active === false) throw new AppError('Inactive teachers cannot be assigned to class groups', 422, { code:'TEACHER_INACTIVE' });
    if (!branchId || teacher.branchId !== branchId) {
      throw new AppError('Teacher and class group must belong to the same branch', 422, { code:'TEACHER_BRANCH_MISMATCH' });
    }
    if (styleId) {
      const qualifications = (await this.db.teacherStyles.all()).filter((link) => link.teacherId === teacherId);
      if (qualifications.length && !qualifications.some((link) => link.styleId === styleId)) {
        throw new AppError('Teacher must be qualified for the class group dance style', 422, {
          code:'TEACHER_STYLE_MISMATCH',
        });
      }
    }
  }

  assertClassGroupCapacity(data, existing = null) {
    const value = data.capacity !== undefined ? data.capacity : existing?.capacity ?? 30;
    const capacity = Number(value);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
      throw new AppError('Class group capacity must be an integer between 1 and 200', 422, { code:'INVALID_CLASS_CAPACITY' });
    }
  }

  async assertStudentAcademicConsistency(updates, existing) {
    if (!existing) return;
    if (updates.level && updates.level !== existing.level) {
      throw new AppError('Student level changes require an approved level promotion evaluation', 409, {
        code:'LEVEL_CHANGE_REQUIRES_EVALUATION',
      });
    }
    const changingBranch = updates.branchId && updates.branchId !== existing.branchId;
    const deactivating = updates.active === false && existing.active !== false;
    if (!changingBranch && !deactivating) return;
    const linked = (await this.db.classGroupEnrollments.all()).filter((enrollment) => (
      enrollment.studentId === existing.id && VISIBLE_ENROLLMENT_STATUSES.has(enrollment.status)
    ));
    if (deactivating && linked.some((enrollment) => this.enrollmentIsCurrent(enrollment))) {
      throw new AppError('Active or trial enrollments must be frozen, withdrawn or completed before deactivating a student', 409, {
        code:'STUDENT_HAS_CURRENT_ENROLLMENTS',
      });
    }
    if (changingBranch && linked.length) {
      throw new AppError('Current enrollments must be resolved before transferring a student to another branch', 409, {
        code:'STUDENT_HAS_LINKED_ENROLLMENTS',
      });
    }
  }

  async assertTeacherAcademicConsistency(updates, existing) {
    if (!existing) return;
    const changingBranch = updates.branchId !== undefined && updates.branchId !== existing.branchId;
    const deactivating = updates.active === false && existing.active !== false;
    if (!changingBranch && !deactivating) return;
    const assignedGroups = (await this.db.classGroups.all()).filter((group) => (
      group.teacherId === existing.id && group.active !== false
    ));
    if (assignedGroups.length) {
      throw new AppError('Active class groups must be reassigned before changing this teacher branch or active status', 409, {
        code:'TEACHER_HAS_ACTIVE_GROUPS',
        classGroupIds:assignedGroups.map((group) => group.id),
      });
    }
  }

  async assertClassGroupAcademicConsistency(updates, existing) {
    this.assertClassGroupCapacity(updates, existing);
    if (!existing) return;
    const changingBranch = updates.branchId !== undefined && updates.branchId !== existing.branchId;
    const changingLevel = updates.level !== undefined && updates.level !== existing.level;
    const deactivating = updates.active === false && existing.active !== false;
    if (!changingBranch && !changingLevel && !deactivating) return;
    const linked = (await this.db.classGroupEnrollments.all()).filter((enrollment) => (
      enrollment.classGroupId === existing.id && VISIBLE_ENROLLMENT_STATUSES.has(enrollment.status)
    ));
    if (linked.length) {
      throw new AppError('Current enrollments must be resolved before changing this class group branch, level or active status', 409, {
        code:'CLASS_GROUP_HAS_CURRENT_ENROLLMENTS',
        enrollmentIds:linked.map((enrollment) => enrollment.id),
      });
    }
  }

  assertClassSessionDates(data, existing = null) {
    const startsValue = data.startsAt ?? existing?.startsAt;
    const endsValue = data.endsAt ?? existing?.endsAt;
    if (!startsValue || !endsValue) return;
    const startsAt = new Date(startsValue);
    const endsAt = new Date(endsValue);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new AppError('Class session end must be after its start', 422, { code:'INVALID_SESSION_WINDOW' });
    }
    if (new Date(endsValue) - new Date(startsValue) > 6 * 60 * 60 * 1000) {
      throw new AppError('A class session cannot last more than six hours', 422, { code:'SESSION_TOO_LONG' });
    }
  }

  assertAttendanceFinalizationConsistency(data, existing = null) {
    const nextValue = (field, fallback = null) => (
      Object.prototype.hasOwnProperty.call(data, field)
        ? data[field]
        : (existing?.[field] ?? fallback)
    );
    const status = nextValue('status', 'scheduled');
    const attendanceState = nextValue('attendanceState', 'draft');
    const finalizedAt = nextValue('attendanceFinalizedAt');
    const finalizedBy = nextValue('attendanceFinalizedBy');
    const hasFinalizedAt = Boolean(finalizedAt);
    const hasFinalizedBy = Boolean(finalizedBy);

    if (attendanceState === 'finalized') {
      if (!hasFinalizedAt || !hasFinalizedBy) {
        throw new AppError('Finalized attendance requires its finalization time and responsible user', 422, {
          code:'ATTENDANCE_FINALIZATION_METADATA_REQUIRED',
        });
      }
      if (status !== 'completed') {
        throw new AppError('A session with finalized attendance must be completed', 422, {
          code:'FINALIZED_ATTENDANCE_REQUIRES_COMPLETED_SESSION',
        });
      }
      return;
    }

    if (hasFinalizedAt || hasFinalizedBy) {
      throw new AppError('Draft attendance cannot retain finalization metadata', 422, {
        code:'ORPHAN_ATTENDANCE_FINALIZATION_METADATA',
      });
    }
    if (status === 'completed') {
      throw new AppError('A class session cannot be completed before attendance is finalized', 422, {
        code:'ATTENDANCE_NOT_FINALIZED',
      });
    }
  }

  async assertClassSessionConsistency(data, existing = null) {
    this.assertClassSessionDates(data, existing);
    this.assertAttendanceFinalizationConsistency(data, existing);
    const classGroupId = data.classGroupId ?? existing?.classGroupId;
    const group = classGroupId ? await this.db.classGroups.findById(classGroupId) : null;
    if (!group) throw new AppError('Class group not found', 404);
    if (group.active === false) throw new AppError('Sessions cannot be scheduled for an inactive class group', 422, { code:'CLASS_GROUP_INACTIVE' });

    const startsAt = new Date(data.startsAt ?? existing?.startsAt);
    const endsAt = new Date(data.endsAt ?? existing?.endsAt);
    const nextStatus = data.status ?? existing?.status ?? 'scheduled';
    const currentStatus = existing?.status ?? null;
    if (!existing && nextStatus !== 'scheduled') {
      throw new AppError('New class sessions must start as scheduled', 422, { code:'INVALID_INITIAL_SESSION_STATUS' });
    }
    if (!existing && data.cancellationReason) {
      throw new AppError('Scheduled sessions cannot have a cancellation reason', 422, { code:'INVALID_CANCELLATION_REASON' });
    }
    if (existing && ['completed', 'cancelled'].includes(currentStatus)) {
      throw new AppError('Completed or cancelled class sessions are immutable', 409, { code:'SESSION_IMMUTABLE' });
    }
    if (existing && data.status === 'completed' && endsAt > new Date()) {
      throw new AppError('A class session cannot be completed before it ends', 422, { code:'SESSION_NOT_ENDED' });
    }
    if (existing && data.status === 'cancelled' && String(data.cancellationReason || '').trim().length < 5) {
      throw new AppError('A cancellation reason of at least five characters is required', 422, { code:'CANCELLATION_REASON_REQUIRED' });
    }
    if (nextStatus === 'cancelled') return;

    const groups = await this.db.classGroups.all();
    const groupById = new Map(groups.map((item) => [item.id, item]));
    const conflicts = (await this.db.classSessions.all()).filter((session) => {
      if (session.id === existing?.id || session.status === 'cancelled') return false;
      const overlaps = startsAt < new Date(session.endsAt) && endsAt > new Date(session.startsAt);
      if (!overlaps) return false;
      if (session.classGroupId === classGroupId) return true;
      const otherGroup = groupById.get(session.classGroupId);
      return Boolean(group.teacherId && otherGroup?.teacherId === group.teacherId);
    });
    if (conflicts.length) {
      throw new AppError('Class session overlaps another session for this group or teacher', 409, {
        code:'CLASS_SESSION_CONFLICT',
        conflictingSessionIds:conflicts.map((session) => session.id),
      });
    }
  }

  assertEventDates(data, existing = null) {
    const startsAt = data.startsAt ?? existing?.startsAt;
    const endsAt = data.endsAt !== undefined ? data.endsAt : existing?.endsAt;
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      throw new AppError('Event end must be after its start', 422, { code:'INVALID_EVENT_WINDOW' });
    }
  }

  async assertProfileConsistency(entityName, data, existing = null) {
    const branchId = data.branchId !== undefined ? data.branchId : existing?.branchId;
    const branch = branchId ? await this.db.branches.findById(branchId) : null;
    if (!branch) throw new AppError('Branch not found', 404);
    if (branch.active === false && data.active !== false) throw new AppError('Active profiles require an active branch', 422, { code:'BRANCH_INACTIVE' });
    const userId = data.userId !== undefined ? data.userId : existing?.userId;
    if (userId) {
      const user = await this.db.users.findById(userId);
      if (!user) throw new AppError('Linked user not found', 404);
      const requiredRole = entityName === 'students' ? Roles.STUDENT : Roles.TEACHER;
      if (user.role !== requiredRole) throw new AppError(`Linked user must have the ${requiredRole} role`, 422, { code:'PROFILE_ROLE_MISMATCH' });
      const repository = entityName === 'students' ? this.db.students : this.db.teachers;
      const duplicate = await repository.findBy('userId', userId);
      if (duplicate && duplicate.id !== existing?.id) throw new AppError('User is already linked to another profile', 409, { code:'DUPLICATE_USER_PROFILE' });
    }
  }

  async assertClassGroupCapacityChange(updates, existing = null) {
    if (updates.capacity === undefined || !existing) return;
    const capacity = Number(updates.capacity);
    const occupied = (await this.db.classGroupEnrollments.all()).filter((enrollment) => (
      enrollment.classGroupId === existing.id && this.enrollmentIsCurrent(enrollment)
    )).length;
    if (capacity < occupied) {
      throw new AppError('Class group capacity cannot be lower than its occupied seats', 409, {
        code:'CAPACITY_BELOW_OCCUPANCY',
        occupied,
      });
    }
  }

  async branchIdForResource(entityName, resource) {
    if (!resource) return null;
    if (entityName === 'branches') return resource.id;
    if (['students', 'teachers', 'class-groups', 'enrollment-requests', 'academy-events', 'student-payments'].includes(entityName)) return resource.branchId || null;
    if (entityName === 'class-group-enrollments') {
      const group = resource.classGroupId ? await this.db.classGroups.findById(resource.classGroupId) : null;
      return group?.branchId || null;
    }
    if (entityName === 'class-sessions') return (await this.classGroupForSession(resource))?.branchId || null;
    if (entityName === 'student-attendance') {
      const student = resource.studentId ? await this.db.students.findById(resource.studentId) : null;
      return student?.branchId || null;
    }
    if (entityName === 'teacher-attendance') {
      const teacher = resource.teacherId ? await this.db.teachers.findById(resource.teacherId) : null;
      return teacher?.branchId || null;
    }
    if (entityName === 'absence-justifications') {
      const attendance = resource.attendanceRecordId ? await this.db.studentAttendance.findById(resource.attendanceRecordId) : null;
      return attendance ? this.branchIdForResource('student-attendance', attendance) : null;
    }
    if (['scholarship-evaluations', 'level-promotion-evaluations'].includes(entityName)) {
      const student = resource.studentId ? await this.db.students.findById(resource.studentId) : null;
      return student?.branchId || null;
    }
    return null;
  }

  async teacherOwnsSession(user, classSessionId) {
    const teacher = await this.userTeacher(user);
    if (!teacher || !classSessionId) return false;
    const classGroup = await this.classGroupForSession(classSessionId);
    return Boolean(
      teacher.active !== false
      && classGroup?.teacherId === teacher.id
      && classGroup.branchId === teacher.branchId,
    );
  }

  async teacherCanAccessStudent(user, studentId, classSessionId = null) {
    const teacher = await this.userTeacher(user);
    if (!teacher || !studentId) return false;
    const student = await this.db.students.findById(studentId);
    if (!student || teacher.active === false) return false;
    if (classSessionId) {
      const session = await this.db.classSessions.findById(classSessionId);
      const classGroup = await this.classGroupForSession(session);
      if (!classGroup || classGroup.teacherId !== teacher.id || classGroup.branchId !== teacher.branchId) return false;
      if (await this.attendanceFor(student.id, classSessionId)) return true;
      if (student.active === false || classGroup.branchId !== student.branchId) return false;
      return this.enrollmentCoversSession(await this.enrollmentFor(student.id, classGroup.id, session), session);
    }
    if (student.active === false) return false;
    const groups = (await this.db.classGroups.all()).filter((group) => (
      group.teacherId === teacher.id && group.branchId === teacher.branchId
    ));
    const groupIds = new Set(groups.map((group) => group.id));
    const enrollments = await this.db.classGroupEnrollments.all();
    return enrollments.some((enrollment) => (
      enrollment.studentId === student.id
      && groupIds.has(enrollment.classGroupId)
      && this.enrollmentIsCurrent(enrollment)
    ));
  }

  async studentOwnsStudentId(user, studentId) {
    const student = await this.userStudent(user);
    return Boolean(student && student.id === studentId);
  }

  async canReadResource(user, entityName, resource) {
    if (!user) return false;
    if (this.isGlobal(user)) return true;

    if (entityName === 'dance-categories' || entityName === 'dance-styles' || entityName === 'roles') return true;
    if (entityName === 'branches') return this.canAccessBranch(user, resource.id);

    if (entityName === 'students') {
      if (user.role === Roles.STUDENT) return resource.userId === user.id;
      if (user.role === Roles.TEACHER) return this.teacherCanAccessStudent(user, resource.id);
    }

    if (entityName === 'teachers') {
      if (user.role === Roles.TEACHER) return resource.userId === user.id;
    }

    if (entityName === 'class-sessions') {
      if (user.role === Roles.TEACHER) return this.teacherOwnsSession(user, resource.id);
      if (user.role === Roles.STUDENT) {
        const student = await this.userStudent(user);
        const group = await this.classGroupForSession(resource);
        return Boolean(student && group && (
          this.enrollmentCoversSession(await this.enrollmentFor(student.id, group.id, resource), resource)
          || await this.attendanceFor(student.id, resource.id)
        ));
      }
    }

    if (entityName === 'class-groups') {
      if (user.role === Roles.TEACHER) {
        const teacher = await this.userTeacher(user);
        return Boolean(
          teacher
          && teacher.active !== false
          && teacher.id === resource.teacherId
          && teacher.branchId === resource.branchId,
        );
      }
      if (user.role === Roles.STUDENT) {
        const student = await this.userStudent(user);
        const enrollments = student ? await this.enrollmentsFor(student.id, resource.id) : [];
        return enrollments.some((enrollment) => VISIBLE_ENROLLMENT_STATUSES.has(enrollment.status));
      }
    }

    if (entityName === 'class-group-enrollments') {
      if (user.role === Roles.STUDENT) {
        const student = await this.userStudent(user);
        return student?.id === resource.studentId;
      }
      if (user.role === Roles.TEACHER) {
        const teacher = await this.userTeacher(user);
        const group = resource.classGroupId ? await this.db.classGroups.findById(resource.classGroupId) : null;
        return Boolean(teacher && group && teacher.active !== false && group.teacherId === teacher.id && group.branchId === teacher.branchId);
      }
    }

    if (entityName === 'academy-events') {
      if (resource.active === false) return false;
      if (user.role === Roles.STUDENT) {
        const student = await this.userStudent(user);
        return Boolean(student
          && student.branchId === resource.branchId
          && (resource.level === 'ALL' || resource.level === student.level));
      }
      if (user.role === Roles.TEACHER) return this.canAccessBranch(user, resource.branchId);
    }

    if (entityName === 'student-payments') {
      if (user.role === Roles.STUDENT) {
        const student = await this.userStudent(user);
        return Boolean(student && student.id === resource.studentId);
      }
      if (user.role === Roles.TEACHER) return false;
    }

    if (entityName === 'student-attendance') {
      if (user.role === Roles.STUDENT) return this.studentOwnsStudentId(user, resource.studentId);
      if (user.role === Roles.TEACHER) return this.teacherCanAccessStudent(user, resource.studentId, resource.classSessionId);
    }

    if (entityName === 'teacher-attendance') {
      if (user.role === Roles.TEACHER) {
        const teacher = await this.userTeacher(user);
        return teacher?.id === resource.teacherId;
      }
    }

    if (['absence-justifications', 'scholarship-evaluations', 'level-promotion-evaluations'].includes(entityName)) {
      const branchAllowed = await this.canAccessBranch(user, await this.branchIdForResource(entityName, resource));
      if (branchAllowed && user.role === Roles.BRANCH_DIRECTOR) return true;
      if (user.role === Roles.STUDENT) {
        const attendance = resource.attendanceRecordId ? await this.db.studentAttendance.findById(resource.attendanceRecordId) : null;
        return resource.studentId
          ? this.studentOwnsStudentId(user, resource.studentId)
          : this.studentOwnsStudentId(user, attendance?.studentId);
      }
      if (user.role === Roles.TEACHER && resource.attendanceRecordId) {
        const attendance = await this.db.studentAttendance.findById(resource.attendanceRecordId);
        return this.teacherCanAccessStudent(user, attendance?.studentId, attendance?.classSessionId);
      }
    }

    const branchId = await this.branchIdForResource(entityName, resource);
    return user.role === Roles.BRANCH_DIRECTOR && await this.canAccessBranch(user, branchId);
  }

  async filterList(user, entityName, rows) {
    if (!user) return [];
    if (this.isGlobal(user)) return rows;
    const visible = [];
    for (const row of rows) {
      if (await this.canReadResource(user, entityName, row)) visible.push(row);
    }
    return visible;
  }

  async assertCanRead(user, entityName, resource) {
    if (!(await this.canReadResource(user, entityName, resource))) this.deny();
  }

  async assertCanCreate(user, entityName, data) {
    if (entityName === 'class-groups') {
      await this.assertClassGroupTeacherConsistency(data);
      await this.assertClassGroupAcademicConsistency(data);
    }
    if (entityName === 'class-sessions') await this.assertClassSessionConsistency(data);
    if (entityName === 'academy-events') this.assertEventDates(data);
    if (['students', 'teachers'].includes(entityName)) await this.assertProfileConsistency(entityName, data);
    if (this.isGlobal(user)) return;

    if (['branches', 'dance-categories', 'dance-styles'].includes(entityName)) this.deny();
    if (entityName === 'teachers') {
      if (data.hourlyRate !== undefined) this.deny('Only global administration can set teacher rates');
      data.hourlyRate = 12.5;
    }

    if (['students', 'teachers', 'class-groups', 'academy-events', 'student-payments'].includes(entityName)) {
      return this.requireBranchAccess(user, data.branchId);
    }

    if (entityName === 'class-sessions') {
      const classGroup = data.classGroupId ? await this.db.classGroups.findById(data.classGroupId) : null;
      return this.requireBranchAccess(user, classGroup?.branchId);
    }

    if (entityName === 'class-group-enrollments') {
      const group = data.classGroupId ? await this.db.classGroups.findById(data.classGroupId) : null;
      return this.requireBranchAccess(user, group?.branchId);
    }

    if (entityName === 'student-attendance') {
      const student = await this.db.students.findById(data.studentId);
      const classGroup = await this.classGroupForSession(data.classSessionId);
      const session = await this.db.classSessions.findById(data.classSessionId);
      const enrollment = classGroup ? await this.enrollmentFor(data.studentId, classGroup.id, session) : null;
      if (!student || student.active === false || !classGroup || student.branchId !== classGroup.branchId || !this.enrollmentCoversSession(enrollment, session)) this.deny();
      if (user.role === Roles.BRANCH_DIRECTOR) return this.requireBranchAccess(user, student.branchId);
      if (user.role === Roles.TEACHER && await this.teacherCanAccessStudent(user, data.studentId, data.classSessionId)) return;
      this.deny();
    }

    if (entityName === 'teacher-attendance') {
      const teacher = await this.db.teachers.findById(data.teacherId);
      if (!teacher || teacher.active === false) this.deny();
      if (data.classSessionId) {
        const group = await this.classGroupForSession(data.classSessionId);
        if (!group || group.teacherId !== teacher.id || group.branchId !== teacher.branchId) this.deny();
      }
      if (user.role === Roles.BRANCH_DIRECTOR) return this.requireBranchAccess(user, teacher?.branchId);
      if (user.role === Roles.TEACHER) {
        const ownTeacher = await this.userTeacher(user);
        if (ownTeacher?.id === data.teacherId && (!data.classSessionId || await this.teacherOwnsSession(user, data.classSessionId))) return;
      }
      this.deny();
    }

    if (entityName === 'absence-justifications') {
      const attendance = await this.db.studentAttendance.findById(data.attendanceRecordId);
      if (!attendance) return;
      return this.assertCanRead(user, 'student-attendance', attendance);
    }

    if (['scholarship-evaluations', 'level-promotion-evaluations'].includes(entityName)) {
      const student = data.studentId ? await this.db.students.findById(data.studentId) : null;
      return this.requireBranchAccess(user, student?.branchId);
    }

    this.deny();
  }

  async assertCanUpdate(user, entityName, resource, updates = {}) {
    if (entityName === 'class-groups') {
      await this.assertClassGroupTeacherConsistency(updates, resource);
      await this.assertClassGroupAcademicConsistency(updates, resource);
      await this.assertClassGroupCapacityChange(updates, resource);
    }
    if (entityName === 'students') await this.assertStudentAcademicConsistency(updates, resource);
    if (entityName === 'teachers') await this.assertTeacherAcademicConsistency(updates, resource);
    if (entityName === 'class-sessions') {
      await this.assertClassSessionConsistency(updates, resource);
      if (updates.status === 'cancelled') {
        updates.cancellationReason = String(updates.cancellationReason).trim();
        updates.cancelledAt = new Date().toISOString();
        updates.cancelledBy = user.id;
      }
      if (updates.status === 'completed') {
        updates.completedAt = new Date().toISOString();
        updates.completedBy = user.id;
      }
    }
    if (entityName === 'academy-events') this.assertEventDates(updates, resource);
    if (['students', 'teachers'].includes(entityName)) {
      await this.assertProfileConsistency(entityName, updates, resource);
      if (updates.branchId && updates.branchId !== resource.branchId) {
        const linkedRows = entityName === 'students'
          ? (await this.db.classGroupEnrollments.all()).filter((row) => row.studentId === resource.id && ['active', 'trial', 'frozen', 'waitlisted'].includes(row.status))
          : (await this.db.classGroups.all()).filter((row) => row.teacherId === resource.id && row.active !== false);
        if (linkedRows.length) throw new AppError('Profile cannot change branch while it has active academic assignments', 409, { code:'ACTIVE_ASSIGNMENTS_EXIST' });
      }
      if (updates.active === false && resource.active !== false) {
        const linkedRows = entityName === 'students'
          ? (await this.db.classGroupEnrollments.all()).filter((row) => row.studentId === resource.id && ['active', 'trial', 'frozen', 'waitlisted'].includes(row.status))
          : (await this.db.classGroups.all()).filter((row) => row.teacherId === resource.id && row.active !== false);
        if (linkedRows.length) throw new AppError('Profile cannot be deactivated while it has active academic assignments', 409, { code:'ACTIVE_ASSIGNMENTS_EXIST' });
      }
    }
    if (this.isGlobal(user)) return;
    if (!(await this.canReadResource(user, entityName, resource))) this.deny();

    if (['branches', 'dance-categories', 'dance-styles'].includes(entityName)) {
      this.deny('Only global administration can modify branches or academic catalogs');
    }
    if (entityName === 'teachers' && updates.hourlyRate !== undefined) this.deny('Only global administration can change teacher rates');

    if (['students', 'teachers', 'class-groups', 'academy-events', 'student-payments'].includes(entityName) && updates.branchId && updates.branchId !== resource.branchId) {
      await this.requireBranchAccess(user, updates.branchId);
    }

    if (entityName === 'class-sessions' && updates.classGroupId) {
      const classGroup = await this.db.classGroups.findById(updates.classGroupId);
      await this.requireBranchAccess(user, classGroup?.branchId);
    }


    if (entityName === 'class-group-enrollments') {
      const group = await this.db.classGroups.findById(resource.classGroupId);
      await this.requireBranchAccess(user, group?.branchId);
    }
  }
}

module.exports = { AccessPolicy };
