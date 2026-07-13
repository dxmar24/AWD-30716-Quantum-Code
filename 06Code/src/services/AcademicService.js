const crypto = require('crypto');
const { AppError } = require('../exceptions/AppError');
const { withRequestAuditContext } = require('../utils/requestAuditContext');
const { hashPassword } = require('../utils/passwordHasher');
const { Roles } = require('../models/constants');

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function generateTemporaryPassword() {
  return `ALC-${crypto.randomBytes(6).toString('base64url')}1`;
}

function normalizeBranchName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function sameInstant(left, right) {
  if (!left || !right) return false;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return !Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime === rightTime;
}

class AcademicService {
  constructor(db, auditService, rulesService, accessPolicy = null, cacheService = null) {
    this.db = db;
    this.audit = auditService;
    this.rules = rulesService;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
  }

  async inTransaction(work) {
    return this.db.transaction ? this.db.transaction(work) : work(this.db);
  }

  policyFor(db) {
    return db && this.accessPolicy ? new this.accessPolicy.constructor(db) : this.accessPolicy;
  }

  async submitEnrollmentRequest(data) {
    const request = {
      ...data,
      email:String(data.email || '').trim().toLowerCase(),
      fullName:String(data.fullName || '').trim(),
      status:'pending',
    };
    if (request.branchId) {
      const branch = await this.db.branches.findById(request.branchId);
      if (!branch) throw new AppError('Branch not found', 404);
      if (branch.active === false) throw new AppError('This branch is not accepting enrollment requests', 422, { code:'BRANCH_INACTIVE' });
    }
    if (!request.branchId && request.preferredBranch) {
      const branches = await this.db.branches.all();
      const preferred = normalizeBranchName(request.preferredBranch);
      const branch = branches.find((item) => normalizeBranchName(item.name) === preferred);
      if (branch) request.branchId = branch.id;
    }
    const duplicateWindow = Date.now() - 24 * 60 * 60 * 1000;
    const duplicate = (await this.db.enrollmentRequests.all()).find((item) => (
      String(item.email || '').trim().toLowerCase() === request.email
      && (item.branchId || null) === (request.branchId || null)
      && ['pending', 'contacted', 'trial_scheduled'].includes(item.status || 'pending')
      && new Date(item.createdAt || 0).getTime() >= duplicateWindow
    ));
    if (duplicate) {
      throw new AppError('An active enrollment request already exists for this email and branch', 409, {
        code:'DUPLICATE_ENROLLMENT_REQUEST',
      });
    }
    const created = await this.inTransaction(async (db) => {
      const concurrentDuplicate = (await db.enrollmentRequests.all()).find((item) => (
        String(item.email || '').trim().toLowerCase() === request.email
        && (item.branchId || null) === (request.branchId || null)
        && ['pending', 'contacted', 'trial_scheduled'].includes(item.status || 'pending')
        && new Date(item.createdAt || 0).getTime() >= duplicateWindow
      ));
      if (concurrentDuplicate) throw new AppError('An active enrollment request already exists for this email and branch', 409, { code:'DUPLICATE_ENROLLMENT_REQUEST' });
      const row = await db.enrollmentRequests.create(request);
      await db.auditLogs.create({
        actorUserId:null,
        action:'ENROLLMENT_REQUEST_CREATED',
        entity:'enrollment_requests',
        entityId:row.id,
        metadata:withRequestAuditContext({ branchId:row.branchId || null, status:row.status }),
      });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['enrollment-requests']);
    return created;
  }

  async listEnrollmentRequests(actor) {
    const rows = await this.db.enrollmentRequests.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'enrollment-requests', rows) : rows;
  }

