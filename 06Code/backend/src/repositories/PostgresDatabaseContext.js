const { PostgresRepository, PostgresUserRepository, PostgresUserBranchAccessRepository, createPool } = require('./PostgresRepository');

function bindRepositories(target, connection) {
  target.users = new PostgresUserRepository(connection);
  target.userBranchAccess = new PostgresUserBranchAccessRepository(connection);
  target.roles = new PostgresRepository(connection, 'roles');
  target.permissions = new PostgresRepository(connection, 'permissions');
  target.branches = new PostgresRepository(connection, 'branches');
  target.students = new PostgresRepository(connection, 'students');
  target.teachers = new PostgresRepository(connection, 'teachers');
  target.danceCategories = new PostgresRepository(connection, 'dance_categories');
  target.danceStyles = new PostgresRepository(connection, 'dance_styles');
  target.teacherStyles = new PostgresRepository(connection, 'teacher_styles');
  target.classGroups = new PostgresRepository(connection, 'class_groups');
  target.classSessions = new PostgresRepository(connection, 'class_sessions');
  target.classGroupEnrollments = new PostgresRepository(connection, 'class_group_enrollments');
  target.academyEvents = new PostgresRepository(connection, 'academy_events');
  target.studentPayments = new PostgresRepository(connection, 'student_payments');
  target.studentAttendance = new PostgresRepository(connection, 'student_attendance_records');
  target.teacherAttendance = new PostgresRepository(connection, 'teacher_attendance_records');
  target.absenceJustifications = new PostgresRepository(connection, 'absence_justifications');
  target.scholarshipRules = new PostgresRepository(connection, 'scholarship_rules');
  target.scholarshipEvaluations = new PostgresRepository(connection, 'scholarship_evaluations');
  target.levelPromotionEvaluations = new PostgresRepository(connection, 'level_promotion_evaluations');
  target.enrollmentRequests = new PostgresRepository(connection, 'enrollment_requests');
  target.sessions = new PostgresRepository(connection, 'sessions');
  target.auditLogs = new PostgresRepository(connection, 'audit_logs');
  return target;
}

class PostgresDatabaseContext {
  constructor(databaseUrl) {
    this.pool = createPool(databaseUrl);
    bindRepositories(this, this.pool);
  }

  async transaction(work) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        const result = await work(bindRepositories({}, client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        const retryable = error?.code === '40001' || error?.code === '40P01';
        if (!retryable || attempt === maxAttempts) throw error;
      } finally {
        client.release();
      }
    }
    throw new Error('Serializable transaction retry limit reached');
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = { PostgresDatabaseContext };
