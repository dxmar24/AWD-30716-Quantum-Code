/**
 * Pure reporting functions. They intentionally receive complete source data so
 * formulas can be tested without a database and reused by every report surface.
 */

/**
 * Functional-interface contracts used by the reporting layer. JavaScript does
 * not enforce interfaces at runtime, so JSDoc makes each higher-order function's
 * expected behavior explicit and checkable by editors and documentation tools.
 *
 * @template T
 * @typedef {(item: T) => boolean} Predicate
 */

/**
 * @template T
 * @template R
 * @typedef {(item: T) => R} Mapper
 */

/**
 * @template T
 * @template R
 * @typedef {(accumulator: R, item: T) => R} Reducer
 */

/**
 * @template T
 * @typedef {(item: T) => number|string|null|undefined} NumberSelector
 */

/**
 * @template TContext
 * @template TResult
 * @typedef {(context: TContext) => TResult} ReportMetricCalculator
 */

const ATTENDED_STATUSES = new Set(['present', 'late']);
const OUTSTANDING_PAYMENT_STATUSES = new Set(['pending', 'overdue']);
const ACTIVE_ENROLLMENT_STATUSES = new Set(['active', 'trial']);
const TUITION_CONCEPT = /(mensual|matr[ií]cula|tuition|membership|plan|clases?)/i;

const asArray = (items) => Array.isArray(items) ? items : [];
const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const toMoney = (value) => Number(asNumber(value).toFixed(2));
const toPercent = (numerator, denominator) => (
  denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0
);

/**
 * @template T
 * @param {T[]} items
 * @param {NumberSelector<T>} selector
 * @returns {number}
 */
const sumBy = (items, selector) => toMoney(
  asArray(items).reduce((total, item) => total + asNumber(selector(item)), 0),
);

/**
 * @template T
 * @param {T[]} items
 * @param {Predicate<T>} predicate
 * @returns {number}
 */
const countBy = (items, predicate) => asArray(items).filter(predicate).length;

/**
 * @template T
 * @template R
 * @param {T[]} items
 * @param {Mapper<T, R>} selector
 * @returns {Set<R>}
 */
const idSetFrom = (items, selector) => new Set(
  asArray(items).map(selector).filter((id) => id !== undefined && id !== null),
);

const dateValue = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const isActiveStudent = (student) => student.active !== false;
const isRetiredStudent = (student) => student.active === false;
const isB1Student = (student) => student.level === 'B1' && isActiveStudent(student);
const isB2Student = (student) => student.level === 'B2' && isActiveStudent(student);
const isPaidPayment = (payment) => payment.status === 'paid';
const isOutstandingPayment = (payment) => OUTSTANDING_PAYMENT_STATUSES.has(payment.status);

function approvedJustificationIds(justifications) {
  return idSetFrom(
    asArray(justifications).filter((item) => item.status === 'approved'),
    (item) => item.attendanceRecordId,
  );
}

/**
 * A justified absence remains an absence. It is excluded from the adjusted
 * denominator, while the raw rate continues to show what physically happened.
 */
function calculateAttendanceMetrics(records, justifications = []) {
  const attendance = asArray(records);
  const approved = approvedJustificationIds(justifications);
  const attended = countBy(attendance, (record) => ATTENDED_STATUSES.has(record.status));
  const present = countBy(attendance, (record) => record.status === 'present');
  const late = countBy(attendance, (record) => record.status === 'late');
  const absent = countBy(attendance, (record) => record.status === 'absent' || record.status === 'justified');
  const excused = countBy(attendance, (record) => (
    record.status === 'justified' || (record.status === 'absent' && approved.has(record.id))
  ));
  const accountableSessions = Math.max(attendance.length - excused, 0);

  return {
    totalSessions:attendance.length,
    accountableSessions,
    attendedSessions:attended,
    presentSessions:present,
    lateSessions:late,
    absentSessions:absent,
    excusedAbsences:excused,
    rawAttendanceRate:toPercent(attended, attendance.length),
    attendanceRate:toPercent(attended, accountableSessions),
    punctualityRate:toPercent(present, attended),
  };
}

const calculateAttendanceRate = (records, justifications = []) => (
  Math.round(calculateAttendanceMetrics(records, justifications).attendanceRate)
);

function paymentCategory(payment) {
  const concept = String(payment.concept || '').trim();
  if (!concept || TUITION_CONCEPT.test(concept)) return 'tuition';
  return 'other';
}

