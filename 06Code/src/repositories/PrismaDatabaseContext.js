const { PrismaClient } = require('@prisma/client');
const { PrismaRepository, PrismaUserRepository, PrismaUserBranchAccessRepository } = require('./PrismaRepository');

function bindRepositories(target, prisma) {
  target.users = new PrismaUserRepository(prisma);
  target.userBranchAccess = new PrismaUserBranchAccessRepository(prisma);
  target.roles = new PrismaRepository(prisma.role);
  target.permissions = new PrismaRepository(prisma.permission);
  target.branches = new PrismaRepository(prisma.branch);
  target.students = new PrismaRepository(prisma.student);
  target.teachers = new PrismaRepository(prisma.teacher);
  target.danceCategories = new PrismaRepository(prisma.danceCategory);
  target.danceStyles = new PrismaRepository(prisma.danceStyle);
  target.teacherStyles = new PrismaRepository(prisma.teacherStyle);
  target.classGroups = new PrismaRepository(prisma.classGroup);
  target.classSessions = new PrismaRepository(prisma.classSession);
  target.classGroupEnrollments = new PrismaRepository(prisma.classGroupEnrollment);
  target.academyEvents = new PrismaRepository(prisma.academyEvent);
  target.studentPayments = new PrismaRepository(prisma.studentPayment);
  target.studentAttendance = new PrismaRepository(prisma.studentAttendanceRecord);
  target.teacherAttendance = new PrismaRepository(prisma.teacherAttendanceRecord);
  target.absenceJustifications = new PrismaRepository(prisma.absenceJustification);
  target.scholarshipRules = new PrismaRepository(prisma.scholarshipRule);
  target.scholarshipEvaluations = new PrismaRepository(prisma.scholarshipEvaluation);
  target.levelPromotionEvaluations = new PrismaRepository(prisma.levelPromotionEvaluation);
  target.enrollmentRequests = new PrismaRepository(prisma.enrollmentRequest);
  target.sessions = new PrismaRepository(prisma.session);
  target.auditLogs = new PrismaRepository(prisma.auditLog);
  return target;
}

class PrismaDatabaseContext {
  constructor() {
    this.prisma = new PrismaClient();
    bindRepositories(this, this.prisma);
  }

  async transaction(work) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transactionClient) => work(bindRepositories({}, transactionClient)),
          { isolationLevel:'Serializable' },
        );
      } catch (error) {
        if (error?.code !== 'P2034' || attempt === maxAttempts) throw error;
      }
    }
    throw new Error('Serializable transaction retry limit reached');
  }

  async close() {
    await this.prisma.$disconnect();
  }
}

module.exports = { PrismaDatabaseContext };
