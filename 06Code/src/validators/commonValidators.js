const { z } = require('zod');
const idParam = z.object({ id: z.string().uuid() });
const attendanceRecord = z.object({ studentId: z.string().uuid(), classSessionId: z.string().uuid(), status: z.enum(['present','absent','justified','late']), notes: z.string().max(500).optional() });
const teacherCheck = z.object({ teacherId: z.string().uuid(), classSessionId: z.string().uuid().optional() });
const roles = ['Student','Teacher','BranchDirector','GeneralDirector','Admin'];
const roleUpdate = z.object({ role:z.enum(roles) });
const password = z.string().min(10).max(120).regex(/[A-Za-z]/).regex(/[0-9]/);
const accountCreate = z.object({
  email:z.string().email(),
  name:z.string().min(3).max(160),
  role:z.enum(roles),
  temporaryPassword:password.optional(),
  active:z.boolean().optional(),
  mustChangePassword:z.boolean().optional(),
  branchIds:z.array(z.string().uuid()).max(20).optional(),
});
const passwordChange = z.object({
  currentPassword:z.string().min(8).max(120),
  newPassword:password,
});
const branchAccessUpdate = z.object({ branchIds:z.array(z.string().uuid()).max(20) });
const enrollmentRequest = z.object({ fullName:z.string().min(3).max(160), email:z.string().email(), phone:z.string().max(40).optional(), branchId:z.string().uuid().optional(), preferredBranch:z.string().max(80).optional(), styleInterest:z.string().max(120).optional(), message:z.string().max(500).optional() });
const absenceJustification = z.object({ attendanceRecordId:z.string().uuid(), reason:z.string().min(5).max(500), evidenceUrl:z.string().url().optional() });
const absenceReview = z.object({ status:z.enum(['approved','rejected']), reviewNotes:z.string().max(500).optional() });
const score = z.number().min(0).max(100);
const scholarshipPercentage = z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]);
const scholarshipEvaluation = z.object({ studentId:z.string().uuid(), percentage:scholarshipPercentage, theoryScore:score, practiceScore:score, approved:z.boolean().default(false), from:z.string().datetime().optional(), to:z.string().datetime().optional() });
const levelPromotionEvaluation = z.object({ studentId:z.string().uuid(), consistencyScore:score, theoryScore:score, practiceScore:score, approved:z.boolean().default(false), from:z.string().datetime().optional(), to:z.string().datetime().optional() });
const branch = z.object({ name:z.string().min(2).max(80), city:z.string().max(80).optional(), active:z.boolean().optional() });
const student = z.object({ userId:z.string().uuid().nullable().optional(), branchId:z.string().uuid(), fullName:z.string().min(3).max(160), level:z.enum(['B1','B2']), active:z.boolean().optional() });
const teacher = z.object({ userId:z.string().uuid().nullable().optional(), branchId:z.string().uuid().optional(), fullName:z.string().min(3).max(160), hourlyRate:z.number().min(0).optional(), active:z.boolean().optional() });
const danceCategory = z.object({ name:z.string().min(2).max(80) });
const danceStyle = z.object({ categoryId:z.string().uuid(), name:z.string().min(2).max(80) });
const classGroup = z.object({ branchId:z.string().uuid(), styleId:z.string().uuid().nullable().optional(), teacherId:z.string().uuid().nullable().optional(), name:z.string().min(2).max(120), level:z.enum(['B1','B2']), active:z.boolean().optional() });
const classSession = z.object({ classGroupId:z.string().uuid(), startsAt:z.string().datetime(), endsAt:z.string().datetime(), status:z.enum(['scheduled','completed','cancelled']).optional() });
module.exports = { z, idParam, attendanceRecord, teacherCheck, roleUpdate, accountCreate, passwordChange, branchAccessUpdate, enrollmentRequest, absenceJustification, absenceReview, scholarshipEvaluation, levelPromotionEvaluation, branch, student, teacher, danceCategory, danceStyle, classGroup, classSession };
