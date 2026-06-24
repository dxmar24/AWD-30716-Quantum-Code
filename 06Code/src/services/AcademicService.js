const { AppError } = require('../exceptions/AppError');

class AcademicService {
  constructor(db, auditService, rulesService) {
    this.db = db;
    this.audit = auditService;
    this.rules = rulesService;
  }

  async submitEnrollmentRequest(data) {
    return this.db.enrollmentRequests.create({ ...data, status:'pending' });
  }

  async updateUserRole(actor, userId, role) {
    const user = await this.db.users.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    const updated = await this.db.users.update(userId, { role });
    await this.audit.log(actor.id, 'USER_ROLE_UPDATED', 'users', userId, { role });
    return updated;
  }

  async createAbsenceJustification(actor, data) {
    const attendanceRecord = await this.db.studentAttendance.findById(data.attendanceRecordId);
    if (!attendanceRecord) throw new AppError('Attendance record not found', 404);
    const justification = await this.db.absenceJustifications.create({ ...data, status:'pending' });
    await this.audit.log(actor.id, 'ABSENCE_JUSTIFICATION_CREATED', 'absence_justifications', justification.id);
    return justification;
  }

  async reviewAbsenceJustification(actor, id, data) {
    const justification = await this.db.absenceJustifications.findById(id);
    if (!justification) throw new AppError('Absence justification not found', 404);
    const updated = await this.db.absenceJustifications.update(id, { ...data, reviewedBy:actor.id, reviewedAt:new Date().toISOString() });
    await this.audit.log(actor.id, 'ABSENCE_JUSTIFICATION_REVIEWED', 'absence_justifications', id, { status:data.status });
    return updated;
  }

  async createScholarshipEvaluation(actor, data) {
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
    return evaluation;
  }

  async createLevelPromotionEvaluation(actor, data) {
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
    return evaluation;
  }
}

module.exports = { AcademicService };
