const { ApiResponse } = require('../utils/ApiResponse');

class ReportsController {
  constructor(db, rulesService, accessPolicy = null) {
    this.db = db;
    this.rulesService = rulesService;
    this.accessPolicy = accessPolicy;
  }

  branchSummary = async (req, res) => {
    const branches = this.accessPolicy
      ? await this.accessPolicy.filterList(req.sessionUser, 'branches', await this.db.branches.all())
      : await this.db.branches.all();
    const students = await this.db.students.all();

    return ApiResponse.success(res, {
      branches:branches.map((branch) => ({
        ...branch,
        activeStudents:students.filter((student) => student.branchId === branch.id && student.active).length,
      })),
    });
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
