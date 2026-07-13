const express = require('express');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { z, attendanceRecord, teacherCheck, roleUpdate, accountCreate, passwordChange, branchAccessUpdate, enrollmentRequest, enrollmentRequestStatus, absenceJustification, absenceReview, scholarshipEvaluation, levelPromotionEvaluation, branch, student, studentPhoto, teacher, danceCategory, danceStyle, classGroup, classSession, classSessionUpdate, classGroupEnrollment, classGroupEnrollmentUpdate, sessionAttendanceBatch, academyEvent, academyEventUpdate, studentPayment, studentPaymentUpdate, paymentReversal } = require('../validators/commonValidators');
const { validate } = require('../middleware/validate');
const { requireAuth, requirePasswordReady, allowRoles } = require('../middleware/auth');
const { noStore, publicCache, privateCache } = require('../middleware/cacheControl');
const { Roles } = require('../models/constants');
const { setMemoryCacheHeaders } = require('../services/CacheService');
const { AuthController } = require('../controllers/AuthController');
const { CrudController } = require('../controllers/CrudController');
const { AttendanceController } = require('../controllers/AttendanceController');
const { ReportsController } = require('../controllers/ReportsController');
const { AcademicController } = require('../controllers/AcademicController');
const { FinancialController } = require('../controllers/FinancialController');
const { AuditController } = require('../controllers/AuditController');
const { withRequestAuditContext } = require('../utils/requestAuditContext');

const writeRoles = [Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR];
const directorRoles = [Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR];
const teacherAttendanceRoles = [Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR, Roles.TEACHER];
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const publicUsers = (users) => users.map(({ passwordHash, ...user }) => user);
const crudCachePolicy = {
  branches:{ ttlSeconds:300, policy:'private-reference-branches' },
  'dance-categories':{ ttlSeconds:600, policy:'private-reference-dance-categories' },
  'dance-styles':{ ttlSeconds:600, policy:'private-reference-dance-styles' },
};

async function cachedList(req, res, cacheService, key, ttlSeconds, tags, loader) {
  if (!cacheService) {
    res.set('X-Memory-Cache', 'BYPASS');
    return loader();
  }
  const result = await cacheService.remember(key, ttlSeconds, tags, loader);
  setMemoryCacheHeaders(res, result, key);
  return result.value;
}

function registerCrud(router, name, repository, schema, accessPolicy, cacheService, auditService, dbContext, updateSchema = null) {
  const controller = new CrudController(repository, name, accessPolicy, cacheService, auditService, dbContext);
  const policy = crudCachePolicy[name];
  const indexMiddlewares = policy ? [privateCache(policy.ttlSeconds, policy.policy)] : [];
  router.get(`/${name}`, requireAuth, requirePasswordReady, ...indexMiddlewares, wrap(controller.index));
  router.get(`/${name}/:id`, requireAuth, requirePasswordReady, wrap(controller.show));
  router.post(`/${name}`, allowRoles(...writeRoles), validate(schema), wrap(controller.create));
  router.patch(`/${name}/:id`, allowRoles(...writeRoles), validate(updateSchema || schema.partial()), wrap(controller.update));
}

