const { ApiResponse } = require('../utils/ApiResponse');
const { actorCacheScope, setMemoryCacheHeaders } = require('../services/CacheService');

class ReportsController {
  constructor(db, rulesService, accessPolicy = null, cacheService = null) {
    this.db = db;
    this.rulesService = rulesService;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
  }

  money(value) {
    return Number(Number(value || 0).toFixed(2));
  }

  async visibleBranches(user) {
    return this.accessPolicy
      ? this.accessPolicy.filterList(user, 'branches', await this.db.branches.all())
      : this.db.branches.all();
  }

  async reportSource(user) {
    const branches = await this.visibleBranches(user);
    const branchIds = new Set(branches.map((branch) => branch.id));
    const students = (await this.db.students.all()).filter((student) => branchIds.has(student.branchId));
    const studentIds = new Set(students.map((student) => student.id));
    const payments = (await this.db.studentPayments.all()).filter((payment) => branchIds.has(payment.branchId) || studentIds.has(payment.studentId));
    const attendance = (await this.db.studentAttendance.all()).filter((record) => studentIds.has(record.studentId));
    const events = (await this.db.academyEvents.all()).filter((event) => branchIds.has(event.branchId) && event.active !== false);
    const classGroups = (await this.db.classGroups.all()).filter((group) => branchIds.has(group.branchId));
    return { branches, students, payments, attendance, events, classGroups };
  }

  attendanceRate(records) {
    if (!records.length) return 0;
    const positive = records.filter((record) => ['present', 'late', 'justified'].includes(record.status)).length;
    return Math.round((positive / records.length) * 100);
  }

  branchReport(branch, source) {
    const students = source.students.filter((student) => student.branchId === branch.id);
    const studentIds = new Set(students.map((student) => student.id));
    const payments = source.payments.filter((payment) => payment.branchId === branch.id || studentIds.has(payment.studentId));
    const attendance = source.attendance.filter((record) => studentIds.has(record.studentId));
    const events = source.events.filter((event) => event.branchId === branch.id);
    const paidPayments = payments.filter((payment) => payment.status === 'paid');
    const pendingPayments = payments.filter((payment) => ['pending', 'overdue'].includes(payment.status));
    const showIncome = events.reduce((sum, event) => sum + Number(event.showIncome || 0), 0);
    const tuitionIncome = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const pendingAmount = pendingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      id:branch.id,
      name:branch.name,
      city:branch.city,
      activeStudents:students.filter((student) => student.active !== false).length,
      retiredStudents:students.filter((student) => student.active === false).length,
      b1Students:students.filter((student) => student.level === 'B1' && student.active !== false).length,
      b2Students:students.filter((student) => student.level === 'B2' && student.active !== false).length,
      pendingPayments:pendingPayments.length,
      pendingAmount:this.money(pendingAmount),
      tuitionIncome:this.money(tuitionIncome),
      showIncome:this.money(showIncome),
      totalIncome:this.money(tuitionIncome + showIncome),
      attendanceRate:this.attendanceRate(attendance),
      events:events.length,
    };
  }

  async buildReport(user) {
    const source = await this.reportSource(user);
    const branches = source.branches.map((branch) => this.branchReport(branch, source));
    const totals = branches.reduce((summary, branch) => ({
      activeStudents:summary.activeStudents + branch.activeStudents,
      retiredStudents:summary.retiredStudents + branch.retiredStudents,
      b1Students:summary.b1Students + branch.b1Students,
      b2Students:summary.b2Students + branch.b2Students,
      pendingPayments:summary.pendingPayments + branch.pendingPayments,
      pendingAmount:this.money(summary.pendingAmount + branch.pendingAmount),
      tuitionIncome:this.money(summary.tuitionIncome + branch.tuitionIncome),
      showIncome:this.money(summary.showIncome + branch.showIncome),
      totalIncome:this.money(summary.totalIncome + branch.totalIncome),
      events:summary.events + branch.events,
    }), {
      activeStudents:0,
      retiredStudents:0,
      b1Students:0,
      b2Students:0,
      pendingPayments:0,
      pendingAmount:0,
      tuitionIncome:0,
      showIncome:0,
      totalIncome:0,
      events:0,
    });
    const allAttendance = source.attendance;
    return {
      generatedAt:new Date().toISOString(),
      totals:{
        ...totals,
        attendanceRate:this.attendanceRate(allAttendance),
      },
      branches,
    };
  }

  cachedReport = async (req, res, keySuffix, loader) => {
    if (this.cacheService) {
      const key = `reports:${keySuffix}:${actorCacheScope(req.sessionUser)}`;
      const result = await this.cacheService.remember(key, 30, ['reports', 'branches', 'students', 'student-payments', 'academy-events', 'attendance'], loader);
      setMemoryCacheHeaders(res, result, key);
      return ApiResponse.success(res, result.value);
    }
    res.set('X-Memory-Cache', 'BYPASS');
    return ApiResponse.success(res, await loader());
  };

  branchSummary = async (req, res) => {
    const loader = async () => {
      const report = await this.buildReport(req.sessionUser);
      return { branches:report.branches };
    };

    return this.cachedReport(req, res, 'branches:summary', loader);
  };

  generalReport = async (req, res) => {
    return this.cachedReport(req, res, 'general', () => this.buildReport(req.sessionUser));
  };

  branchDetail = async (req, res) => {
    const loader = async () => {
      const report = await this.buildReport(req.sessionUser);
      const branch = report.branches.find((item) => item.id === req.params.branchId);
      if (!branch) return null;
      return { generatedAt:report.generatedAt, branch };
    };
    const detail = await loader();
    if (!detail) return ApiResponse.error(res, 'Branch not found', 404);
    return this.cachedReport(req, res, `branches:${req.params.branchId}:detail`, () => detail);
  };

  scholarshipCandidate = async (req, res) => {
    const student = await this.db.students.findById(req.params.studentId);
    if (!student) return ApiResponse.error(res, 'Student not found', 404);
    if (this.accessPolicy) {
      await this.accessPolicy.assertCanRead(req.sessionUser, 'students', student);
    }
    return ApiResponse.success(res, await this.rulesService.scholarshipCandidate(req.params.studentId, req.query.from, req.query.to));
  };

  promotionCandidate = async (req, res) => {
    const student = await this.db.students.findById(req.params.studentId);
    if (!student) return ApiResponse.error(res, 'Student not found', 404);
    if (this.accessPolicy) {
      await this.accessPolicy.assertCanRead(req.sessionUser, 'students', student);
    }
    return ApiResponse.success(res, await this.rulesService.promotionCandidate(req.params.studentId, req.query.from, req.query.to));
  };

  teacherPayment = async (req, res) => {
    const teacher = await this.db.teachers.findById(req.params.teacherId);
    if (!teacher) return ApiResponse.error(res, 'Teacher not found', 404);
    if (this.accessPolicy) {
      await this.accessPolicy.assertCanRead(req.sessionUser, 'teachers', teacher);
    }
    return ApiResponse.success(res, await this.rulesService.teacherPayment(req.params.teacherId));
  };
}

module.exports = { ReportsController };