  async updateEnrollmentRequestStatus(actor, requestId, data) {
    const request = await this.db.enrollmentRequests.findById(requestId);
    if (!request) throw new AppError('Enrollment request not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'enrollment-requests', request, data);
    const transitions = {
      pending:new Set(['contacted', 'lost']),
      contacted:new Set(['trial_scheduled', 'enrolled', 'lost']),
      trial_scheduled:new Set(['contacted', 'enrolled', 'lost']),
      enrolled:new Set(),
      lost:new Set(),
    };
    const updated = await this.inTransaction(async (db) => {
      const currentRequest = await db.enrollmentRequests.findById(requestId);
      if (!currentRequest) throw new AppError('Enrollment request not found', 404);
      const current = currentRequest.status || 'pending';
      if (current === data.status) return currentRequest;
      if (!transitions[current]?.has(data.status)) {
        throw new AppError(`Enrollment request cannot move from ${current} to ${data.status}`, 409, { code:'INVALID_LEAD_STATUS_TRANSITION' });
      }

      let convertedStudentId = null;
      if (data.status === 'enrolled') {
        let student = data.convertedStudentId ? await db.students.findById(data.convertedStudentId) : null;
        if (!student) {
          const user = await db.users.findBy('email', String(currentRequest.email || '').trim().toLowerCase());
          student = user ? await db.students.findBy('userId', user.id) : null;
        }
        if (!student || student.active === false) {
          throw new AppError('Create and activate the student account before marking the lead as enrolled', 422, { code:'CONVERTED_STUDENT_REQUIRED' });
        }
        if (currentRequest.branchId && student.branchId !== currentRequest.branchId) {
          throw new AppError('Converted student must belong to the requested branch', 422, { code:'LEAD_STUDENT_BRANCH_MISMATCH' });
        }
        convertedStudentId = student.id;
      }

      let followUpAt = null;
      if (data.status === 'trial_scheduled') {
        const trialDate = new Date(data.followUpAt);
        if (trialDate <= new Date()) throw new AppError('Trial date must be in the future', 422, { code:'INVALID_TRIAL_DATE' });
        followUpAt = trialDate.toISOString();
      } else if (data.status === 'contacted' && data.followUpAt) {
        followUpAt = new Date(data.followUpAt).toISOString();
      }

      const row = await db.enrollmentRequests.update(requestId, {
        status:data.status,
        statusNotes:data.notes || null,
        followUpAt,
        convertedStudentId,
        updatedBy:actor.id,
        updatedAt:new Date().toISOString(),
      });
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'ENROLLMENT_REQUEST_STATUS_UPDATED',
        entity:'enrollment_requests',
        entityId:requestId,
        metadata:withRequestAuditContext({
          before:{ status:current, followUpAt:currentRequest.followUpAt || null, convertedStudentId:currentRequest.convertedStudentId || null },
          after:{ status:row.status, followUpAt:row.followUpAt || null, convertedStudentId:row.convertedStudentId || null },
          notes:data.notes || null,
        }),
      });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['enrollment-requests', 'reports']);
    return updated;
  }

  async assertActorCanCreateRole(actor, role) {
    if ([Roles.ADMIN, Roles.GENERAL_DIRECTOR].includes(role) && actor?.role !== Roles.ADMIN) {
      throw new AppError('Only Admin users can grant global administration roles', 403, { code:'GLOBAL_ROLE_RESTRICTED' });
    }
  }

  async assertRoleReady(userId, role) {
    if (role === Roles.STUDENT && !(await this.db.students.findBy('userId', userId))) {
      throw new AppError('Student role requires a linked student profile', 422, { code:'STUDENT_PROFILE_REQUIRED' });
    }
    if (role === Roles.TEACHER && !(await this.db.teachers.findBy('userId', userId))) {
      throw new AppError('Teacher role requires a linked teacher profile', 422, { code:'TEACHER_PROFILE_REQUIRED' });
    }
    if (role === Roles.BRANCH_DIRECTOR) {
      const branchAccess = await this.listUserBranchAccess(userId);
      if (!branchAccess.length) throw new AppError('BranchDirector role requires at least one assigned branch', 422, { code:'BRANCH_ACCESS_REQUIRED' });
    }
  }

  async ensureBranchExists(branchId) {
    if (!branchId) throw new AppError('Branch is required', 422, { code:'BRANCH_REQUIRED' });
    const branch = await this.db.branches.findById(branchId);
    if (!branch) throw new AppError('Branch not found', 404);
    return branch;
  }

  async updateUserRole(actor, userId, role) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    await this.assertActorCanCreateRole(actor, role);
    if (role !== user.role) await this.assertRoleReady(userId, role);
    const updated = await this.inTransaction(async (db) => {
      const row = await db.users.update(userId, { role });
      if (role !== Roles.BRANCH_DIRECTOR && db.userBranchAccess.replaceForUser) {
        await db.userBranchAccess.replaceForUser(userId, []);
      }
      await db.auditLogs.create({ actorUserId:actor.id, action:'USER_ROLE_UPDATED', entity:'users', entityId:userId, metadata:withRequestAuditContext({ beforeRole:user.role, afterRole:role }) });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['users', 'branches', 'reports', 'user-branch-access']);
    return publicUser(updated);
  }

