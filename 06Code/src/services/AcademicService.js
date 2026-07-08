const crypto = require('crypto');
const { AppError } = require('../exceptions/AppError');
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

class AcademicService {
  constructor(db, auditService, rulesService, accessPolicy = null, cacheService = null) {
    this.db = db;
    this.audit = auditService;
    this.rules = rulesService;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
  }

  async submitEnrollmentRequest(data) {
    const request = { ...data, status:'pending' };
    if (request.branchId && !(await this.db.branches.findById(request.branchId))) {
      throw new AppError('Branch not found', 404);
    }
    if (!request.branchId && request.preferredBranch) {
      const branches = await this.db.branches.all();
      const preferred = normalizeBranchName(request.preferredBranch);
      const branch = branches.find((item) => normalizeBranchName(item.name) === preferred);
      if (branch) request.branchId = branch.id;
    }
    const created = await this.db.enrollmentRequests.create(request);
    if (this.cacheService) this.cacheService.invalidateTags(['enrollment-requests']);
    return created;
  }

  async listEnrollmentRequests(actor) {
    const rows = await this.db.enrollmentRequests.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'enrollment-requests', rows) : rows;
  }

  async assertActorCanCreateRole(actor, role) {
    if (role === Roles.ADMIN && actor?.role !== Roles.ADMIN) {
      throw new AppError('Only Admin users can create Admin accounts', 403, { code:'ADMIN_ROLE_RESTRICTED' });
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
    const updated = await this.db.users.update(userId, { role });
    if (role !== Roles.BRANCH_DIRECTOR && this.db.userBranchAccess.replaceForUser) {
      await this.db.userBranchAccess.replaceForUser(userId, []);
    }
    await this.audit.log(actor.id, 'USER_ROLE_UPDATED', 'users', userId, { role });
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
    const user = await this.db.users.create({
      email,
      name:data.name,
      role:data.role,
      active:data.active ?? true,
      passwordHash:hashPassword(temporaryPassword),
      mustChangePassword,
      passwordChangedAt:mustChangePassword ? null : new Date().toISOString(),
    });

    if (uniqueBranchIds.length) {
      await this.db.userBranchAccess.replaceForUser(user.id, uniqueBranchIds);
    }

    let profile = null;
    if (data.role === Roles.STUDENT) {
      profile = await this.db.students.create({
        userId:user.id,
        branchId:data.studentProfile.branchId,
        fullName:data.studentProfile.fullName || data.name,
        level:data.studentProfile.level || 'B1',
        active:data.studentProfile.active ?? true,
      });
    }
    if (data.role === Roles.TEACHER) {
      profile = await this.db.teachers.create({
        userId:user.id,
        branchId:data.teacherProfile.branchId,
        fullName:data.teacherProfile.fullName || data.name,
        hourlyRate:data.teacherProfile.hourlyRate ?? 12.5,
        active:data.teacherProfile.active ?? true,
      });
    }

    await this.audit.log(actor.id, 'ACADEMIC_USER_CREATED', 'users', user.id, { role:data.role, email });
    if (this.cacheService) this.cacheService.invalidateTags(['users', 'students', 'teachers', 'branches', 'reports', 'user-branch-access']);
    return {
      user:publicUser(user),
      profile,
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

    const rows = await this.db.userBranchAccess.replaceForUser(userId, uniqueBranchIds);
    await this.audit.log(actor.id, 'USER_BRANCH_ACCESS_UPDATED', 'users', userId, { branchIds:uniqueBranchIds });
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

    const justification = await this.db.absenceJustifications.create({ ...data, status:'pending' });
    await this.audit.log(actor.id, 'ABSENCE_JUSTIFICATION_CREATED', 'absence_justifications', justification.id);
    if (this.cacheService) this.cacheService.invalidateTags(['absence-justifications', 'attendance', 'reports']);
    return justification;
  }

  async reviewAbsenceJustification(actor, id, data) {
    const justification = await this.db.absenceJustifications.findById(id);
    if (!justification) throw new AppError('Absence justification not found', 404);
    if (justification.status !== 'pending') throw new AppError('Absence justification was already reviewed', 409);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'absence-justifications', justification, data);

    const updated = await this.db.absenceJustifications.update(id, { ...data, reviewedBy:actor.id, reviewedAt:new Date().toISOString() });
    if (data.status === 'approved') {
      await this.db.studentAttendance.update(justification.attendanceRecordId, { status:'justified' });
    }
    await this.audit.log(actor.id, 'ABSENCE_JUSTIFICATION_REVIEWED', 'absence_justifications', id, { status:data.status });
    if (this.cacheService) this.cacheService.invalidateTags(['absence-justifications', 'attendance', 'reports']);
    return updated;
  }

  async listScholarshipEvaluations(actor) {
    const rows = await this.db.scholarshipEvaluations.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'scholarship-evaluations', rows) : rows;
  }

  async createScholarshipEvaluation(actor, data) {
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(actor, 'scholarship-evaluations', data);
    const candidate = await this.rules.scholarshipCandidate(data.studentId, data.from, data.to);
    if (data.approved && !candidate.candidate) throw new AppError('Student is not a scholarship candidate', 422);
    const approved = Boolean(data.approved && candidate.candidate && data.theoryScore >= 70 && data.practiceScore >= 70);
    const evaluation = await this.db.scholarshipEvaluations.create({
      studentId:data.studentId,
      percentage:data.percentage,
      attendanceRate:Number((candidate.attendanceRate * 100).toFixed(2)),
      theoryScore:data.theoryScore,
      practiceScore:data.practiceScore,
      approved,
      evaluatedBy:actor.id,
      evaluatedAt:new Date().toISOString(),
    });
    await this.audit.log(actor.id, 'SCHOLARSHIP_EVALUATION_REGISTERED', 'scholarship_evaluations', evaluation.id, { approved });
    if (this.cacheService) this.cacheService.invalidateTags(['scholarship-evaluations', 'reports']);
    return evaluation;
  }

  async listLevelPromotionEvaluations(actor) {
    const rows = await this.db.levelPromotionEvaluations.all();
    return this.accessPolicy ? this.accessPolicy.filterList(actor, 'level-promotion-evaluations', rows) : rows;
  }

  async createLevelPromotionEvaluation(actor, data) {
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(actor, 'level-promotion-evaluations', data);
    const candidate = await this.rules.promotionCandidate(data.studentId, data.from, data.to);
    if (data.approved && !candidate.candidate) throw new AppError('Student is not a level promotion candidate', 422);
    const approved = Boolean(data.approved && candidate.candidate && data.consistencyScore >= 70 && data.theoryScore >= 70 && data.practiceScore >= 70);
    const evaluation = await this.db.levelPromotionEvaluations.create({
      studentId:data.studentId,
      fromLevel:'B1',
      toLevel:'B2',
      attendanceRate:Number((candidate.attendanceRate * 100).toFixed(2)),
      consistencyScore:data.consistencyScore,
      theoryScore:data.theoryScore,
      practiceScore:data.practiceScore,
      approved,
      evaluatedBy:actor.id,
      evaluatedAt:new Date().toISOString(),
    });
    if (approved) await this.db.students.update(data.studentId, { level:'B2' });
    await this.audit.log(actor.id, 'LEVEL_PROMOTION_EVALUATION_REGISTERED', 'level_promotion_evaluations', evaluation.id, { approved });
    if (this.cacheService) this.cacheService.invalidateTags(['level-promotion-evaluations', 'students', 'reports']);
    return evaluation;
  }
}

module.exports = { AcademicService };
