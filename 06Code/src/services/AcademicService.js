const { AppError } = require('../exceptions/AppError');

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
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
    if (!request.branchId && request.preferredBranch) {
      const branch = await this.db.branches.findBy('name', request.preferredBranch);
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

  async updateUserRole(actor, userId, role) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    const updated = await this.db.users.update(userId, { role });
    await this.audit.log(actor.id, 'USER_ROLE_UPDATED', 'users', userId, { role });
    return publicUser(updated);
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
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(actor, 'absence-justifications', data);

    const justification = await this.db.absenceJustifications.create({ ...data, status:'pending' });
    await this.audit.log(actor.id, 'ABSENCE_JUSTIFICATION_CREATED', 'absence_justifications', justification.id);
    if (this.cacheService) this.cacheService.invalidateTags(['absence-justifications', 'attendance', 'reports']);
    return justification;
  }

  async reviewAbsenceJustification(actor, id, data) {
    const justification = await this.db.absenceJustifications.findById(id);
    if (!justification) throw new AppError('Absence justification not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'absence-justifications', justification, data);

    const updated = await this.db.absenceJustifications.update(id, { ...data, reviewedBy:actor.id, reviewedAt:new Date().toISOString() });
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
