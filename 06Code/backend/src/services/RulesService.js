const { AppError } = require('../exceptions/AppError');

class RulesService {
  constructor(db, attendanceService) {
    this.db = db;
    this.attendanceService = attendanceService;
  }

  async activeScholarshipRule(repository = this.db) {
    const rules = (await repository.scholarshipRules.all()).filter((rule) => rule.active !== false);
    const rule = rules[0] || {};
    return {
      minAttendancePercent:Number(rule.minAttendancePercent ?? 90),
      periodMonths:Number(rule.periodMonths ?? 2),
      minimumSessions:Number(rule.minimumSessions ?? 8),
    };
  }

  evaluationWindow(from, to, periodMonths) {
    const end = to ? new Date(to) : new Date();
    if (!to) end.setUTCHours(23, 59, 59, 999);
    const start = from ? new Date(from) : new Date(end);
    if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) {
      throw new AppError('Invalid evaluation date range', 422);
    }
    if (!from) start.setUTCMonth(start.getUTCMonth() - Math.max(1, periodMonths));
    if (start > end) throw new AppError('Evaluation start date must be before end date', 422);
    return { from:start.toISOString(), to:end.toISOString() };
  }

  async scholarshipCandidate(studentId, from, to, repository = this.db) {
    const student = await repository.students.findById(studentId);
    const rule = await this.activeScholarshipRule(repository);
    const window = this.evaluationWindow(from, to, rule.periodMonths);
    const metrics = await this.attendanceService.attendanceMetrics(studentId, window.from, window.to, repository);
    const threshold = rule.minAttendancePercent / 100;
    const candidate = Boolean(
      student
      && student.active !== false
      && metrics.countedSessions >= rule.minimumSessions
      && metrics.attendanceRate >= threshold,
    );
    return {
      studentId,
      ...metrics,
      candidate,
      from:window.from,
      to:window.to,
      requiredAttendanceRate:threshold,
      minimumSessions:rule.minimumSessions,
      periodMonths:rule.periodMonths,
      rule:`>= ${rule.minAttendancePercent}% attendance across at least ${rule.minimumSessions} counted finalized sessions; director evaluation required`,
    };
  }

  async promotionCandidate(studentId, from, to, repository = this.db) {
    const student = await repository.students.findById(studentId);
    const rule = await this.activeScholarshipRule(repository);
    const window = this.evaluationWindow(from, to, rule.periodMonths);
    const metrics = await this.attendanceService.attendanceMetrics(studentId, window.from, window.to, repository);
    const attendanceThreshold = 0.85;
    return {
      studentId,
      ...metrics,
      candidate:Boolean(
        student
        && student.active !== false
        && student.level === 'B1'
        && metrics.countedSessions >= rule.minimumSessions
        && metrics.attendanceRate >= attendanceThreshold,
      ),
      from:window.from,
      to:window.to,
      requiredAttendanceRate:attendanceThreshold,
      minimumSessions:rule.minimumSessions,
      rule:`active B1 student with >= 85% attendance across at least ${rule.minimumSessions} counted finalized sessions; consistency/theory/practice approval required`,
    };
  }

  async teacherPayment(teacherId, from = null, to = null) {
    const start = from ? new Date(from) : null;
    const end = to ? new Date(to) : null;
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      throw new AppError('Invalid payroll date range', 422);
    }
    if (start && end && start > end) throw new AppError('Payroll start date must be before end date', 422);
    if (start && end && end - start > 1095 * 24 * 60 * 60 * 1000) {
      throw new AppError('Payroll date range cannot exceed three years', 422);
    }
    const rows = (await this.db.teacherAttendance.all()).filter((row) => (
      row.teacherId === teacherId && row.checkInAt && row.checkOutAt
      && (!start || new Date(row.checkInAt) >= start)
      && (!end || new Date(row.checkInAt) <= end)
    ));
    const teacher = await this.db.teachers.findById(teacherId);
    const hourlyRate = teacher?.hourlyRate ?? 12.5;
    const breakdown = rows.map((row) => {
      const rawMinutes = Math.max(0, Math.round((new Date(row.checkOutAt) - new Date(row.checkInAt)) / 60000));
      const payableMinutes = row.payableMinutes === null || row.payableMinutes === undefined
        ? Math.min(rawMinutes, 720)
        : Math.max(0, Math.min(Number(row.payableMinutes), 720));
      const rate = Number(row.hourlyRateSnapshot ?? hourlyRate);
      return {
        attendanceRecordId:row.id,
        classSessionId:row.classSessionId || null,
        checkInAt:row.checkInAt,
        checkOutAt:row.checkOutAt,
        payableMinutes,
        hours:Number((payableMinutes / 60).toFixed(2)),
        hourlyRate:rate,
        amount:Number(((payableMinutes / 60) * rate).toFixed(2)),
        usesHistoricalRate:row.hourlyRateSnapshot !== null && row.hourlyRateSnapshot !== undefined,
      };
    });
    const totalMinutes = breakdown.reduce((sum, row) => sum + row.payableMinutes, 0);
    const amount = breakdown.reduce((sum, row) => sum + row.amount, 0);
    return {
      teacherId,
      from:start?.toISOString() || null,
      to:end?.toISOString() || null,
      hours:Number((totalMinutes / 60).toFixed(2)),
      hourlyRate:Number(hourlyRate),
      amount:Number(amount.toFixed(2)),
      records:breakdown.length,
      breakdown,
    };
  }
}

module.exports = { RulesService };
