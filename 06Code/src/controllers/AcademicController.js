const { ApiResponse } = require('../utils/ApiResponse');

class AcademicController {
  constructor(academicService, db) {
    this.academicService = academicService;
    this.db = db;
  }

  submitEnrollment = async (req, res) => ApiResponse.success(res, await this.academicService.submitEnrollmentRequest(req.body), 'Enrollment request received', 201);
  listEnrollmentRequests = async (req, res) => ApiResponse.success(res, await this.academicService.listEnrollmentRequests(req.sessionUser), 'Enrollment requests');
  updateUserRole = async (req, res) => ApiResponse.success(res, await this.academicService.updateUserRole(req.sessionUser, req.params.id, req.body.role), 'User role updated');
  listUserBranchAccess = async (req, res) => ApiResponse.success(res, await this.academicService.listUserBranchAccess(req.params.id), 'User branch access');
  updateUserBranchAccess = async (req, res) => ApiResponse.success(res, await this.academicService.updateUserBranchAccess(req.sessionUser, req.params.id, req.body.branchIds), 'User branch access updated');
  listAbsenceJustifications = async (req, res) => ApiResponse.success(res, await this.academicService.listAbsenceJustifications(req.sessionUser), 'Absence justifications');
  createAbsenceJustification = async (req, res) => ApiResponse.success(res, await this.academicService.createAbsenceJustification(req.sessionUser, req.body), 'Absence justification created', 201);
  reviewAbsenceJustification = async (req, res) => ApiResponse.success(res, await this.academicService.reviewAbsenceJustification(req.sessionUser, req.params.id, req.body), 'Absence justification reviewed');
  listScholarshipEvaluations = async (req, res) => ApiResponse.success(res, await this.academicService.listScholarshipEvaluations(req.sessionUser), 'Scholarship evaluations');
  createScholarshipEvaluation = async (req, res) => ApiResponse.success(res, await this.academicService.createScholarshipEvaluation(req.sessionUser, req.body), 'Scholarship evaluation registered', 201);
  listLevelPromotionEvaluations = async (req, res) => ApiResponse.success(res, await this.academicService.listLevelPromotionEvaluations(req.sessionUser), 'Level promotion evaluations');
  createLevelPromotionEvaluation = async (req, res) => ApiResponse.success(res, await this.academicService.createLevelPromotionEvaluation(req.sessionUser, req.body), 'Level promotion evaluation registered', 201);
}

module.exports = { AcademicController };
