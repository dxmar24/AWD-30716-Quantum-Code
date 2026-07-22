const { ApiResponse } = require('../utils/ApiResponse');
const { AppError } = require('../exceptions/AppError');
const { actorCacheScope, setMemoryCacheHeaders } = require('../services/CacheService');
const { buildAcademicReport, buildAttendanceReport } = require('../functional/reportMetrics');

const MAX_REPORT_RANGE_DAYS = 1095;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPORT_LEVELS = new Set(['B1', 'B2']);
const PAYMENT_STATUSES = new Set(['paid', 'pending', 'overdue', 'cancelled']);
const ATTENDANCE_STATUSES = new Set(['present', 'late', 'absent', 'justified']);

function reportPeriod(query = {}) {
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (from && Number.isNaN(from.getTime())) throw new AppError('Invalid report start date', 422);
  if (to && Number.isNaN(to.getTime())) throw new AppError('Invalid report end date', 422);
  if (from && to && from > to) throw new AppError('Report start date must be before end date', 422);
  if (from && to && (to - from) / 86400000 > MAX_REPORT_RANGE_DAYS) {
    throw new AppError(`Report range cannot exceed ${MAX_REPORT_RANGE_DAYS} days`, 422);
  }
  return {
    from:from?.toISOString() || null,
    to:to?.toISOString() || null,
    timezone:'America/Guayaquil',
  };
}

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function withinPeriod(value, period) {
  if (!period.from && !period.to) return true;
  const date = validDate(value);
  if (!date) return false;
  return (!period.from || date >= new Date(period.from)) && (!period.to || date <= new Date(period.to));
}

function overlapsPeriod(item, period) {
  if (!period.from && !period.to) return true;
  const startsAt = validDate(item.startsAt || item.enrolledAt || item.createdAt);
  const endsAt = validDate(item.endsAt);
  return (!period.to || !startsAt || startsAt <= new Date(period.to))
    && (!period.from || !endsAt || endsAt >= new Date(period.from));
}

function reportAsOf(period, generatedAt = new Date()) {
  const generatedDate = validDate(generatedAt) || new Date();
  const requestedEnd = validDate(period?.to);
  return requestedEnd && requestedEnd < generatedDate ? requestedEnd : generatedDate;
}

function optionalUuid(value, field) {
  if (!value) return null;
  if (!UUID_PATTERN.test(String(value))) throw new AppError(`${field} must be a valid identifier`, 422);
  return String(value);
}

function optionalEnum(value, allowed, field) {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!allowed.has(normalized)) throw new AppError(`Invalid ${field}`, 422);
  return normalized;
}

function reportFilters(query = {}) {
  const search = String(query.search || '').trim();
  if (search.length > 80) throw new AppError('Report search cannot exceed 80 characters', 422);
  return {
    branchId:optionalUuid(query.branchId, 'branchId'),
    studentId:optionalUuid(query.studentId, 'studentId'),
    classGroupId:optionalUuid(query.classGroupId, 'classGroupId'),
    level:optionalEnum(query.level, REPORT_LEVELS, 'level'),
    paymentStatus:optionalEnum(query.paymentStatus, PAYMENT_STATUSES, 'paymentStatus'),
    attendanceStatus:optionalEnum(query.attendanceStatus, ATTENDANCE_STATUSES, 'attendanceStatus'),
    search:search || null,
  };
}

class ReportsController {
  constructor(db, rulesService, accessPolicy = null, cacheService = null) {
    this.db = db;
    this.rulesService = rulesService;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
  }

  async rows(repositoryName) {
    const repository = this.db[repositoryName];
    return repository && typeof repository.all === 'function' ? repository.all() : [];
  }

  async visibleBranches(user) {
    const branches = await this.rows('branches');
    return this.accessPolicy
      ? this.accessPolicy.filterList(user, 'branches', branches)
      : branches;
  }

