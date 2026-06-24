const { ApiResponse } = require('../utils/ApiResponse');

class AcademicController {
  constructor(academicService, db) {
    this.academicService = academicService;
    this.db = db;
  }

  submitEnrollment = async (req, res) => ApiResponse.success(res, await this.academicService.submitEnrollmentRequest(req.body), 'Enrollment request received', 201);
  listEnrollmentRequests = async (req, res) => ApiResponse.success(res, await this.db.enrollmentRequests.all(), 'Enrollment requests');
  updateUserRole = async (req, res) => ApiResponse.success(res, await this.academicService.updateUserRole(req.sessionUser, req.params.id, req.body.role), 'User role updated');
  listAbsenceJustifications = async (req, res) => ApiResponse.success(res, await this.db.absenceJustifications.all(), 'Absence justifications');
  createAbsenceJustification = async (req, res) => ApiResponse.success(res, await this.academicService.createAbsenceJustification(req.sessionUser, req.body), 'Absence justification created', 201);
  reviewAbsenceJustification = async (req, res) => ApiResponse.success(res, await this.academicService.reviewAbsenceJustification(req.sessionUser, req.params.id, req.body), 'Absence justification reviewed');
  listScholarshipEvaluations = async (req, res) => ApiResponse.success(res, await this.db.scholarshipEvaluations.all(), 'Scholarship evaluations');
  createScholarshipEvaluation = async (req, res) => ApiResponse.success(res, await this.academicService.createScholarshipEvaluation(req.sessionUser, req.body), 'Scholarship evaluation registered', 201);
  listLevelPromotionEvaluations = async (req, res) => ApiResponse.success(res, await this.db.levelPromotionEvaluations.all(), 'Level promotion evaluations');
  createLevelPromotionEvaluation = async (req, res) => ApiResponse.success(res, await this.academicService.createLevelPromotionEvaluation(req.sessionUser, req.body), 'Level promotion evaluation registered', 201);
}

module.exports = { AcademicController };
