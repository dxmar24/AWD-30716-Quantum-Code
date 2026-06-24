const { ApiResponse } = require('../utils/ApiResponse');
class ReportsController {
  constructor(db, rulesService) { this.db = db; this.rulesService = rulesService; }
  branchSummary = async (req, res) => { const branches = await this.db.branches.all(); const students = await this.db.students.all(); return ApiResponse.success(res, { branches:branches.map((b) => ({ ...b, activeStudents:students.filter((s) => s.branchId === b.id && s.active).length })) }); };
  scholarshipCandidate = async (req, res) => ApiResponse.success(res, await this.rulesService.scholarshipCandidate(req.params.studentId, req.query.from, req.query.to));
  promotionCandidate = async (req, res) => ApiResponse.success(res, await this.rulesService.promotionCandidate(req.params.studentId, req.query.from, req.query.to));
  teacherPayment = async (req, res) => ApiResponse.success(res, await this.rulesService.teacherPayment(req.params.teacherId));
}
module.exports = { ReportsController };
