const {
  calculateAttendanceRate,
  calculateAttendanceMetrics,
  calculateFinancialMetrics,
  calculateOccupancyMetrics,
  countBy,
  createBranchReport,
  buildAcademicReport,
  buildEnrollmentFunnel,
  buildQualityAlerts,
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
    { id:'attendance-1', studentId:'student-1', classSessionId:'session-north', status:'present' },
    { id:'attendance-2', studentId:'student-2', classSessionId:'session-north', status:'absent' },
    { id:'attendance-3', studentId:'student-3', classSessionId:'session-south', status:'late' },
  ],
  events:[
    { id:'event-1', branchId:'north', showIncome:120 },
    { id:'event-2', branchId:'south', showIncome:75.5 },
  ],
  classGroups:[
    { id:'group-north', branchId:'north', active:true, capacity:20 },
    { id:'group-south', branchId:'south', active:true, capacity:20 },
  ],
  classSessions:[
    { id:'session-north', classGroupId:'group-north' },
    { id:'session-south', classGroupId:'group-south' },
  ],
});

test('functional helpers receive behavior as parameters', () => {
  const payments = source().payments;

  expect(toMoney(12.345)).toBe(12.35);
  expect(sumBy(payments, (payment) => payment.amount)).toBe(115.13);
  expect(countBy(payments, (payment) => payment.status === 'paid')).toBe(1);
  expect([...idSetFrom(payments, (payment) => payment.studentId)]).toEqual(['student-1', 'student-2', 'student-3']);
});

test('attendance preserves the absence and excludes an approved justification from the adjusted denominator', () => {
  expect(calculateAttendanceRate([
    { status:'present' },
    { status:'late' },
    { status:'justified' },
    { status:'absent' },
  ])).toBe(67);

  expect(calculateAttendanceRate([])).toBe(0);

  expect(calculateAttendanceMetrics([
    { id:'one', status:'present' },
    { id:'two', status:'late' },
    { id:'three', status:'absent' },
    { id:'four', status:'absent' },
  ], [
    { attendanceRecordId:'three', status:'approved' },
  ])).toMatchObject({
    totalSessions:4,
    accountableSessions:3,
    attendedSessions:2,
    excusedAbsences:1,
    rawAttendanceRate:50,
    attendanceRate:66.67,
    punctualityRate:50,
  });
});

test('financial, occupancy and lead metrics expose actionable business state', () => {
  const referenceDate = new Date('2026-07-10T12:00:00.000Z');
  expect(calculateFinancialMetrics([
    { amount:50, concept:'Mensualidad', status:'paid', paidAt:'2026-07-01T10:00:00.000Z' },
    { amount:20, concept:'Uniforme', status:'paid', paidAt:'2026-07-02T10:00:00.000Z' },
    { amount:35, concept:'Mensualidad', status:'pending', dueAt:'2026-06-01T00:00:00.000Z' },
  ], [
    { showIncome:30, startsAt:'2026-07-01T00:00:00.000Z' },
    { showIncome:500, startsAt:'2026-08-01T00:00:00.000Z' },
  ], referenceDate)).toMatchObject({
    tuitionIncome:50,
    otherIncome:20,
    showIncome:30,
    collectedIncome:100,
    pendingAmount:35,
    overdueAmount:35,
    overduePayments:1,
  });

  expect(calculateOccupancyMetrics([
    { id:'group-a', active:true, capacity:2 },
  ], [
    { classGroupId:'group-a', status:'active', startsAt:'2026-01-01T00:00:00.000Z' },
    { classGroupId:'group-a', status:'waitlisted' },
  ], referenceDate)).toMatchObject({
    activeEnrollments:1,
    waitlistedEnrollments:1,
    totalCapacity:2,
    occupancyRate:50,
  });

  expect(buildEnrollmentFunnel([
    { status:'pending' },
    { status:'contacted' },
    { status:'enrolled' },
    { status:'lost' },
  ])).toMatchObject({ total:4, new:1, contacted:1, won:1, lost:1, conversionRate:25 });
});

test('quality alerts identify records that make reports unsafe', () => {
  const alerts = buildQualityAlerts({
    branches:[{ id:'north' }],
    students:[{ id:'student-1', branchId:'north' }],
    payments:[
      { studentId:'student-1', branchId:null, status:'paid' },
    ],
    teacherAttendance:[
      { checkInAt:'2026-07-01T10:00:00.000Z', checkOutAt:null },
    ],
    classSessions:[
      { startsAt:'2026-07-01T10:00:00.000Z', endsAt:'2026-07-01T11:00:00.000Z', status:'scheduled', attendanceState:'not_started' },
    ],
  }, new Date('2026-07-10T12:00:00.000Z'));

  expect(alerts.map((item) => item.code)).toEqual(expect.arrayContaining([
    'PAID_WITHOUT_DATE',
    'PAYMENT_BRANCH_INVALID',
    'STALE_OPEN_CHECK_IN',
    'UNFINALIZED_ATTENDANCE',
  ]));
});

test('quality checks accept historical branches and resolve references outside the report period', () => {
  const alerts = buildQualityAlerts({
    branches:[{ id:'north' }, { id:'south' }],
    students:[{ id:'student-1', branchId:'south' }],
    studentReferenceIds:['student-1'],
    paymentReferenceIds:['original-payment'],
    payments:[{
      id:'reversal-payment',
      studentId:'student-1',
      branchId:'north',
      amount:-50,
      status:'paid',
      paidAt:'2026-07-10T10:00:00.000Z',
      transactionType:'reversal',
      reversalOfId:'original-payment',
    }],
    classSessions:[{
      startsAt:'2026-07-10T10:00:00.000Z',
      endsAt:'2026-07-10T13:00:00.000Z',
      status:'scheduled',
      attendanceState:'draft',
    }],
  }, new Date('2026-07-10T12:00:00.000Z'));

  expect(alerts.map((item) => item.code)).not.toEqual(expect.arrayContaining([
    'PAYMENT_BRANCH_INVALID',
    'ORPHAN_PAYMENT',
    'ORPHAN_FINANCIAL_REVERSAL',
    'UNFINALIZED_ATTENDANCE',
  ]));
});

test('branch metrics use the financial movement and session branches after a student transfer', () => {
  const transferred = source();
  transferred.students[0].branchId = 'south';

  const north = createBranchReport(transferred.branches[0], transferred);
  const south = createBranchReport(transferred.branches[1], transferred);

  expect(north).toMatchObject({ tuitionIncome:45.13, totalSessions:2, activeStudents:0 });
  expect(south).toMatchObject({ tuitionIncome:0, totalSessions:1, activeStudents:2 });
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
    attendanceRate:66.67,
  });
});

test('report functions do not mutate the input source', () => {
  const data = source();
  const snapshot = JSON.stringify(data);

  buildAcademicReport(data, '2026-07-10T12:00:00.000Z');

  expect(JSON.stringify(data)).toBe(snapshot);
});
