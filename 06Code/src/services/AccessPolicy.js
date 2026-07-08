const { AppError } = require('../exceptions/AppError');
const { Roles } = require('../models/constants');

class AccessPolicy {
  constructor(db) {
    this.db = db;
  }

  isGlobal(user) {
    return [Roles.ADMIN, Roles.GENERAL_DIRECTOR].includes(user?.role);
  }

  deny(message = 'Insufficient permissions') {
    throw new AppError(message, 403);
  }

  async branchIdsForUser(user) {
    if (!user) return [];
    if (this.isGlobal(user)) return (await this.db.branches.all()).map((branch) => branch.id);
    if (user.role === Roles.BRANCH_DIRECTOR) {
      const rows = await this.db.userBranchAccess.all();
      return rows.filter((row) => row.userId === user.id).map((row) => row.branchId);
    }
    if (user.role === Roles.TEACHER) {
      const teacher = await this.db.teachers.findBy('userId', user.id);
      return teacher?.branchId ? [teacher.branchId] : [];
    }
    if (user.role === Roles.STUDENT) {
      const student = await this.db.students.findBy('userId', user.id);
      return student?.branchId ? [student.branchId] : [];
    }
    return [];
  }

  async canAccessBranch(user, branchId) {
    if (!branchId) return this.isGlobal(user);
    return (await this.branchIdsForUser(user)).includes(branchId);
  }

  async requireBranchAccess(user, branchId) {
    if (!(await this.canAccessBranch(user, branchId))) this.deny();
  }

  async userStudent(user) {
    return user?.id ? this.db.students.findBy('userId', user.id) : null;
  }

  async userTeacher(user) {
    return user?.id ? this.db.teachers.findBy('userId', user.id) : null;
  }

  async classGroupForSession(sessionOrId) {
    const session = typeof sessionOrId === 'string'
      ? await this.db.classSessions.findById(sessionOrId)
      : sessionOrId;
    if (!session?.classGroupId) return null;
    return this.db.classGroups.findById(session.classGroupId);
  }

  async branchIdForResource(entityName, resource) {
    if (!resource) return null;
    if (entityName === 'branches') return resource.id;
    if (['students', 'teachers', 'class-groups', 'enrollment-requests', 'academy-events', 'student-payments'].includes(entityName)) return resource.branchId || null;
    if (entityName === 'class-sessions') return (await this.classGroupForSession(resource))?.branchId || null;
    if (entityName === 'student-attendance') {
      const student = resource.studentId ? await this.db.students.findById(resource.studentId) : null;
      return student?.branchId || null;
    }
    if (entityName === 'teacher-attendance') {
      const teacher = resource.teacherId ? await this.db.teachers.findById(resource.teacherId) : null;
      return teacher?.branchId || null;
    }
    if (entityName === 'absence-justifications') {
      const attendance = resource.attendanceRecordId ? await this.db.studentAttendance.findById(resource.attendanceRecordId) : null;
      return attendance ? this.branchIdForResource('student-attendance', attendance) : null;
    }
    if (['scholarship-evaluations', 'level-promotion-evaluations'].includes(entityName)) {
      const student = resource.studentId ? await this.db.students.findById(resource.studentId) : null;
      return student?.branchId || null;
    }
    return null;
  }

  async teacherOwnsSession(user, classSessionId) {
    const teacher = await this.userTeacher(user);
    if (!teacher || !classSessionId) return false;
    const classGroup = await this.classGroupForSession(classSessionId);
    return classGroup?.teacherId === teacher.id;
  }

  async teacherCanAccessStudent(user, studentId, classSessionId = null) {
    const teacher = await this.userTeacher(user);
    if (!teacher || !studentId) return false;
    const student = await this.db.students.findById(studentId);
    if (!student) return false;
    if (classSessionId) {
      const classGroup = await this.classGroupForSession(classSessionId);
      return classGroup?.teacherId === teacher.id && classGroup.branchId === student.branchId;
    }
    return teacher.branchId && teacher.branchId === student.branchId;
  }

  async studentOwnsStudentId(user, studentId) {
    const student = await this.userStudent(user);
    return Boolean(student && student.id === studentId);
  }

