const express = require('express');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { z, attendanceRecord, teacherCheck, roleUpdate, branchAccessUpdate, enrollmentRequest, absenceJustification, absenceReview, scholarshipEvaluation, levelPromotionEvaluation, branch, student, teacher, danceCategory, danceStyle, classGroup, classSession } = require('../validators/commonValidators');
const { validate } = require('../middleware/validate');
const { requireAuth, allowRoles } = require('../middleware/auth');
const { noStore, publicCache, privateCache } = require('../middleware/cacheControl');
const { Roles } = require('../models/constants');
const { setMemoryCacheHeaders } = require('../services/CacheService');
const { AuthController } = require('../controllers/AuthController');
const { CrudController } = require('../controllers/CrudController');
const { AttendanceController } = require('../controllers/AttendanceController');
const { ReportsController } = require('../controllers/ReportsController');
const { AcademicController } = require('../controllers/AcademicController');

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

function registerCrud(router, name, repository, schema, accessPolicy, cacheService) {
  const controller = new CrudController(repository, name, accessPolicy, cacheService);
  const policy = crudCachePolicy[name];
  const indexMiddlewares = policy ? [privateCache(policy.ttlSeconds, policy.policy)] : [];
  router.get(`/${name}`, requireAuth, ...indexMiddlewares, wrap(controller.index));
  router.get(`/${name}/:id`, requireAuth, wrap(controller.show));
  router.post(`/${name}`, allowRoles(...writeRoles), validate(schema), wrap(controller.create));
  router.patch(`/${name}/:id`, allowRoles(...writeRoles), validate(schema.partial()), wrap(controller.update));
}

function buildApi(deps) {
  const router = express.Router();
  const auth = new AuthController(deps.authService);
  const attendance = new AttendanceController(deps.attendanceService);
  const reports = new ReportsController(deps.db, deps.rulesService, deps.accessPolicy, deps.cacheService);
  const academic = new AcademicController(deps.academicService, deps.db);
  const authLimiter = rateLimit({ windowMs: 15*60*1000, max: env.authRateLimitMax });

  router.use(noStore);

  router.get('/auth/config', publicCache(3600, 'public-auth-config'), wrap(auth.config));
  router.post('/auth/login', authLimiter, validate(z.object({ email:z.string().email(), password:z.string().min(8).max(120) })), wrap(auth.passwordLogin));
  router.post('/auth/google', authLimiter, validate(z.object({ idToken:z.string().min(10) })), wrap(auth.login));
  router.get('/auth/me', requireAuth, wrap(auth.me));
  router.post('/auth/logout', wrap(auth.logout));

  router.post('/enrollment-requests', validate(enrollmentRequest), wrap(academic.submitEnrollment));
  router.get('/enrollment-requests', allowRoles(...directorRoles), wrap(academic.listEnrollmentRequests));

  router.get('/users', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), wrap(async (req, res) => res.json({ success:true, message:'Users list', data:publicUsers(await deps.db.users.all()) })));
  router.patch('/users/:id/role', allowRoles(Roles.ADMIN), validate(roleUpdate), wrap(academic.updateUserRole));
  router.get('/users/:id/branch-access', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), wrap(academic.listUserBranchAccess));
  router.patch('/users/:id/branch-access', allowRoles(Roles.ADMIN), validate(branchAccessUpdate), wrap(academic.updateUserBranchAccess));
  router.get('/roles', requireAuth, privateCache(1800, 'private-reference-roles'), wrap(async (req, res) => res.json({
    success:true,
    message:'Roles list',
    data:await cachedList(req, res, deps.cacheService, 'catalog:roles:all', 1800, ['roles'], () => deps.db.roles.all()),
  })));
  router.get('/permissions', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), privateCache(1800, 'private-reference-permissions'), wrap(async (req, res) => res.json({
    success:true,
    message:'Permissions list',
    data:await cachedList(req, res, deps.cacheService, 'catalog:permissions:all', 1800, ['permissions'], () => deps.db.permissions.all()),
  })));

  registerCrud(router, 'branches', deps.db.branches, branch, deps.accessPolicy, deps.cacheService);
  registerCrud(router, 'students', deps.db.students, student, deps.accessPolicy, deps.cacheService);
  registerCrud(router, 'teachers', deps.db.teachers, teacher, deps.accessPolicy, deps.cacheService);
  registerCrud(router, 'dance-categories', deps.db.danceCategories, danceCategory, deps.accessPolicy, deps.cacheService);
  registerCrud(router, 'dance-styles', deps.db.danceStyles, danceStyle, deps.accessPolicy, deps.cacheService);
  registerCrud(router, 'class-groups', deps.db.classGroups, classGroup, deps.accessPolicy, deps.cacheService);
  registerCrud(router, 'class-sessions', deps.db.classSessions, classSession, deps.accessPolicy, deps.cacheService);

  router.post('/student-attendance', allowRoles(...teacherAttendanceRoles), validate(attendanceRecord), wrap(attendance.recordStudent));
  router.post('/teacher-attendance/check-in', allowRoles(...teacherAttendanceRoles), validate(teacherCheck), wrap(attendance.teacherCheckIn));
  router.patch('/teacher-attendance/:id/check-out', allowRoles(...teacherAttendanceRoles), wrap(attendance.teacherCheckOut));

  router.get('/absence-justifications', allowRoles(...directorRoles), wrap(academic.listAbsenceJustifications));
  router.post('/absence-justifications', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR, Roles.TEACHER, Roles.STUDENT), validate(absenceJustification), wrap(academic.createAbsenceJustification));
  router.patch('/absence-justifications/:id/review', allowRoles(...directorRoles), validate(absenceReview), wrap(academic.reviewAbsenceJustification));

  router.get('/reports/branches/summary', allowRoles(...directorRoles), privateCache(30, 'private-scoped-report-cache'), wrap(reports.branchSummary));
  router.get('/reports/scholarships/:studentId/candidate', allowRoles(...directorRoles), wrap(reports.scholarshipCandidate));
  router.get('/reports/level-promotions/:studentId/candidate', allowRoles(...directorRoles), wrap(reports.promotionCandidate));
  router.get('/reports/teachers/:teacherId/payment', allowRoles(...directorRoles), wrap(reports.teacherPayment));

  router.get('/scholarship-evaluations', allowRoles(...directorRoles), wrap(academic.listScholarshipEvaluations));
  router.post('/scholarship-evaluations', allowRoles(...directorRoles), validate(scholarshipEvaluation), wrap(academic.createScholarshipEvaluation));
  router.get('/level-promotion-evaluations', allowRoles(...directorRoles), wrap(academic.listLevelPromotionEvaluations));
  router.post('/level-promotion-evaluations', allowRoles(...directorRoles), validate(levelPromotionEvaluation), wrap(academic.createLevelPromotionEvaluation));

  router.get('/audit-logs', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), wrap(async (req, res) => res.json({success:true,message:'Audit logs',data:await deps.db.auditLogs.all()})));
  return router;
}

module.exports = { buildApi };
