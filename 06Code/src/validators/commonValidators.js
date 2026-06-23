const { z } = require('zod');
const idParam = z.object({ id: z.string().uuid() });
const attendanceRecord = z.object({ studentId: z.string().uuid(), classSessionId: z.string().uuid(), status: z.enum(['present','absent','justified','late']), notes: z.string().max(500).optional() });
const teacherCheck = z.object({ teacherId: z.string().uuid(), classSessionId: z.string().uuid().optional() });
module.exports = { z, idParam, attendanceRecord, teacherCheck };