  async reportSource(user, period) {
    const branches = await this.visibleBranches(user);
    const branchIds = new Set(branches.map((branch) => branch.id));
    const allStudents = await this.rows('students');
    const students = allStudents.filter((student) => branchIds.has(student.branchId));
    const classGroups = (await this.rows('classGroups')).filter((group) => branchIds.has(group.branchId));
    const groupIds = new Set(classGroups.map((group) => group.id));
    const classSessions = (await this.rows('classSessions'))
      .filter((session) => groupIds.has(session.classGroupId))
      .filter((session) => withinPeriod(session.startsAt, period));
    const sessionById = new Map(classSessions.map((session) => [session.id, session]));
    const attendance = (await this.rows('studentAttendance'))
      .filter((record) => {
        const session = sessionById.get(record.classSessionId);
        return Boolean(session)
          && session.status !== 'cancelled'
          && session.attendanceState === 'finalized';
      })
      .map((record) => ({ ...record, sessionStartsAt:sessionById.get(record.classSessionId)?.startsAt || null }));
    const attendanceIds = new Set(attendance.map((record) => record.id));
    const justifications = (await this.rows('absenceJustifications'))
      .filter((item) => attendanceIds.has(item.attendanceRecordId));
    const allPayments = await this.rows('studentPayments');
    const payments = allPayments
      .filter((payment) => branchIds.has(payment.branchId))
      .filter((payment) => {
        if (['pending', 'overdue'].includes(payment.status)) {
          const recognitionDate = validDate(payment.dueAt || payment.createdAt);
          return !period.to || !recognitionDate || recognitionDate <= new Date(period.to);
        }
        return withinPeriod(payment.paidAt || payment.createdAt, period);
      });
    const scopedStudentIds = new Set(payments.map((payment) => payment.studentId));
    const referencedOriginalIds = new Set(
      payments.map((payment) => payment.reversalOfId).filter(Boolean),
    );
    const events = (await this.rows('academyEvents'))
      .filter((event) => branchIds.has(event.branchId))
      .filter((event) => withinPeriod(event.startsAt || event.createdAt, period));
    const enrollments = (await this.rows('classGroupEnrollments'))
      .filter((enrollment) => groupIds.has(enrollment.classGroupId))
      .filter((enrollment) => overlapsPeriod(enrollment, period));
    const teachers = (await this.rows('teachers')).filter((teacher) => branchIds.has(teacher.branchId));
    const teacherIds = new Set(teachers.map((teacher) => teacher.id));
    const teacherAttendance = (await this.rows('teacherAttendance'))
      .filter((record) => teacherIds.has(record.teacherId))
      .filter((record) => withinPeriod(record.checkInAt, period));
    const enrollmentRequests = (await this.rows('enrollmentRequests'))
      .filter((request) => !request.branchId || branchIds.has(request.branchId))
      .filter((request) => withinPeriod(request.createdAt, period));

    return {
      branches,
      students,
      payments,
      attendance,
      justifications,
      events,
      classGroups,
      classSessions,
      enrollments,
      teachers,
      teacherAttendance,
      enrollmentRequests,
      // Quality checks need referential context beyond the selected reporting
      // period. Only identifiers referenced by scoped rows are retained, so a
      // reversal is not called orphaned merely because its original movement
      // falls outside the period.
      studentReferenceIds:allStudents
        .filter((student) => scopedStudentIds.has(student.id))
        .map((student) => student.id),
      paymentReferenceIds:allPayments
        .filter((payment) => referencedOriginalIds.has(payment.id))
        .map((payment) => payment.id),
    };
  }

  sourceForBranch(source, branchId) {
    const branch = source.branches.find((item) => item.id === branchId);
    if (!branch) return null;
    const students = source.students.filter((item) => item.branchId === branchId);
    const classGroups = source.classGroups.filter((item) => item.branchId === branchId);
    const groupIds = new Set(classGroups.map((item) => item.id));
    const classSessions = source.classSessions.filter((item) => groupIds.has(item.classGroupId));
    const sessionIds = new Set(classSessions.map((item) => item.id));
    const attendance = source.attendance.filter((item) => sessionIds.has(item.classSessionId));
    const attendanceIds = new Set(attendance.map((item) => item.id));
    const teachers = source.teachers.filter((item) => item.branchId === branchId);
    const teacherIds = new Set(teachers.map((item) => item.id));
    return {
      branches:[branch],
      students,
      payments:source.payments.filter((item) => item.branchId === branchId),
      attendance,
      justifications:source.justifications.filter((item) => attendanceIds.has(item.attendanceRecordId)),
      events:source.events.filter((item) => item.branchId === branchId),
      classGroups,
      classSessions,
      enrollments:source.enrollments.filter((item) => groupIds.has(item.classGroupId)),
      teachers,
      teacherAttendance:source.teacherAttendance.filter((item) => teacherIds.has(item.teacherId)),
      enrollmentRequests:source.enrollmentRequests.filter((item) => item.branchId === branchId),
      studentReferenceIds:source.studentReferenceIds,
      paymentReferenceIds:source.paymentReferenceIds,
    };
  }

