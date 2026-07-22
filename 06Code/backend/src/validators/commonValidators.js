const { z } = require('zod');
const idParam = z.object({ id: z.string().uuid() });
const attendanceStatus = z.enum(['present','absent','late']);
const attendanceRecord = z.object({
  studentId:z.string().uuid(),
  classSessionId:z.string().uuid(),
  status:attendanceStatus,
  notes:z.string().max(500).optional(),
  correctionReason:z.string().min(5).max(500).optional(),
});
const teacherCheck = z.object({ teacherId: z.string().uuid(), classSessionId: z.string().uuid() });
const roles = ['Student','Teacher','BranchDirector','GeneralDirector','Admin'];
const roleUpdate = z.object({ role:z.enum(roles) });
const userStatusUpdate = z.object({ active:z.boolean() });
const password = z.string().min(10).max(120).regex(/[A-Za-z]/).regex(/[0-9]/);
const accountStudentProfile = z.object({
  branchId:z.string().uuid(),
  fullName:z.string().min(3).max(160).optional(),
  level:z.enum(['B1','B2']).default('B1'),
  active:z.boolean().optional(),
});
const accountTeacherProfile = z.object({
  branchId:z.string().uuid(),
  fullName:z.string().min(3).max(160).optional(),
  hourlyRate:z.coerce.number().min(0).optional(),
  active:z.boolean().optional(),
});
const accountCreate = z.object({
  email:z.string().email(),
  name:z.string().min(3).max(160),
  role:z.enum(roles),
  active:z.boolean().optional(),
  branchIds:z.array(z.string().uuid()).max(20).optional(),
  studentProfile:accountStudentProfile.optional(),
  teacherProfile:accountTeacherProfile.optional(),
});
const passwordChange = z.object({
  currentPassword:z.string().min(8).max(120),
  newPassword:password,
});
const branchAccessUpdate = z.object({ branchIds:z.array(z.string().uuid()).min(1).max(20) });
const enrollmentRequest = z.object({ fullName:z.string().trim().min(3).max(160), email:z.string().trim().email(), phone:z.string().trim().max(40).optional(), branchId:z.string().uuid().optional(), preferredBranch:z.string().trim().max(80).optional(), styleInterest:z.string().trim().max(120).optional(), message:z.string().trim().max(500).optional() });
const enrollmentRequestStatus = z.object({
  status:z.enum(['contacted','trial_scheduled','enrolled','lost']),
  notes:z.string().trim().max(500).optional(),
  followUpAt:z.string().datetime().nullable().optional(),
  convertedStudentId:z.string().uuid().optional(),
}).superRefine((data, context) => {
  if (data.status === 'lost' && (!data.notes || data.notes.length < 5)) {
    context.addIssue({ code:z.ZodIssueCode.custom, path:['notes'], message:'A loss reason of at least five characters is required' });
  }
  if (data.status === 'trial_scheduled' && !data.followUpAt) {
    context.addIssue({ code:z.ZodIssueCode.custom, path:['followUpAt'], message:'Trial date is required' });
  }
});
const secureUrl = z.string().url().refine((value) => value.startsWith('https://'), 'URL must use HTTPS');
const absenceJustification = z.object({ attendanceRecordId:z.string().uuid(), reason:z.string().trim().min(5).max(500) });
const absenceReview = z.object({ status:z.enum(['approved','rejected']), reviewNotes:z.string().max(500).optional() });
const score = z.number().min(0).max(100);
const scholarshipPercentage = z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]);
const scholarshipEvaluation = z.object({ studentId:z.string().uuid(), percentage:scholarshipPercentage, theoryScore:score, practiceScore:score, approved:z.boolean().default(false), from:z.string().datetime().optional(), to:z.string().datetime().optional() });
const levelPromotionEvaluation = z.object({ studentId:z.string().uuid(), consistencyScore:score, theoryScore:score, practiceScore:score, approved:z.boolean().default(false), from:z.string().datetime().optional(), to:z.string().datetime().optional() });
const branch = z.object({ name:z.string().min(2).max(80), city:z.string().max(80).optional(), active:z.boolean().optional() });
const profilePhotoUrl = z.string().max(250000).refine((value) => (
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value)
  || /^https:\/\//i.test(value)
), 'Profile photo must be a PNG, JPEG or WebP data URL, or an HTTPS URL');
const studentPhoto = z.object({ profilePhotoUrl });
const student = z.object({ userId:z.string().uuid().nullable().optional(), branchId:z.string().uuid(), fullName:z.string().min(3).max(160), level:z.enum(['B1','B2']), active:z.boolean().optional(), profilePhotoUrl:profilePhotoUrl.nullable().optional(), profilePhotoUpdatedAt:z.string().datetime().nullable().optional() });
const teacher = z.object({ userId:z.string().uuid().nullable().optional(), branchId:z.string().uuid().optional(), fullName:z.string().min(3).max(160), hourlyRate:z.number().min(0).optional(), active:z.boolean().optional() });
const danceCategory = z.object({ name:z.string().min(2).max(80) });
const danceStyle = z.object({ categoryId:z.string().uuid(), name:z.string().min(2).max(80) });
const classGroup = z.object({ branchId:z.string().uuid(), styleId:z.string().uuid().nullable().optional(), teacherId:z.string().uuid().nullable().optional(), name:z.string().min(2).max(120), level:z.enum(['B1','B2']), active:z.boolean().optional(), capacity:z.coerce.number().int().min(1).max(200).default(30) });
const classSessionFields = z.object({ classGroupId:z.string().uuid(), name:z.string().min(2).max(120).optional(), startsAt:z.string().datetime(), endsAt:z.string().datetime(), status:z.enum(['scheduled','completed','cancelled']).optional(), cancellationReason:z.string().trim().min(5).max(500).optional() });
const validateSessionDates = (data, context) => {
  if (!data.startsAt || !data.endsAt) return;
  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(data.endsAt);
  if (endsAt <= startsAt) context.addIssue({ code:z.ZodIssueCode.custom, path:['endsAt'], message:'Session end must be after its start' });
  if (endsAt - startsAt > 6 * 60 * 60 * 1000) context.addIssue({ code:z.ZodIssueCode.custom, path:['endsAt'], message:'A class session cannot last more than six hours' });
};
const classSession = classSessionFields.superRefine(validateSessionDates);
const classSessionUpdate = classSessionFields.partial().superRefine(validateSessionDates);
const enrollmentStatus = z.enum(['active','waitlisted','trial','frozen','withdrawn','completed']);
const classGroupEnrollment = z.object({
  studentId:z.string().uuid(),
  classGroupId:z.string().uuid(),
  status:enrollmentStatus.default('active'),
  startsAt:z.string().datetime().optional(),
  endsAt:z.string().datetime().nullable().optional(),
  enrolledAt:z.string().datetime().optional(),
  withdrawalReason:z.string().min(3).max(500).nullable().optional(),
});
const classGroupEnrollmentUpdate = z.object({
  status:enrollmentStatus.optional(),
  startsAt:z.string().datetime().optional(),
  endsAt:z.string().datetime().nullable().optional(),
  withdrawalReason:z.string().min(3).max(500).nullable().optional(),
});
const sessionAttendanceBatch = z.object({
  state:z.enum(['draft','finalized']).default('draft'),
  records:z.array(z.object({
    studentId:z.string().uuid(),
    status:attendanceStatus,
    notes:z.string().max(500).optional(),
  })).max(200),
  correctionReason:z.string().min(5).max(500).optional(),
}).superRefine((data, context) => {
  const ids = new Set();
  data.records.forEach((record, index) => {
    if (ids.has(record.studentId)) {
      context.addIssue({ code:z.ZodIssueCode.custom, path:['records', index, 'studentId'], message:'Student appears more than once in the attendance batch' });
    }
    ids.add(record.studentId);
  });
});
const academyEventFields = z.object({ branchId:z.string().uuid(), title:z.string().min(3).max(160), description:z.string().max(1000).optional(), level:z.enum(['B1','B2','ALL']).default('ALL'), startsAt:z.string().datetime(), endsAt:z.string().datetime().optional(), location:z.string().max(160).optional(), showIncome:z.coerce.number().min(0).optional(), active:z.boolean().optional() });
const validateEventDates = (data, context) => {
  if (data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
    context.addIssue({ code:z.ZodIssueCode.custom, path:['endsAt'], message:'Event end must be after its start' });
  }
};
const academyEvent = academyEventFields.superRefine(validateEventDates);
const academyEventUpdate = academyEventFields.partial().superRefine(validateEventDates);
const paymentPeriod = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);
const studentPayment = z.object({
  studentId:z.string().uuid(),
  branchId:z.string().uuid().optional(),
  amount:z.coerce.number().positive().max(100000000),
  concept:z.string().trim().min(3).max(100),
  period:paymentPeriod,
  status:z.enum(['paid','pending','overdue']).default('pending'),
  paidAt:z.string().datetime().nullable().optional(),
  dueAt:z.string().datetime().nullable().optional(),
  notes:z.string().trim().max(500).optional(),
});
const studentPaymentUpdate = studentPayment.partial().extend({
  status:z.enum(['paid','pending','overdue','cancelled']).optional(),
  correctionReason:z.string().trim().min(5).max(500).optional(),
}).refine((data) => Object.keys(data).length > 0, 'At least one payment field is required');
const paymentReversal = z.object({ reason:z.string().trim().min(5).max(500) });
module.exports = { z, idParam, attendanceRecord, teacherCheck, roleUpdate, userStatusUpdate, accountCreate, passwordChange, branchAccessUpdate, enrollmentRequest, enrollmentRequestStatus, absenceJustification, absenceReview, scholarshipEvaluation, levelPromotionEvaluation, branch, student, studentPhoto, teacher, danceCategory, danceStyle, classGroup, classSession, classSessionUpdate, classGroupEnrollment, classGroupEnrollmentUpdate, sessionAttendanceBatch, academyEvent, academyEventUpdate, studentPayment, studentPaymentUpdate, paymentReversal };
