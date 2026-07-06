const { AppError } = require('../exceptions/AppError');

class AttendanceService {
  constructor(db, audit, accessPolicy = null) {
    this.db = db;
    this.audit = audit;
    this.accessPolicy = accessPolicy;
  }

  assertValidWindow(from, to) {
    if (from && Number.isNaN(new Date(from).getTime())) throw new AppError('Invalid from date', 422);
    if (to && Number.isNaN(new Date(to).getTime())) throw new AppError('Invalid to date', 422);
    if (from && to && new Date(from) > new Date(to)) throw new AppError('from date must be before to date', 422);
  }

  async recordStudentAttendance(actor, data) {
    if (!(await this.db.students.findById(data.studentId))) throw new AppError('Student not found', 404);
    if (!(await this.db.classSessions.findById(data.classSessionId))) throw new AppError('Class session not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(actor, 'student-attendance', data);

    const rows = await this.db.studentAttendance.all();
    if (rows.some((row) => row.studentId === data.studentId && row.classSessionId === data.classSessionId)) {
      throw new AppError('Attendance already recorded for this student and session', 409);
    }

    const record = await this.db.studentAttendance.create(data);
    await this.audit.log(actor.id, 'STUDENT_ATTENDANCE_RECORDED', 'student_attendance_records', record.id, { status:data.status });
    return record;
  }

  async checkInTeacher(actor, data) {
    if (!(await this.db.teachers.findById(data.teacherId))) throw new AppError('Teacher not found', 404);
    if (data.classSessionId && !(await this.db.classSessions.findById(data.classSessionId))) throw new AppError('Class session not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(actor, 'teacher-attendance', data);

    const rows = await this.db.teacherAttendance.all();
    if (rows.some((row) => row.teacherId === data.teacherId && !row.checkOutAt)) {
      throw new AppError('Teacher already has an open check-in', 409);
    }

    const record = await this.db.teacherAttendance.create({ ...data, checkInAt:new Date().toISOString(), checkOutAt:null });
    await this.audit.log(actor.id, 'TEACHER_CHECK_IN', 'teacher_attendance_records', record.id);
    return record;
  }

  async checkOutTeacher(actor, recordId) {
    const record = await this.db.teacherAttendance.findById(recordId);
    if (!record) throw new AppError('Teacher attendance record not found', 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(actor, 'teacher-attendance', record);
    if (record.checkOutAt) throw new AppError('Teacher attendance record already checked out', 409);

    const updated = await this.db.teacherAttendance.update(recordId, { checkOutAt:new Date().toISOString() });
    await this.audit.log(actor.id, 'TEACHER_CHECK_OUT', 'teacher_attendance_records', recordId);
    return updated;
  }

  async attendanceRecordDate(record) {
    if (record.classSessionId) {
      const session = await this.db.classSessions.findById(record.classSessionId);
      if (session?.startsAt || session?.starts_at) return new Date(session.startsAt || session.starts_at);
    }
    return new Date(record.createdAt || record.created_at || Date.now());
  }

  async attendanceRate(studentId, from, to) {
    this.assertValidWindow(from, to);
    const rows = (await this.db.studentAttendance.all()).filter((row) => row.studentId === studentId);
    const scoped = [];

    for (const row of rows) {
      const date = await this.attendanceRecordDate(row);
      if ((!from || date >= new Date(from)) && (!to || date <= new Date(to))) scoped.push(row);
    }

    if (!scoped.length) return 0;
    return scoped.filter((row) => ['present', 'late', 'justified'].includes(row.status)).length / scoped.length;
  }
}

module.exports = { AttendanceService };
