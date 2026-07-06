const { ApiResponse } = require('../utils/ApiResponse');
const { actorCacheScope, setMemoryCacheHeaders } = require('../services/CacheService');

class ReportsController {
  constructor(db, rulesService, accessPolicy = null, cacheService = null) {
    this.db = db;
    this.rulesService = rulesService;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
  }

  branchSummary = async (req, res) => {
    const loader = async () => {
      const branches = this.accessPolicy
        ? await this.accessPolicy.filterList(req.sessionUser, 'branches', await this.db.branches.all())
        : await this.db.branches.all();
      const students = await this.db.students.all();

      return {
        branches:branches.map((branch) => ({
          ...branch,
          activeStudents:students.filter((student) => student.branchId === branch.id && student.active).length,
        })),
      };
    };

    if (this.cacheService) {
      const key = `reports:branches:summary:${actorCacheScope(req.sessionUser)}`;
      const result = await this.cacheService.remember(key, 30, ['reports', 'branches', 'students'], loader);
      setMemoryCacheHeaders(res, result, key);
      return ApiResponse.success(res, result.value);
    }

    res.set('X-Memory-Cache', 'BYPASS');
    return ApiResponse.success(res, await loader());
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
