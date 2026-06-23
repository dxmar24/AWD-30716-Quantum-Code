const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('../validators/commonValidators');
const { validate } = require('../middleware/validate');
const { requireAuth, allowRoles } = require('../middleware/auth');
const { Roles } = require('../models/constants');
const { attendanceRecord, teacherCheck } = require('../validators/commonValidators');
const { AuthController } = require('../controllers/AuthController');
const { CrudController } = require('../controllers/CrudController');
const { AttendanceController } = require('../controllers/AttendanceController');
const { ReportsController } = require('../controllers/ReportsController');
function buildApi(deps) { const router = express.Router(); const auth = new AuthController(deps.authService); const attendance = new AttendanceController(deps.attendanceService); const reports = new ReportsController(deps.db, deps.rulesService); const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20 });
router.post('/auth/google', authLimiter, validate(z.object({ idToken:z.string().min(10) })), auth.login); router.get('/auth/me', requireAuth, auth.me); router.post('/auth/logout', auth.logout);
[['branches',deps.db.branches],['students',deps.db.students],['teachers',deps.db.teachers],['class-groups',deps.db.classGroups],['class-sessions',deps.db.classSessions]].forEach(([name, repo]) => { const c = new CrudController(repo, name); router.get(`/${name}`, requireAuth, c.index); router.get(`/${name}/:id`, requireAuth, c.show); router.post(`/${name}`, allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR), c.create); });
router.post('/student-attendance', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR, Roles.TEACHER), validate(attendanceRecord), attendance.recordStudent);
router.post('/teacher-attendance/check-in', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR, Roles.TEACHER), validate(teacherCheck), attendance.teacherCheckIn); router.patch('/teacher-attendance/:id/check-out', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR, Roles.TEACHER), attendance.teacherCheckOut);
router.get('/reports/branches/summary', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), reports.branchSummary); router.get('/reports/scholarships/:studentId/candidate', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR), reports.scholarshipCandidate); router.get('/reports/teachers/:teacherId/payment', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR, Roles.BRANCH_DIRECTOR), reports.teacherPayment); router.get('/audit-logs', allowRoles(Roles.ADMIN, Roles.GENERAL_DIRECTOR), (req,res)=>res.json({success:true,message:'Audit logs',data:deps.db.auditLogs.all()})); return router; }
module.exports = { buildApi };