  async buildReport(user, period, filters = {}) {
    const generatedAt = new Date();
    const asOf = reportAsOf(period, generatedAt);
    return buildAcademicReport(await this.reportSource(user, period), generatedAt, period, asOf, filters);
  }

  cachedReport = async (req, res, keySuffix, loader, notFoundMessage = null) => {
    const queryKey = Object.entries(req.query)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('&') || 'all';
    let value;
    if (this.cacheService) {
      const key = `reports:${keySuffix}:${queryKey}:${actorCacheScope(req.sessionUser)}`;
      const result = await this.cacheService.remember(
        key,
        30,
        ['reports', 'branches', 'students', 'student-payments', 'academy-events', 'attendance', 'class-groups', 'class-group-enrollments'],
        loader,
      );
      setMemoryCacheHeaders(res, result, key);
      value = result.value;
    } else {
      res.set('X-Memory-Cache', 'BYPASS');
      value = await loader();
    }
    if (value === null && notFoundMessage) return ApiResponse.error(res, notFoundMessage, 404);
    return ApiResponse.success(res, value);
  };

  branchSummary = async (req, res) => {
    const period = reportPeriod(req.query);
    const filters = reportFilters(req.query);
    return this.cachedReport(req, res, 'branches:summary', async () => {
      const report = await this.buildReport(req.sessionUser, period, filters);
      return {
        generatedAt:report.generatedAt,
        asOf:report.asOf,
        period:report.period,
        branches:report.branches,
        qualityAlerts:report.qualityAlerts,
      };
    });
  };

  generalReport = async (req, res) => {
    const period = reportPeriod(req.query);
    const filters = reportFilters(req.query);
    return this.cachedReport(req, res, 'general', () => this.buildReport(req.sessionUser, period, filters));
  };

  branchDetail = async (req, res) => {
    const period = reportPeriod(req.query);
    const filters = reportFilters(req.query);
    return this.cachedReport(req, res, `branches:${req.params.branchId}:detail`, async () => {
      const source = await this.reportSource(req.sessionUser, period);
      const branchSource = this.sourceForBranch(source, req.params.branchId);
      if (!branchSource) return null;
      const generatedAt = new Date();
      const report = buildAcademicReport(branchSource, generatedAt, period, reportAsOf(period, generatedAt), filters);
      return {
        generatedAt:report.generatedAt,
        asOf:report.asOf,
        period:report.period,
        branch:report.branches[0],
        trends:report.trends,
        distributions:report.distributions,
        funnel:report.funnel,
        qualityAlerts:report.qualityAlerts,
      };
    }, 'Branch not found');
  };

  attendanceReport = async (req, res) => {
    const period = reportPeriod(req.query);
    const filters = reportFilters(req.query);
    return this.cachedReport(req, res, 'attendance', async () => {
      const source = await this.reportSource(req.sessionUser, period);
      if (filters.branchId && !source.branches.some((branch) => branch.id === filters.branchId)) return null;
      const generatedAt = new Date();
      return buildAttendanceReport(source, generatedAt, period, filters, reportAsOf(period, generatedAt));
    }, 'Branch not found or unavailable');
  };

  scholarshipCandidate = async (req, res) => {
    const student = await this.db.students.findById(req.params.studentId);
    if (!student) return ApiResponse.error(res, 'Student not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanRead(req.sessionUser, 'students', student);
    return ApiResponse.success(
      res,
      await this.rulesService.scholarshipCandidate(req.params.studentId, req.query.from, req.query.to),
    );
  };

  promotionCandidate = async (req, res) => {
    const student = await this.db.students.findById(req.params.studentId);
    if (!student) return ApiResponse.error(res, 'Student not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanRead(req.sessionUser, 'students', student);
    return ApiResponse.success(
      res,
      await this.rulesService.promotionCandidate(req.params.studentId, req.query.from, req.query.to),
    );
  };

  teacherPayment = async (req, res) => {
    const teacher = await this.db.teachers.findById(req.params.teacherId);
    if (!teacher) return ApiResponse.error(res, 'Teacher not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanRead(req.sessionUser, 'teachers', teacher);
    return ApiResponse.success(
      res,
      await this.rulesService.teacherPayment(req.params.teacherId, req.query.from, req.query.to),
    );
  };
}

module.exports = { ReportsController, reportAsOf, reportFilters, reportPeriod, withinPeriod };