function derivedPaymentStatus(payment, referenceDate = new Date()) {
  if (['paid', 'cancelled'].includes(payment.status)) return payment.status;
  const dueAt = dateValue(payment.dueAt);
  return dueAt && dueAt < referenceDate ? 'overdue' : 'pending';
}

function paymentAgingBucket(payment, referenceDate = new Date()) {
  if (derivedPaymentStatus(payment, referenceDate) !== 'overdue') return 'current';
  const dueAt = dateValue(payment.dueAt);
  if (!dueAt) return 'unknown';
  const days = Math.floor((referenceDate - dueAt) / 86400000);
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

function calculateFinancialMetrics(payments, events, referenceDate = new Date()) {
  const rows = asArray(payments);
  const paid = rows.filter(isPaidPayment);
  const outstanding = rows.filter((payment) => isOutstandingPayment(payment));
  const overdue = outstanding.filter((payment) => derivedPaymentStatus(payment, referenceDate) === 'overdue');
  const recognizedEvents = asArray(events).filter((event) => {
    const startsAt = dateValue(event.startsAt);
    return !startsAt || startsAt <= referenceDate;
  });
  const reversals = paid.filter((payment) => payment.transactionType === 'reversal' || asNumber(payment.amount) < 0);
  const tuitionIncome = sumBy(
    paid.filter((payment) => paymentCategory(payment) === 'tuition'),
    (payment) => payment.amount,
  );
  const otherIncome = sumBy(
    paid.filter((payment) => paymentCategory(payment) === 'other'),
    (payment) => payment.amount,
  );
  const showIncome = sumBy(recognizedEvents, (event) => event.showIncome);
  const collectedIncome = toMoney(tuitionIncome + otherIncome + showIncome);
  const aging = { current:0, '1-30':0, '31-60':0, '61-90':0, '90+':0, unknown:0 };

  for (const payment of outstanding) {
    const bucket = paymentAgingBucket(payment, referenceDate);
    aging[bucket] = toMoney(aging[bucket] + asNumber(payment.amount));
  }

  return {
    paidPayments:paid.length,
    reversalTransactions:reversals.length,
    pendingPayments:outstanding.length,
    overduePayments:overdue.length,
    pendingAmount:sumBy(outstanding, (payment) => payment.amount),
    overdueAmount:sumBy(overdue, (payment) => payment.amount),
    tuitionIncome,
    otherIncome,
    grossCollectedIncome:sumBy(paid.filter((payment) => asNumber(payment.amount) > 0), (payment) => payment.amount),
    reversedAmount:Math.abs(sumBy(reversals, (payment) => payment.amount)),
    showIncome,
    collectedIncome,
    totalIncome:collectedIncome,
    aging,
  };
}

function enrollmentIsCurrent(enrollment, referenceDate = new Date()) {
  if (!ACTIVE_ENROLLMENT_STATUSES.has(enrollment.status)) return false;
  const startsAt = dateValue(enrollment.startsAt || enrollment.enrolledAt);
  const endsAt = dateValue(enrollment.endsAt);
  return (!startsAt || startsAt <= referenceDate) && (!endsAt || endsAt >= referenceDate);
}

function calculateOccupancyMetrics(classGroups, enrollments, referenceDate = new Date()) {
  const groups = asArray(classGroups).filter((group) => group.active !== false);
  const groupIds = idSetFrom(groups, (group) => group.id);
  const scoped = asArray(enrollments).filter((item) => groupIds.has(item.classGroupId));
  const active = scoped.filter((item) => enrollmentIsCurrent(item, referenceDate));
  const waitlisted = scoped.filter((item) => item.status === 'waitlisted');
  const capacity = groups.reduce((total, group) => total + Math.max(asNumber(group.capacity), 0), 0);

  return {
    activeEnrollments:active.length,
    waitlistedEnrollments:waitlisted.length,
    totalCapacity:capacity,
    availableCapacity:Math.max(capacity - active.length, 0),
    occupancyRate:toPercent(active.length, capacity),
  };
}

function buildBranchContext(branch, source, referenceDate = new Date()) {
  const students = asArray(source.students).filter((student) => student.branchId === branch.id);
  const classGroups = asArray(source.classGroups).filter((group) => group.branchId === branch.id);
  const groupIds = idSetFrom(classGroups, (group) => group.id);
  const sessionIds = idSetFrom(
    asArray(source.classSessions).filter((session) => groupIds.has(session.classGroupId)),
    (session) => session.id,
  );
  const payments = asArray(source.payments).filter((payment) => payment.branchId === branch.id);
  const attendance = asArray(source.attendance).filter((record) => sessionIds.has(record.classSessionId));
  const attendanceIds = idSetFrom(attendance, (record) => record.id);

  return {
    branch,
    students,
    payments,
    attendance,
    justifications:asArray(source.justifications).filter((item) => attendanceIds.has(item.attendanceRecordId)),
    events:asArray(source.events).filter((event) => event.branchId === branch.id),
    classGroups,
    enrollments:asArray(source.enrollments).filter((item) => groupIds.has(item.classGroupId)),
    referenceDate,
  };
}

/** @type {ReportMetricCalculator<object, object>} */
const calculateBranchStudentMetrics = (context) => ({
  activeStudents:countBy(context.students, isActiveStudent),
  retiredStudents:countBy(context.students, isRetiredStudent),
  b1Students:countBy(context.students, isB1Student),
  b2Students:countBy(context.students, isB2Student),
});

function createBranchReport(branch, source, referenceDate = new Date()) {
  const context = buildBranchContext(branch, source, referenceDate);
  const attendance = calculateAttendanceMetrics(context.attendance, context.justifications);
  const financial = calculateFinancialMetrics(context.payments, context.events, referenceDate);
  const occupancy = calculateOccupancyMetrics(context.classGroups, context.enrollments, referenceDate);

  return {
    id:branch.id,
    name:branch.name,
    city:branch.city,
    ...calculateBranchStudentMetrics(context),
    ...financial,
    ...attendance,
    ...occupancy,
    events:context.events.length,
  };
}

function normalizeLeadStatus(status) {
  const value = String(status || 'pending').toLowerCase();
  if (['pending', 'new'].includes(value)) return 'new';
  if (['assigned'].includes(value)) return 'assigned';
  if (['contacted'].includes(value)) return 'contacted';
  if (['trial', 'trial_scheduled'].includes(value)) return 'trialScheduled';
  if (['enrolled', 'won'].includes(value)) return 'won';
  if (['rejected', 'lost'].includes(value)) return 'lost';
  return 'other';
}

function buildEnrollmentFunnel(requests) {
  const funnel = {
    total:asArray(requests).length,
    new:0,
    assigned:0,
    contacted:0,
    trialScheduled:0,
    won:0,
    lost:0,
    other:0,
    conversionRate:0,
  };
  for (const request of asArray(requests)) funnel[normalizeLeadStatus(request.status)] += 1;
  funnel.conversionRate = toPercent(funnel.won, funnel.total);
  return funnel;
}

function monthKey(value) {
  const date = dateValue(value);
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function recentMonthKeys(referenceDate, count = 6) {
  const keys = [];
  const cursor = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  for (let index = count - 1; index >= 0; index -= 1) {
    const month = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - index, 1));
    keys.push(monthKey(month));
  }
  return keys;
}

