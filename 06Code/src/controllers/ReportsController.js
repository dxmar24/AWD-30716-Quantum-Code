const { ApiResponse } = require('../utils/ApiResponse');
const { actorCacheScope, setMemoryCacheHeaders } = require('../services/CacheService');
const { buildAcademicReport } = require('../functional/reportMetrics');

class ReportsController {
  constructor(db, rulesService, accessPolicy = null, cacheService = null) {
    this.db = db;
    this.rulesService = rulesService;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
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

  async buildReport(user) {
    const source = await this.reportSource(user);
    return buildAcademicReport(source);
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