  async createAcademicUser(actor, data) {
    const email = String(data.email || '').trim().toLowerCase();
    if (await this.db.users.findBy('email', email)) throw new AppError('User already exists', 409);
    await this.assertActorCanCreateRole(actor, data.role);

    const uniqueBranchIds = [...new Set(data.branchIds || [])];
    if (data.role === Roles.BRANCH_DIRECTOR && !uniqueBranchIds.length) {
      throw new AppError('BranchDirector accounts require at least one assigned branch', 422, { code:'BRANCH_ACCESS_REQUIRED' });
    }
    for (const branchId of uniqueBranchIds) {
      if (!(await this.db.branches.findById(branchId))) throw new AppError('Branch not found', 404);
    }

    if (data.role !== Roles.BRANCH_DIRECTOR && uniqueBranchIds.length) {
      throw new AppError('Branch access can only be assigned to BranchDirector accounts', 422, { code:'BRANCH_ACCESS_ROLE_MISMATCH' });
    }
    if (data.role === Roles.STUDENT && !data.studentProfile) {
      throw new AppError('Student accounts require a student profile', 422, { code:'STUDENT_PROFILE_REQUIRED' });
    }
    if (data.role === Roles.TEACHER && !data.teacherProfile) {
      throw new AppError('Teacher accounts require a teacher profile', 422, { code:'TEACHER_PROFILE_REQUIRED' });
    }
    if (data.studentProfile && data.role !== Roles.STUDENT) {
      throw new AppError('Student profile can only be used with Student accounts', 422, { code:'PROFILE_ROLE_MISMATCH' });
    }
    if (data.teacherProfile && data.role !== Roles.TEACHER) {
      throw new AppError('Teacher profile can only be used with Teacher accounts', 422, { code:'PROFILE_ROLE_MISMATCH' });
    }
    if (data.studentProfile) await this.ensureBranchExists(data.studentProfile.branchId);
    if (data.teacherProfile) await this.ensureBranchExists(data.teacherProfile.branchId);

    const temporaryPassword = data.temporaryPassword || generateTemporaryPassword();
    const mustChangePassword = true;
    const created = await this.inTransaction(async (db) => {
      if (await db.users.findBy('email', email)) throw new AppError('User already exists', 409);
      const user = await db.users.create({
        email,
        name:data.name,
        role:data.role,
        active:data.active ?? true,
        passwordHash:hashPassword(temporaryPassword),
        mustChangePassword,
        passwordChangedAt:null,
      });
      if (uniqueBranchIds.length) await db.userBranchAccess.replaceForUser(user.id, uniqueBranchIds);

      let profile = null;
      if (data.role === Roles.STUDENT) {
        profile = await db.students.create({
          userId:user.id,
          branchId:data.studentProfile.branchId,
          fullName:data.studentProfile.fullName || data.name,
          level:data.studentProfile.level || 'B1',
          active:data.studentProfile.active ?? true,
        });
      }
      if (data.role === Roles.TEACHER) {
        profile = await db.teachers.create({
          userId:user.id,
          branchId:data.teacherProfile.branchId,
          fullName:data.teacherProfile.fullName || data.name,
          hourlyRate:data.teacherProfile.hourlyRate ?? 12.5,
          active:data.teacherProfile.active ?? true,
        });
      }
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'ACADEMIC_USER_CREATED',
        entity:'users',
        entityId:user.id,
        metadata:withRequestAuditContext({ role:data.role, email }),
      });
      return { user, profile };
    });
    if (this.cacheService) this.cacheService.invalidateTags(['users', 'students', 'teachers', 'branches', 'reports', 'user-branch-access']);
    return {
      user:publicUser(created.user),
      profile:created.profile,
      temporaryPassword,
      instruction:'Share this temporary password through the approved academy communication channel. The user must change it on first sign-in.',
    };
  }

  async listUserBranchAccess(userId) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    return this.db.userBranchAccess.listByUser
      ? this.db.userBranchAccess.listByUser(userId)
      : (await this.db.userBranchAccess.all()).filter((row) => row.userId === userId);
  }

  async updateUserBranchAccess(actor, userId, branchIds) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.role !== Roles.BRANCH_DIRECTOR) {
      throw new AppError('Branch access can only be assigned to BranchDirector accounts', 422, { code:'BRANCH_ACCESS_ROLE_MISMATCH' });
    }

    const uniqueBranchIds = [...new Set(branchIds)];
    for (const branchId of uniqueBranchIds) {
      if (!(await this.db.branches.findById(branchId))) throw new AppError('Branch not found', 404);
    }

    const rows = await this.inTransaction(async (db) => {
      const previous = db.userBranchAccess.listByUser
        ? await db.userBranchAccess.listByUser(userId)
        : (await db.userBranchAccess.all()).filter((row) => row.userId === userId);
      const next = await db.userBranchAccess.replaceForUser(userId, uniqueBranchIds);
      await db.auditLogs.create({
        actorUserId:actor.id,
        action:'USER_BRANCH_ACCESS_UPDATED',
        entity:'users',
        entityId:userId,
        metadata:withRequestAuditContext({ before:previous.map((row) => row.branchId), after:uniqueBranchIds }),
      });
      return next;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['branches', 'reports', 'user-branch-access']);
    return rows;
  }

  async listAbsenceJustifications(actor) {
    const rows = await this.db.absenceJustifications.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'absence-justifications', rows) : rows;
  }

  async createAbsenceJustification(actor, data) {
    const attendanceRecord = await this.db.studentAttendance.findById(data.attendanceRecordId);
    if (!attendanceRecord) throw new AppError('Attendance record not found', 404);
    if (attendanceRecord.status !== 'absent') {
      throw new AppError('Only absent attendance records can be justified', 422, { code:'ABSENCE_REQUIRED' });
    }
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(actor, 'absence-justifications', data);

    const justification = await this.inTransaction(async (db) => {
      const currentAttendance = await db.studentAttendance.findById(data.attendanceRecordId);
      if (!currentAttendance || currentAttendance.status !== 'absent') throw new AppError('Only an existing absence can be justified', 422, { code:'ABSENCE_REQUIRED' });
      const active = (await db.absenceJustifications.all()).find((row) => (
        row.attendanceRecordId === data.attendanceRecordId && ['pending', 'approved'].includes(row.status)
      ));
      if (active) throw new AppError('This absence already has an active justification', 409, { code:'ACTIVE_JUSTIFICATION_EXISTS' });
      const row = await db.absenceJustifications.create({ ...data, status:'pending' });
      await db.auditLogs.create({ actorUserId:actor.id, action:'ABSENCE_JUSTIFICATION_CREATED', entity:'absence_justifications', entityId:row.id, metadata:withRequestAuditContext() });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['absence-justifications', 'attendance', 'reports']);
    return justification;
  }

  async reviewAbsenceJustification(actor, id, data) {
    const justification = await this.db.absenceJustifications.findById(id);
    if (!justification) throw new AppError('Absence justification not found', 404);
    if (justification.status !== 'pending') throw new AppError('Absence justification was already reviewed', 409);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'absence-justifications', justification, data);

    const attendanceRecord = await this.db.studentAttendance.findById(justification.attendanceRecordId);
    if (!attendanceRecord) throw new AppError('Attendance record not found', 404);
    if (data.status === 'approved' && attendanceRecord.status !== 'absent') {
      throw new AppError('Only an absence can receive an approved justification', 422, { code:'ABSENCE_REQUIRED' });
    }

    const updated = await this.inTransaction(async (db) => {
      const current = await db.absenceJustifications.findById(id);
      if (!current || current.status !== 'pending') throw new AppError('Absence justification was already reviewed', 409);
      const currentAttendance = await db.studentAttendance.findById(current.attendanceRecordId);
      if (data.status === 'approved' && currentAttendance?.status !== 'absent') throw new AppError('Only an absence can receive an approved justification', 422, { code:'ABSENCE_REQUIRED' });
      const row = await db.absenceJustifications.update(id, { ...data, reviewedBy:actor.id, reviewedAt:new Date().toISOString() });
      await db.auditLogs.create({ actorUserId:actor.id, action:'ABSENCE_JUSTIFICATION_REVIEWED', entity:'absence_justifications', entityId:id, metadata:withRequestAuditContext({ status:data.status }) });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['absence-justifications', 'attendance', 'reports']);
    return updated;
  }

  async listScholarshipEvaluations(actor) {
    const rows = await this.db.scholarshipEvaluations.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'scholarship-evaluations', rows) : rows;
  }

  async createScholarshipEvaluation(actor, data) {
    const evaluation = await this.inTransaction(async (db) => {
      const policy = this.policyFor(db);
      if (policy) await policy.assertCanCreate(actor, 'scholarship-evaluations', data);
      const passesScores = data.theoryScore >= 70 && data.practiceScore >= 70;
      const candidate = await this.rules.scholarshipCandidate(data.studentId, data.from, data.to, db);
      if (data.approved && !candidate.candidate) throw new AppError('Student is not a scholarship candidate', 422);
      if (data.approved && candidate.candidate && passesScores) {
        const previousApproval = (await db.scholarshipEvaluations.all()).find((row) => (
          row.studentId === data.studentId
          && row.approved === true
          && sameInstant(row.evaluationFrom, candidate.from)
          && sameInstant(row.evaluationTo, candidate.to)
        ));
        if (previousApproval) {
          throw new AppError('Student already has an approved scholarship evaluation for this period', 409, {
            code:'SCHOLARSHIP_ALREADY_APPROVED',
            evaluationId:previousApproval.id,
          });
        }
      }
      const approved = Boolean(data.approved && candidate.candidate && passesScores);
      let row;
      try {
        row = await db.scholarshipEvaluations.create({
          studentId:data.studentId,
          percentage:data.percentage,
          evaluationFrom:candidate.from,
          evaluationTo:candidate.to,
          attendanceRate:Number((candidate.attendanceRate * 100).toFixed(2)),
          theoryScore:data.theoryScore,
          practiceScore:data.practiceScore,
          approved,
          evaluatedBy:actor.id,
          evaluatedAt:new Date().toISOString(),
        });
      } catch (error) {
        if (approved && error?.status === 409) {
          throw new AppError('Student already has an approved scholarship evaluation for this period', 409, {
            code:'SCHOLARSHIP_ALREADY_APPROVED',
          });
        }
        throw error;
      }
      await db.auditLogs.create({ actorUserId:actor.id, action:'SCHOLARSHIP_EVALUATION_REGISTERED', entity:'scholarship_evaluations', entityId:row.id, metadata:withRequestAuditContext({ approved, evaluationFrom:candidate.from, evaluationTo:candidate.to }) });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['scholarship-evaluations', 'reports']);
    return evaluation;
  }

  async listLevelPromotionEvaluations(actor) {
    const rows = await this.db.levelPromotionEvaluations.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'level-promotion-evaluations', rows) : rows;
  }

  async createLevelPromotionEvaluation(actor, data) {
    const evaluation = await this.inTransaction(async (db) => {
      const policy = this.policyFor(db);
      if (policy) await policy.assertCanCreate(actor, 'level-promotion-evaluations', data);
      const passesScores = data.consistencyScore >= 70 && data.theoryScore >= 70 && data.practiceScore >= 70;
      if (data.approved && passesScores) {
        const previousApproval = (await db.levelPromotionEvaluations.all()).find((row) => (
          row.studentId === data.studentId
          && row.fromLevel === 'B1'
          && row.toLevel === 'B2'
          && row.approved === true
        ));
        if (previousApproval) {
          throw new AppError('Student already has an approved B1 to B2 promotion', 409, {
            code:'LEVEL_PROMOTION_ALREADY_APPROVED',
            evaluationId:previousApproval.id,
          });
        }
      }
      const candidate = await this.rules.promotionCandidate(data.studentId, data.from, data.to, db);
      if (data.approved && !candidate.candidate) throw new AppError('Student is not a level promotion candidate', 422);
      const approved = Boolean(data.approved && candidate.candidate && passesScores);
      let row;
      try {
        row = await db.levelPromotionEvaluations.create({
          studentId:data.studentId,
          fromLevel:'B1',
          toLevel:'B2',
          evaluationFrom:candidate.from,
          evaluationTo:candidate.to,
          attendanceRate:Number((candidate.attendanceRate * 100).toFixed(2)),
          consistencyScore:data.consistencyScore,
          theoryScore:data.theoryScore,
          practiceScore:data.practiceScore,
          approved,
          evaluatedBy:actor.id,
          evaluatedAt:new Date().toISOString(),
        });
      } catch (error) {
        if (approved && error?.status === 409) {
          throw new AppError('Student already has an approved B1 to B2 promotion', 409, {
            code:'LEVEL_PROMOTION_ALREADY_APPROVED',
          });
        }
        throw error;
      }
      if (approved) await db.students.update(data.studentId, { level:'B2' });
      await db.auditLogs.create({ actorUserId:actor.id, action:'LEVEL_PROMOTION_EVALUATION_REGISTERED', entity:'level_promotion_evaluations', entityId:row.id, metadata:withRequestAuditContext({ approved, evaluationFrom:candidate.from, evaluationTo:candidate.to }) });
      return row;
    });
    if (this.cacheService) this.cacheService.invalidateTags(['level-promotion-evaluations', 'students', 'reports']);
    return evaluation;
  }
}

module.exports = { AcademicService };
