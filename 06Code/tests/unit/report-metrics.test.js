const {
  calculateAttendanceRate,
  countBy,
  createBranchReport,
  buildAcademicReport,
  idSetFrom,
  sumBy,
  toMoney,
} = require('../../src/functional/reportMetrics');

const source = () => ({
  branches:[
    { id:'north', name:'North Branch', city:'Quito' },
    { id:'south', name:'South Branch', city:'Guayaquil' },
  ],
  students:[
    { id:'student-1', branchId:'north', level:'B1', active:true },
    { id:'student-2', branchId:'north', level:'B2', active:false },
    { id:'student-3', branchId:'south', level:'B2', active:true },
  ],
  payments:[
    { id:'payment-1', studentId:'student-1', branchId:'north', amount:45.126, status:'paid' },
    { id:'payment-2', studentId:'student-2', branchId:'north', amount:30, status:'pending' },
    { id:'payment-3', studentId:'student-3', branchId:'south', amount:40, status:'overdue' },
  ],
  attendance:[
    { id:'attendance-1', studentId:'student-1', status:'present' },
    { id:'attendance-2', studentId:'student-2', status:'absent' },
    { id:'attendance-3', studentId:'student-3', status:'late' },
  ],
  events:[
    { id:'event-1', branchId:'north', showIncome:120 },
    { id:'event-2', branchId:'south', showIncome:75.5 },
  ],
});

test('functional helpers receive behavior as parameters', () => {
  const payments = source().payments;

  expect(toMoney(12.345)).toBe(12.35);
  expect(sumBy(payments, (payment) => payment.amount)).toBe(115.13);
  expect(countBy(payments, (payment) => payment.status === 'paid')).toBe(1);
  expect([...idSetFrom(payments, (payment) => payment.studentId)]).toEqual(['student-1', 'student-2', 'student-3']);
});

test('attendance rate treats present, late and justified records as positive', () => {
  expect(calculateAttendanceRate([
    { status:'present' },
    { status:'late' },
    { status:'justified' },
    { status:'absent' },
  ])).toBe(75);

  expect(calculateAttendanceRate([])).toBe(0);
});

test('branch report calculates academic, financial and event metrics without database access', () => {
  const report = createBranchReport(source().branches[0], source());

  expect(report).toMatchObject({
    id:'north',
    activeStudents:1,
    retiredStudents:1,
    b1Students:1,
    b2Students:0,
    pendingPayments:1,
    pendingAmount:30,
    tuitionIncome:45.13,
    showIncome:120,
    totalIncome:165.13,
    attendanceRate:50,
    events:1,
  });
});

test('academic report composes branch metrics into general totals', () => {
  const report = buildAcademicReport(source(), '2026-07-10T12:00:00.000Z');

  expect(report.generatedAt).toBe('2026-07-10T12:00:00.000Z');
  expect(report.branches).toHaveLength(2);
  expect(report.totals).toMatchObject({
    activeStudents:2,
    retiredStudents:1,
    b1Students:1,
    b2Students:1,
    pendingPayments:2,
    pendingAmount:70,
    tuitionIncome:45.13,
    showIncome:195.5,
    totalIncome:240.63,
    events:2,
    attendanceRate:67,
  });
});

test('report functions do not mutate the input source', () => {
  const data = source();
  const snapshot = JSON.stringify(data);

  buildAcademicReport(data, '2026-07-10T12:00:00.000Z');

  expect(JSON.stringify(data)).toBe(snapshot);
});
