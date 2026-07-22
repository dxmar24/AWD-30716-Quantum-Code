const { ApiResponse } = require('../utils/ApiResponse');

class AcademicController {
  constructor(academicService, db) {
    this.academicService = academicService;
    this.db = db;
  }

  submitEnrollment = async (req, res) => ApiResponse.success(res, await this.academicService.submitEnrollmentRequest(req.body), 'Enrollment request received', 201);
  listEnrollmentRequests = async (req, res) => ApiResponse.success(res, await this.academicService.listEnrollmentRequests(req.sessionUser), 'Enrollment requests');
  updateEnrollmentRequestStatus = async (req, res) => ApiResponse.success(res, await this.academicService.updateEnrollmentRequestStatus(req.sessionUser, req.params.id, req.body), 'Enrollment request updated');
  createUser = async (req, res) => ApiResponse.success(res, await this.academicService.createAcademicUser(req.sessionUser, req.body), 'User created', 201);
  updateUserRole = async (req, res) => ApiResponse.success(res, await this.academicService.updateUserRole(req.sessionUser, req.params.id, req.body.role), 'User role updated');
  updateUserStatus = async (req, res) => ApiResponse.success(res, await this.academicService.updateUserStatus(req.sessionUser, req.params.id, req.body.active), 'User status updated');
  resetUserPassword = async (req, res) => ApiResponse.success(res, await this.academicService.resetUserPassword(req.sessionUser, req.params.id), 'Access email sent');
  resendUserInvitation = async (req, res) => ApiResponse.success(res, await this.academicService.resendUserInvitation(req.sessionUser, req.params.id), 'Invitation email sent');
  listUserBranchAccess = async (req, res) => ApiResponse.success(res, await this.academicService.listUserBranchAccess(req.params.id), 'User branch access');
  updateUserBranchAccess = async (req, res) => ApiResponse.success(res, await this.academicService.updateUserBranchAccess(req.sessionUser, req.params.id, req.body.branchIds), 'User branch access updated');
  listAbsenceJustifications = async (req, res) => ApiResponse.success(res, await this.academicService.listAbsenceJustifications(req.sessionUser), 'Absence justifications');
  createAbsenceJustification = async (req, res) => ApiResponse.success(
    res,
    await this.academicService.createAbsenceJustification(req.sessionUser, req.body, req.file),
    'Absence justification created',
    201,
  );
  getAbsenceEvidence = async (req, res) => {
    const evidence = await this.academicService.getAbsenceJustificationEvidence(req.sessionUser, req.params.id);
    const encodedName = encodeURIComponent(evidence.originalName).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    res.set({
      'Cache-Control':'private, no-store, max-age=0',
      'Content-Disposition':`inline; filename="evidencia-alc"; filename*=UTF-8''${encodedName}`,
      'Content-Length':String(evidence.content.length),
      'X-Content-Type-Options':'nosniff',
    });
    res.type(evidence.mimeType);
    return res.send(evidence.content);
  };
  reviewAbsenceJustification = async (req, res) => ApiResponse.success(res, await this.academicService.reviewAbsenceJustification(req.sessionUser, req.params.id, req.body), 'Absence justification reviewed');
  listScholarshipEvaluations = async (req, res) => ApiResponse.success(res, await this.academicService.listScholarshipEvaluations(req.sessionUser), 'Scholarship evaluations');
  createScholarshipEvaluation = async (req, res) => ApiResponse.success(res, await this.academicService.createScholarshipEvaluation(req.sessionUser, req.body), 'Scholarship evaluation registered', 201);
  listLevelPromotionEvaluations = async (req, res) => ApiResponse.success(res, await this.academicService.listLevelPromotionEvaluations(req.sessionUser), 'Level promotion evaluations');
  createLevelPromotionEvaluation = async (req, res) => ApiResponse.success(res, await this.academicService.createLevelPromotionEvaluation(req.sessionUser, req.body), 'Level promotion evaluation registered', 201);
}

module.exports = { AcademicController };