function buildApi(deps) {
  const router = express.Router();
  const auth = new AuthController(deps.authService);
  const attendance = new AttendanceController(deps.attendanceService);
  const reports = new ReportsController(deps.db, deps.rulesService, deps.accessPolicy, deps.cacheService);
  const academic = new AcademicController(deps.academicService, deps.db);
  const financial = new FinancialController(deps.financialService);
  const audit = new AuditController(deps.db);
  const mutate = (work) => (deps.db.transaction ? deps.db.transaction(work) : work(deps.db));
  const authLimiter = rateLimit({ windowMs: 15*60*1000, max: env.authRateLimitMax });
  const enrollmentLimiter = rateLimit({ windowMs: 60*60*1000, max: 20 });

  router.use(noStore);

  // Keep health responses deliberately small and free of infrastructure details.
  // Liveness only proves the process can answer; readiness also verifies that the
  // configured persistence layer is reachable before a load balancer sends traffic.
  router.get('/health/live', (req, res) => res.json({
    success:true,
    status:'ok',
    service:'american-latin-class-api',
    timestamp:new Date().toISOString(),
    requestId:req.id,
  }));
  router.get('/health/ready', wrap(async (req, res) => {
    try {
      await deps.db.roles.all();
      return res.json({
        success:true,
        status:'ready',
        dependencies:{ database:'up' },
        timestamp:new Date().toISOString(),
        requestId:req.id,
      });
    } catch (_error) {
      return res.status(503).json({
        success:false,
        status:'not_ready',
        dependencies:{ database:'down' },
        timestamp:new Date().toISOString(),
        requestId:req.id,
      });
    }
  }));

  router.get('/auth/config', publicCache(3600, 'public-auth-config'), wrap(auth.config));
  router.post('/auth/login', authLimiter, validate(z.object({ email:z.string().email(), password:z.string().min(8).max(120) })), wrap(auth.passwordLogin));
  router.post('/auth/google', authLimiter, validate(z.object({ idToken:z.string().min(10) })), wrap(auth.login));
  router.get('/auth/me', requireAuth, wrap(auth.me));
  router.post('/auth/change-password', requireAuth, validate(passwordChange), wrap(auth.changePassword));
  router.post('/auth/logout', wrap(auth.logout));

  router.get('/public/branches', publicCache(300, 'public-branches'), wrap(async (req, res) => res.json({
    success:true,
    message:'Public branches list',
    data:await cachedList(req, res, deps.cacheService, 'public:branches:active', 300, ['branches'], async () => (
      (await deps.db.branches.all())
        .filter((branch) => branch.active !== false)
        .map(({ id, name, city }) => ({ id, name, city }))
    )),
  })));
  router.post('/enrollment-requests', enrollmentLimiter, validate(enrollmentRequest), wrap(academic.submitEnrollment));
  router.get('/enrollment-requests', allowRoles(...directorRoles), wrap(academic.listEnrollmentRequests));
  router.patch('/enrollment-requests/:id/status', allowRoles(...directorRoles), validate(enrollmentRequestStatus), wrap(academic.updateEnrollmentRequestStatus));

  router.get('/users', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), wrap(async (req, res) => res.json({ success:true, message:'Users list', data:publicUsers(await deps.db.users.all()) })));
  router.post('/users', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), validate(accountCreate), wrap(academic.createUser));
  router.patch('/users/:id/role', allowRoles(Roles.ADMIN), validate(roleUpdate), wrap(academic.updateUserRole));
  router.get('/users/:id/branch-access', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), wrap(academic.listUserBranchAccess));
  router.patch('/users/:id/branch-access', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), validate(branchAccessUpdate), wrap(academic.updateUserBranchAccess));
  router.get('/roles', requireAuth, requirePasswordReady, privateCache(1800, 'private-reference-roles'), wrap(async (req, res) => res.json({
    success:true,
    message:'Roles list',
    data:await cachedList(req, res, deps.cacheService, 'catalog:roles:all', 1800, ['roles'], () => deps.db.roles.all()),
  })));
  router.get('/permissions', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), privateCache(1800, 'private-reference-permissions'), wrap(async (req, res) => res.json({
    success:true,
    message:'Permissions list',
    data:await cachedList(req, res, deps.cacheService, 'catalog:permissions:all', 1800, ['permissions'], () => deps.db.permissions.all()),
  })));

  registerCrud(router, 'branches', deps.db.branches, branch, deps.accessPolicy, deps.cacheService, deps.auditService, deps.db);
  registerCrud(router, 'students', deps.db.students, student, deps.accessPolicy, deps.cacheService, deps.auditService, deps.db);
  registerCrud(router, 'teachers', deps.db.teachers, teacher, deps.accessPolicy, deps.cacheService, deps.auditService, deps.db);
  registerCrud(router, 'dance-categories', deps.db.danceCategories, danceCategory, deps.accessPolicy, deps.cacheService, deps.auditService, deps.db);
  registerCrud(router, 'dance-styles', deps.db.danceStyles, danceStyle, deps.accessPolicy, deps.cacheService, deps.auditService, deps.db);
  registerCrud(router, 'class-groups', deps.db.classGroups, classGroup, deps.accessPolicy, deps.cacheService, deps.auditService, deps.db);
  registerCrud(router, 'class-sessions', deps.db.classSessions, classSession, deps.accessPolicy, deps.cacheService, deps.auditService, deps.db, classSessionUpdate);
  registerCrud(router, 'academy-events', deps.db.academyEvents, academyEvent, deps.accessPolicy, deps.cacheService, deps.auditService, deps.db, academyEventUpdate);

  router.get('/student-payments', requireAuth, requirePasswordReady, wrap(financial.index));
  router.get('/student-payments/:id', requireAuth, requirePasswordReady, wrap(financial.show));
  router.post('/student-payments', allowRoles(...writeRoles), validate(studentPayment), wrap(financial.create));
  router.patch('/student-payments/:id', allowRoles(...writeRoles), validate(studentPaymentUpdate), wrap(financial.update));
  router.post('/student-payments/:id/reversal', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), validate(paymentReversal), wrap(financial.reverse));

  router.get('/class-group-enrollments', requireAuth, requirePasswordReady, wrap(attendance.listEnrollments));
  router.post('/class-group-enrollments', allowRoles(...directorRoles), validate(classGroupEnrollment), wrap(attendance.createEnrollment));
  router.patch('/class-group-enrollments/:id', allowRoles(...directorRoles), validate(classGroupEnrollmentUpdate), wrap(attendance.updateEnrollment));
  router.get('/class-sessions/:id/roster', allowRoles(...teacherAttendanceRoles), wrap(attendance.sessionRoster));
  router.put('/class-sessions/:id/attendance', allowRoles(...teacherAttendanceRoles), validate(sessionAttendanceBatch), wrap(attendance.sessionAttendance));

  router.patch('/students/me/profile-photo', allowRoles(Roles.STUDENT), validate(studentPhoto), wrap(async (req, res) => {
    const updated = await mutate(async (db) => {
      const profile = await db.students.findBy('userId', req.sessionUser.id);
      if (!profile) return null;
      const row = await db.students.update(profile.id, {
        profilePhotoUrl:req.body.profilePhotoUrl,
        profilePhotoUpdatedAt:new Date().toISOString(),
      });
      await db.auditLogs.create({
        actorUserId:req.sessionUser.id,
        action:'STUDENT_PROFILE_PHOTO_UPDATED',
        entity:'students',
        entityId:profile.id,
        metadata:withRequestAuditContext({ hadPreviousPhoto:Boolean(profile.profilePhotoUrl), hasPhoto:true }),
      });
      return row;
    });
    if (!updated) return res.status(404).json({ success:false, message:'Student profile not found' });
    if (deps.cacheService) deps.cacheService.invalidateTags(['students']);
    return res.json({ success:true, message:'Profile photo updated', data:updated });
  }));

  router.delete('/students/me/profile-photo', allowRoles(Roles.STUDENT), wrap(async (req, res) => {
    const updated = await mutate(async (db) => {
      const profile = await db.students.findBy('userId', req.sessionUser.id);
      if (!profile) return null;
      const row = await db.students.update(profile.id, {
        profilePhotoUrl:null,
        profilePhotoUpdatedAt:new Date().toISOString(),
      });
      await db.auditLogs.create({
        actorUserId:req.sessionUser.id,
        action:'STUDENT_PROFILE_PHOTO_REMOVED',
        entity:'students',
        entityId:profile.id,
        metadata:withRequestAuditContext({ hadPhoto:Boolean(profile.profilePhotoUrl) }),
      });
      return row;
    });
    if (!updated) return res.status(404).json({ success:false, message:'Student profile not found' });
    if (deps.cacheService) deps.cacheService.invalidateTags(['students']);
    return res.json({ success:true, message:'Profile photo removed', data:updated });
  }));

  router.delete('/academy-events/:id', allowRoles(...writeRoles), wrap(async (req, res) => {
    const updated = await mutate(async (db) => {
      const event = await db.academyEvents.findById(req.params.id);
      if (!event) return null;
      const policy = deps.accessPolicy ? new deps.accessPolicy.constructor(db) : null;
      if (policy) await policy.assertCanUpdate(req.sessionUser, 'academy-events', event, { active:false });
      const row = await db.academyEvents.update(req.params.id, { active:false });
      await db.auditLogs.create({
        actorUserId:req.sessionUser.id,
        action:'ACADEMY_EVENT_REMOVED',
        entity:'academy-events',
        entityId:event.id,
        metadata:withRequestAuditContext({ before:event, after:row }),
      });
      return row;
    });
    if (!updated) return res.status(404).json({ success:false, message:'Academy event not found' });
    if (deps.cacheService) deps.cacheService.invalidateTags(['academy-events', 'reports']);
    return res.json({ success:true, message:'Academy event removed', data:updated });
  }));

  router.get('/student-attendance', requireAuth, requirePasswordReady, wrap(async (req, res) => {
    const rows = await deps.db.studentAttendance.all();
    const data = deps.accessPolicy ? await deps.accessPolicy.filterList(req.sessionUser, 'student-attendance', rows) : rows;
    return res.json({ success:true, message:'Student attendance list', data });
  }));
  router.post('/student-attendance', allowRoles(...teacherAttendanceRoles), validate(attendanceRecord), wrap(attendance.recordStudent));
  router.get('/teacher-attendance', allowRoles(...teacherAttendanceRoles), wrap(attendance.listTeacherAttendance));
  router.post('/teacher-attendance/check-in', allowRoles(...teacherAttendanceRoles), validate(teacherCheck), wrap(attendance.teacherCheckIn));
  router.patch('/teacher-attendance/:id/check-out', allowRoles(...teacherAttendanceRoles), wrap(attendance.teacherCheckOut));

  router.get('/absence-justifications', requireAuth, requirePasswordReady, wrap(academic.listAbsenceJustifications));
  router.post('/absence-justifications', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR, Roles.TEACHER, Roles.STUDENT), validate(absenceJustification), wrap(academic.createAbsenceJustification));
  router.patch('/absence-justifications/:id/review', allowRoles(...directorRoles), validate(absenceReview), wrap(academic.reviewAbsenceJustification));

  router.get('/reports/branches/summary', allowRoles(...directorRoles), privateCache(30, 'private-scoped-report-cache'), wrap(reports.branchSummary));
  router.get('/reports/general', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), privateCache(30, 'private-scoped-report-cache'), wrap(reports.generalReport));
  router.get('/reports/branches/:branchId/detail', allowRoles(...directorRoles), privateCache(30, 'private-scoped-report-cache'), wrap(reports.branchDetail));
  router.get('/reports/scholarships/:studentId/candidate', allowRoles(...directorRoles), wrap(reports.scholarshipCandidate));
  router.get('/reports/level-promotions/:studentId/candidate', allowRoles(...directorRoles), wrap(reports.promotionCandidate));
  router.get('/reports/teachers/:teacherId/payment', allowRoles(...directorRoles), wrap(reports.teacherPayment));

  router.get('/scholarship-evaluations', allowRoles(...directorRoles), wrap(academic.listScholarshipEvaluations));
  router.post('/scholarship-evaluations', allowRoles(...directorRoles), validate(scholarshipEvaluation), wrap(academic.createScholarshipEvaluation));
  router.get('/level-promotion-evaluations', allowRoles(...directorRoles), wrap(academic.listLevelPromotionEvaluations));
  router.post('/level-promotion-evaluations', allowRoles(...directorRoles), validate(levelPromotionEvaluation), wrap(academic.createLevelPromotionEvaluation));

  router.get('/audit-logs', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), wrap(audit.index));
  router.use((req, res) => res.status(404).json({
    success:false,
    message:'API route not found',
    requestId:req.id,
  }));
  return router;
}

module.exports = { buildApi };