function buildMonthlyTrends(source, referenceDate = new Date(), count = 6) {
  const keys = recentMonthKeys(referenceDate, count);
  return keys.map((period) => {
    const payments = asArray(source.payments).filter((payment) => (
      payment.status === 'paid' && monthKey(payment.paidAt || payment.createdAt) === period
    ));
    const attendance = asArray(source.attendance).filter((record) => (
      monthKey(record.sessionStartsAt || record.createdAt) === period
    ));
    const attendanceIds = idSetFrom(attendance, (record) => record.id);
    const justifications = asArray(source.justifications).filter((item) => attendanceIds.has(item.attendanceRecordId));
    const attendanceMetrics = calculateAttendanceMetrics(attendance, justifications);
    return {
      period,
      collectedIncome:sumBy(payments, (payment) => payment.amount),
      attendanceRate:attendanceMetrics.attendanceRate,
      punctualityRate:attendanceMetrics.punctualityRate,
      attendanceRecords:attendanceMetrics.totalSessions,
    };
  });
}

function buildQualityAlerts(source, referenceDate = new Date()) {
  const alerts = [];
  const studentsById = new Map(asArray(source.students).map((item) => [item.id, item]));
  const knownStudentIds = new Set([
    ...studentsById.keys(),
    ...asArray(source.studentReferenceIds),
  ]);
  const knownBranchIds = idSetFrom(source.branches, (branch) => branch.id);
  const paidWithoutDate = countBy(source.payments, (item) => item.status === 'paid' && !dateValue(item.paidAt));
  const paymentBranchInvalid = countBy(source.payments, (item) => (
    !item.branchId || (knownBranchIds.size > 0 && !knownBranchIds.has(item.branchId))
  ));
  const openTeacherCheckIns = countBy(source.teacherAttendance, (item) => {
    const checkInAt = dateValue(item.checkInAt);
    return !item.checkOutAt && checkInAt && (referenceDate - checkInAt) > 12 * 3600000;
  });
  const pastSessionsWithoutAttendance = countBy(source.classSessions, (session) => {
    const endsAt = dateValue(session.endsAt);
    if (!endsAt || endsAt > referenceDate || session.status === 'cancelled') return false;
    return session.attendanceState !== 'finalized';
  });
  const activeChargeKeys = new Map();
  for (const payment of asArray(source.payments)) {
    if (payment.status === 'cancelled' || payment.transactionType === 'reversal') continue;
    const key = `${payment.studentId || 'missing'}|${payment.period || 'missing'}|${String(payment.concept || '').trim().toLocaleLowerCase('es')}`;
    activeChargeKeys.set(key, (activeChargeKeys.get(key) || 0) + 1);
  }
  const duplicateActiveCharges = [...activeChargeKeys.values()].filter((count) => count > 1).length;
  const teacherSessionKeys = new Map();
  for (const record of asArray(source.teacherAttendance)) {
    if (!record.teacherId || !record.classSessionId) continue;
    const key = `${record.teacherId}|${record.classSessionId}`;
    teacherSessionKeys.set(key, (teacherSessionKeys.get(key) || 0) + 1);
  }
  const duplicateTeacherSessions = [...teacherSessionKeys.values()].filter((count) => count > 1).length;
  const orphanPayments = countBy(source.payments, (payment) => !knownStudentIds.has(payment.studentId));
  const groupsById = new Map(asArray(source.classGroups).map((group) => [group.id, group]));
  const enrollmentMismatch = countBy(source.enrollments, (enrollment) => {
    const student = studentsById.get(enrollment.studentId);
    const group = groupsById.get(enrollment.classGroupId);
    return !student || !group || student.branchId !== group.branchId || (group.level && student.level !== group.level);
  });
  const overCapacityGroups = countBy(source.classGroups, (group) => {
    const occupied = countBy(source.enrollments, (enrollment) => (
      enrollment.classGroupId === group.id && enrollmentIsCurrent(enrollment, referenceDate)
    ));
    return occupied > asNumber(group.capacity);
  });
  const overdueLeadFollowUps = countBy(source.enrollmentRequests, (lead) => (
    ['contacted', 'trial_scheduled'].includes(lead.status)
    && dateValue(lead.followUpAt)
    && dateValue(lead.followUpAt) < referenceDate
  ));
  const paymentIds = new Set([
    ...idSetFrom(source.payments, (payment) => payment.id),
    ...asArray(source.paymentReferenceIds),
  ]);
  const orphanReversals = countBy(source.payments, (payment) => (
    payment.transactionType === 'reversal' && !paymentIds.has(payment.reversalOfId)
  ));

  const definitions = [
    ['PAID_WITHOUT_DATE', paidWithoutDate, 'high', 'Pagos marcados como cobrados sin fecha de pago.'],
    ['PAYMENT_BRANCH_INVALID', paymentBranchInvalid, 'critical', 'Movimientos financieros sin una sede contable valida.'],
    ['STALE_OPEN_CHECK_IN', openTeacherCheckIns, 'high', 'Entradas docentes abiertas por más de 12 horas.'],
    ['UNFINALIZED_ATTENDANCE', pastSessionsWithoutAttendance, 'high', 'Sesiones pasadas sin asistencia finalizada.'],
    ['DUPLICATE_ACTIVE_CHARGE', duplicateActiveCharges, 'critical', 'Obligaciones financieras activas duplicadas por estudiante, periodo y concepto.'],
    ['DUPLICATE_TEACHER_SESSION', duplicateTeacherSessions, 'critical', 'Jornadas docentes duplicadas para una misma sesión.'],
    ['ORPHAN_PAYMENT', orphanPayments, 'critical', 'Movimientos financieros sin un estudiante válido.'],
    ['ENROLLMENT_ACADEMIC_MISMATCH', enrollmentMismatch, 'critical', 'Matrículas con sede, nivel o referencias académicas inconsistentes.'],
    ['GROUP_OVER_CAPACITY', overCapacityGroups, 'high', 'Grupos con más matrículas activas que cupos configurados.'],
    ['OVERDUE_LEAD_FOLLOW_UP', overdueLeadFollowUps, 'medium', 'Prospectos cuyo seguimiento o clase de prueba ya venció.'],
    ['ORPHAN_FINANCIAL_REVERSAL', orphanReversals, 'critical', 'Reversos financieros sin movimiento original visible.'],
  ];
  for (const [code, count, severity, message] of definitions) {
    if (count) alerts.push({ code, count, severity, message });
  }
  return alerts;
}

