/**
 * Functional interfaces used by the academic reporting layer.
 *
 * JavaScript does not have native functional interfaces like Java, so this
 * project documents those contracts with JSDoc typedefs and uses them through
 * pure functions that receive behavior as parameters.
 *
 * @template T
 * @typedef {(item: T) => boolean} Predicate
 *
 * @template T, R
 * @typedef {(item: T) => R} Mapper
 *
 * @template T, R
 * @typedef {(accumulator: R, item: T) => R} Reducer
 *
 * @template T
 * @typedef {(item: T) => number|string|null|undefined} NumberSelector
 *
 * @template TContext, TResult
 * @typedef {(context: TContext) => TResult} ReportMetricCalculator
 */

const POSITIVE_ATTENDANCE_STATUSES = new Set(['present', 'late', 'justified']);
const PENDING_PAYMENT_STATUSES = new Set(['pending', 'overdue']);

const asArray = (items) => Array.isArray(items) ? items : [];
const asNumber = (value) => Number(value || 0);

const toMoney = (value) => Number(asNumber(value).toFixed(2));

/**
 * @template T
 * @param {T[]} items
 * @param {NumberSelector<T>} selector
 * @returns {number}
 */
const sumBy = (items, selector) => toMoney(asArray(items).reduce((total, item) => total + asNumber(selector(item)), 0));

/**
 * @template T
 * @param {T[]} items
 * @param {Predicate<T>} predicate
 * @returns {number}
 */
const countBy = (items, predicate) => asArray(items).filter(predicate).length;

/**
 * @template T
 * @param {T[]} items
 * @param {Mapper<T, string>} selector
 * @returns {Set<string>}
 */
const idSetFrom = (items, selector) => new Set(
  asArray(items)
    .map(selector)
    .filter((id) => id !== undefined && id !== null),
);

const isActiveStudent = (student) => student.active !== false;
const isRetiredStudent = (student) => student.active === false;
const isB1Student = (student) => student.level === 'B1' && isActiveStudent(student);
const isB2Student = (student) => student.level === 'B2' && isActiveStudent(student);
const isPaidPayment = (payment) => payment.status === 'paid';
const isPendingPayment = (payment) => PENDING_PAYMENT_STATUSES.has(payment.status);
const isPositiveAttendance = (record) => POSITIVE_ATTENDANCE_STATUSES.has(record.status);

const calculateAttendanceRate = (records) => {
  const attendance = asArray(records);
  if (!attendance.length) return 0;
  return Math.round((countBy(attendance, isPositiveAttendance) / attendance.length) * 100);
};

const buildBranchContext = (branch, source) => {
  const students = asArray(source.students).filter((student) => student.branchId === branch.id);
  const studentIds = idSetFrom(students, (student) => student.id);
  const payments = asArray(source.payments).filter((payment) => (
    payment.branchId === branch.id || studentIds.has(payment.studentId)
  ));

  return {
    branch,
    students,
    payments,
    attendance:asArray(source.attendance).filter((record) => studentIds.has(record.studentId)),
    events:asArray(source.events).filter((event) => event.branchId === branch.id),
  };
};

/**
 * @type {ReportMetricCalculator<ReturnType<typeof buildBranchContext>, object>}
 */
const calculateBranchStudentMetrics = (context) => ({
  activeStudents:countBy(context.students, isActiveStudent),
  retiredStudents:countBy(context.students, isRetiredStudent),
  b1Students:countBy(context.students, isB1Student),
  b2Students:countBy(context.students, isB2Student),
});

/**
 * @type {ReportMetricCalculator<ReturnType<typeof buildBranchContext>, object>}
 */
const calculateBranchFinancialMetrics = (context) => {
  const paidPayments = context.payments.filter(isPaidPayment);
  const pendingPayments = context.payments.filter(isPendingPayment);
  const tuitionIncome = sumBy(paidPayments, (payment) => payment.amount);
  const showIncome = sumBy(context.events, (event) => event.showIncome);

  return {
    pendingPayments:pendingPayments.length,
    pendingAmount:sumBy(pendingPayments, (payment) => payment.amount),
    tuitionIncome,
    showIncome,
    totalIncome:toMoney(tuitionIncome + showIncome),
  };
};

const createBranchReport = (branch, source) => {
  const context = buildBranchContext(branch, source);

  return {
    id:branch.id,
    name:branch.name,
    city:branch.city,
    ...calculateBranchStudentMetrics(context),
    ...calculateBranchFinancialMetrics(context),
    attendanceRate:calculateAttendanceRate(context.attendance),
    events:context.events.length,
  };
};

const emptyTotals = () => ({
  activeStudents:0,
  retiredStudents:0,
  b1Students:0,
  b2Students:0,
  pendingPayments:0,
  pendingAmount:0,
  tuitionIncome:0,
  showIncome:0,
  totalIncome:0,
  events:0,
});

const combineBranchTotals = (summary, branch) => ({
  activeStudents:summary.activeStudents + branch.activeStudents,
  retiredStudents:summary.retiredStudents + branch.retiredStudents,
  b1Students:summary.b1Students + branch.b1Students,
  b2Students:summary.b2Students + branch.b2Students,
  pendingPayments:summary.pendingPayments + branch.pendingPayments,
  pendingAmount:toMoney(summary.pendingAmount + branch.pendingAmount),
  tuitionIncome:toMoney(summary.tuitionIncome + branch.tuitionIncome),
  showIncome:toMoney(summary.showIncome + branch.showIncome),
  totalIncome:toMoney(summary.totalIncome + branch.totalIncome),
  events:summary.events + branch.events,
});

const buildAcademicReport = (source, generatedAt = new Date()) => {
  const safeSource = {
    branches:asArray(source.branches),
    students:asArray(source.students),
    payments:asArray(source.payments),
    attendance:asArray(source.attendance),
    events:asArray(source.events),
  };
  const branches = safeSource.branches.map((branch) => createBranchReport(branch, safeSource));
  const totals = branches.reduce(combineBranchTotals, emptyTotals());

  return {
    generatedAt:new Date(generatedAt).toISOString(),
    totals:{
      ...totals,
      attendanceRate:calculateAttendanceRate(safeSource.attendance),
    },
    branches,
  };
};

module.exports = {
  calculateAttendanceRate,
  countBy,
  createBranchReport,
  buildAcademicReport,
  idSetFrom,
  sumBy,
  toMoney,
};
