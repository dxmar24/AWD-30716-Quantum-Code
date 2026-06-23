const { AppError } = require('../exceptions/AppError');
class AttendanceService {
  constructor(db, audit) { this.db = db; this.audit = audit; }
  recordStudentAttendance(actor, data) { if (!this.db.students.findById(data.studentId)) throw new AppError('Student not found', 404); if (!this.db.classSessions.findById(data.classSessionId)) throw new AppError('Class session not found', 404); const record = this.db.studentAttendance.create(data); this.audit.log(actor.id, 'STUDENT_ATTENDANCE_RECORDED', 'student_attendance_records', record.id, { status:data.status }); return record; }
  checkInTeacher(actor, data) { const record = this.db.teacherAttendance.create({ ...data, checkInAt:new Date().toISOString(), checkOutAt:null }); this.audit.log(actor.id, 'TEACHER_CHECK_IN', 'teacher_attendance_records', record.id); return record; }
  checkOutTeacher(actor, recordId) { const record = this.db.teacherAttendance.findById(recordId); if (!record) throw new AppError('Teacher attendance record not found', 404); const updated = this.db.teacherAttendance.update(recordId, { checkOutAt:new Date().toISOString() }); this.audit.log(actor.id, 'TEACHER_CHECK_OUT', 'teacher_attendance_records', recordId); return updated; }
  attendanceRate(studentId, from, to) { const rows = this.db.studentAttendance.filter((r) => r.studentId === studentId); const scoped = rows.filter((r) => (!from || new Date(r.createdAt) >= new Date(from)) && (!to || new Date(r.createdAt) <= new Date(to))); if (!scoped.length) return 0; return scoped.filter((r) => ['present','late','justified'].includes(r.status)).length / scoped.length; }
}
module.exports = { AttendanceService };