  async canReadResource(user, entityName, resource) {
    if (!user) return false;
    if (this.isGlobal(user)) return true;

    if (entityName === 'dance-categories' || entityName === 'dance-styles' || entityName === 'roles') return true;
    if (entityName === 'branches') return this.canAccessBranch(user, resource.id);

    if (entityName === 'students') {
      if (user.role === Roles.STUDENT) return resource.userId === user.id;
      if (user.role === Roles.TEACHER) return this.teacherCanAccessStudent(user, resource.id);
    }

    if (entityName === 'teachers') {
      if (user.role === Roles.TEACHER) return resource.userId === user.id;
    }

    if (entityName === 'class-sessions') {
      if (user.role === Roles.TEACHER) return this.teacherOwnsSession(user, resource.id);
    }

    if (entityName === 'class-groups') {
      if (user.role === Roles.TEACHER) {
        const teacher = await this.userTeacher(user);
        return teacher?.id === resource.teacherId;
      }
    }

    if (entityName === 'academy-events') {
      if (resource.active === false) return false;
      if (user.role === Roles.STUDENT) {
        const student = await this.userStudent(user);
        return Boolean(student
          && student.branchId === resource.branchId
          && (resource.level === 'ALL' || resource.level === student.level));
      }
      if (user.role === Roles.TEACHER) return this.canAccessBranch(user, resource.branchId);
    }

    if (entityName === 'student-payments') {
      if (user.role === Roles.STUDENT) {
        const student = await this.userStudent(user);
        return Boolean(student && student.id === resource.studentId);
      }
      if (user.role === Roles.TEACHER) return false;
    }

    if (entityName === 'student-attendance') {
      if (user.role === Roles.STUDENT) return this.studentOwnsStudentId(user, resource.studentId);
      if (user.role === Roles.TEACHER) return this.teacherCanAccessStudent(user, resource.studentId, resource.classSessionId);
    }

    if (entityName === 'teacher-attendance') {
      if (user.role === Roles.TEACHER) {
        const teacher = await this.userTeacher(user);
        return teacher?.id === resource.teacherId;
      }
    }

    if (['absence-justifications', 'scholarship-evaluations', 'level-promotion-evaluations'].includes(entityName)) {
      const branchAllowed = await this.canAccessBranch(user, await this.branchIdForResource(entityName, resource));
      if (branchAllowed && user.role === Roles.BRANCH_DIRECTOR) return true;
      if (user.role === Roles.STUDENT) {
        const attendance = resource.attendanceRecordId ? await this.db.studentAttendance.findById(resource.attendanceRecordId) : null;
        return resource.studentId
          ? this.studentOwnsStudentId(user, resource.studentId)
          : this.studentOwnsStudentId(user, attendance?.studentId);
      }
      if (user.role === Roles.TEACHER && resource.attendanceRecordId) {
        const attendance = await this.db.studentAttendance.findById(resource.attendanceRecordId);
        return this.teacherCanAccessStudent(user, attendance?.studentId, attendance?.classSessionId);
      }
    }

    const branchId = await this.branchIdForResource(entityName, resource);
    return user.role === Roles.BRANCH_DIRECTOR && await this.canAccessBranch(user, branchId);
  }

  async filterList(user, entityName, rows) {
    if (!user) return [];
    if (this.isGlobal(user)) return rows;
    const visible = [];
    for (const row of rows) {
      if (await this.canReadResource(user, entityName, row)) visible.push(row);
    }
    return visible;
  }

  async assertCanRead(user, entityName, resource) {
    if (!(await this.canReadResource(user, entityName, resource))) this.deny();
  }

  async assertCanCreate(user, entityName, data) {
    if (this.isGlobal(user)) return;

    if (['branches', 'dance-categories', 'dance-styles'].includes(entityName)) this.deny();

    if (['students', 'teachers', 'class-groups', 'academy-events', 'student-payments'].includes(entityName)) {
      return this.requireBranchAccess(user, data.branchId);
    }

    if (entityName === 'class-sessions') {
      const classGroup = data.classGroupId ? await this.db.classGroups.findById(data.classGroupId) : null;
      return this.requireBranchAccess(user, classGroup?.branchId);
    }

    if (entityName === 'student-attendance') {
      const student = await this.db.students.findById(data.studentId);
      const classGroup = await this.classGroupForSession(data.classSessionId);
      if (!student || !classGroup || student.branchId !== classGroup.branchId) this.deny();
      if (user.role === Roles.BRANCH_DIRECTOR) return this.requireBranchAccess(user, student.branchId);
      if (user.role === Roles.TEACHER && await this.teacherCanAccessStudent(user, data.studentId, data.classSessionId)) return;
      this.deny();
    }

    if (entityName === 'teacher-attendance') {
      const teacher = await this.db.teachers.findById(data.teacherId);
      if (user.role === Roles.BRANCH_DIRECTOR) return this.requireBranchAccess(user, teacher?.branchId);
      if (user.role === Roles.TEACHER) {
        const ownTeacher = await this.userTeacher(user);
        if (ownTeacher?.id === data.teacherId && (!data.classSessionId || await this.teacherOwnsSession(user, data.classSessionId))) return;
      }
      this.deny();
    }

    if (entityName === 'absence-justifications') {
      const attendance = await this.db.studentAttendance.findById(data.attendanceRecordId);
      if (!attendance) return;
      return this.assertCanRead(user, 'student-attendance', attendance);
    }

    if (['scholarship-evaluations', 'level-promotion-evaluations'].includes(entityName)) {
      const student = data.studentId ? await this.db.students.findById(data.studentId) : null;
      return this.requireBranchAccess(user, student?.branchId);
    }

    this.deny();
  }

  async assertCanUpdate(user, entityName, resource, updates = {}) {
    if (this.isGlobal(user)) return;
    if (!(await this.canReadResource(user, entityName, resource))) this.deny();

    if (['students', 'teachers', 'class-groups', 'academy-events', 'student-payments'].includes(entityName) && updates.branchId && updates.branchId !== resource.branchId) {
      await this.requireBranchAccess(user, updates.branchId);
    }

    if (entityName === 'class-sessions' && updates.classGroupId) {
      const classGroup = await this.db.classGroups.findById(updates.classGroupId);
      await this.requireBranchAccess(user, classGroup?.branchId);
    }
  }
}

module.exports = { AccessPolicy };
