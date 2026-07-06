const { PostgresRepository, PostgresUserRepository, PostgresUserBranchAccessRepository, createPool } = require('./PostgresRepository');

class PostgresDatabaseContext {
  constructor(databaseUrl) {
    this.pool = createPool(databaseUrl);
    this.users = new PostgresUserRepository(this.pool);
    this.userBranchAccess = new PostgresUserBranchAccessRepository(this.pool);
    this.roles = new PostgresRepository(this.pool, 'roles');
    this.permissions = new PostgresRepository(this.pool, 'permissions');
    this.branches = new PostgresRepository(this.pool, 'branches');
    this.students = new PostgresRepository(this.pool, 'students');
    this.teachers = new PostgresRepository(this.pool, 'teachers');
    this.danceCategories = new PostgresRepository(this.pool, 'dance_categories');
    this.danceStyles = new PostgresRepository(this.pool, 'dance_styles');
    this.teacherStyles = new PostgresRepository(this.pool, 'teacher_styles');
    this.classGroups = new PostgresRepository(this.pool, 'class_groups');
    this.classSessions = new PostgresRepository(this.pool, 'class_sessions');
    this.studentAttendance = new PostgresRepository(this.pool, 'student_attendance_records');
    this.teacherAttendance = new PostgresRepository(this.pool, 'teacher_attendance_records');
    this.absenceJustifications = new PostgresRepository(this.pool, 'absence_justifications');
    this.scholarshipRules = new PostgresRepository(this.pool, 'scholarship_rules');
    this.scholarshipEvaluations = new PostgresRepository(this.pool, 'scholarship_evaluations');
    this.levelPromotionEvaluations = new PostgresRepository(this.pool, 'level_promotion_evaluations');
    this.enrollmentRequests = new PostgresRepository(this.pool, 'enrollment_requests');
    this.sessions = new PostgresRepository(this.pool, 'sessions');
    this.auditLogs = new PostgresRepository(this.pool, 'audit_logs');
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = { PostgresDatabaseContext };