const emptyTotals = () => ({
  activeStudents:0,
  retiredStudents:0,
  b1Students:0,
  b2Students:0,
  paidPayments:0,
  reversalTransactions:0,
  pendingPayments:0,
  overduePayments:0,
  pendingAmount:0,
  overdueAmount:0,
  tuitionIncome:0,
  otherIncome:0,
  grossCollectedIncome:0,
  reversedAmount:0,
  showIncome:0,
  collectedIncome:0,
  totalIncome:0,
  events:0,
  activeEnrollments:0,
  waitlistedEnrollments:0,
  totalCapacity:0,
  availableCapacity:0,
});

/** @type {Reducer<object, object>} */
function combineBranchTotals(summary, branch) {
  const next = { ...summary };
  for (const key of Object.keys(summary)) {
    next[key] = key.includes('Income') || key.includes('Amount')
      ? toMoney(summary[key] + asNumber(branch[key]))
      : summary[key] + asNumber(branch[key]);
  }
  return next;
}

function buildAcademicReport(source, generatedAt = new Date(), period = null, referenceAt = generatedAt) {
  const generatedDate = dateValue(generatedAt) || new Date();
  const referenceDate = dateValue(referenceAt) || generatedDate;
  const safeSource = {
    branches:asArray(source.branches),
    students:asArray(source.students),
    payments:asArray(source.payments),
    attendance:asArray(source.attendance),
    justifications:asArray(source.justifications),
    events:asArray(source.events),
    classGroups:asArray(source.classGroups),
    classSessions:asArray(source.classSessions),
    enrollments:asArray(source.enrollments),
    teacherAttendance:asArray(source.teacherAttendance),
    enrollmentRequests:asArray(source.enrollmentRequests),
    studentReferenceIds:asArray(source.studentReferenceIds),
    paymentReferenceIds:asArray(source.paymentReferenceIds),
  };
  const branches = safeSource.branches.map((branch) => createBranchReport(branch, safeSource, referenceDate));
  const totals = branches.reduce(combineBranchTotals, emptyTotals());
  const attendance = calculateAttendanceMetrics(safeSource.attendance, safeSource.justifications);

  return {
    generatedAt:generatedDate.toISOString(),
    asOf:referenceDate.toISOString(),
    period:period || { from:null, to:null, timezone:'America/Bogota' },
    totals:{
      ...totals,
      ...attendance,
      occupancyRate:toPercent(totals.activeEnrollments, totals.totalCapacity),
    },
    distributions:{
      attendance:{
        present:attendance.presentSessions,
        late:attendance.lateSessions,
        absent:attendance.absentSessions,
        excused:attendance.excusedAbsences,
      },
      payments:{
        paid:totals.paidPayments,
        pending:Math.max(totals.pendingPayments - totals.overduePayments, 0),
        overdue:totals.overduePayments,
      },
    },
    trends:buildMonthlyTrends(safeSource, referenceDate),
    funnel:buildEnrollmentFunnel(safeSource.enrollmentRequests),
    qualityAlerts:buildQualityAlerts(safeSource, referenceDate),
    branches,
  };
}

module.exports = {
  buildAcademicReport,
  buildEnrollmentFunnel,
  buildMonthlyTrends,
  buildQualityAlerts,
  calculateAttendanceMetrics,
  calculateAttendanceRate,
  calculateFinancialMetrics,
  calculateOccupancyMetrics,
  countBy,
  createBranchReport,
  derivedPaymentStatus,
  idSetFrom,
  paymentAgingBucket,
  sumBy,
  toMoney,
};
