const { PrismaClient } = require('@prisma/client');
const { PrismaRepository, PrismaUserRepository, PrismaUserBranchAccessRepository } = require('./PrismaRepository');

class PrismaDatabaseContext {
  constructor() {
    this.prisma = new PrismaClient();
    this.users = new PrismaUserRepository(this.prisma);
    this.userBranchAccess = new PrismaUserBranchAccessRepository(this.prisma);
    this.roles = new PrismaRepository(this.prisma.role);
    this.permissions = new PrismaRepository(this.prisma.permission);
    this.branches = new PrismaRepository(this.prisma.branch);
    this.students = new PrismaRepository(this.prisma.student);
    this.teachers = new PrismaRepository(this.prisma.teacher);
    this.danceCategories = new PrismaRepository(this.prisma.danceCategory);
    this.danceStyles = new PrismaRepository(this.prisma.danceStyle);
    this.teacherStyles = new PrismaRepository(this.prisma.teacherStyle);
    this.classGroups = new PrismaRepository(this.prisma.classGroup);
    this.classSessions = new PrismaRepository(this.prisma.classSession);
    this.academyEvents = new PrismaRepository(this.prisma.academyEvent);
    this.studentPayments = new PrismaRepository(this.prisma.studentPayment);
    this.studentAttendance = new PrismaRepository(this.prisma.studentAttendanceRecord);
    this.teacherAttendance = new PrismaRepository(this.prisma.teacherAttendanceRecord);
    this.absenceJustifications = new PrismaRepository(this.prisma.absenceJustification);
    this.scholarshipRules = new PrismaRepository(this.prisma.scholarshipRule);
    this.scholarshipEvaluations = new PrismaRepository(this.prisma.scholarshipEvaluation);
    this.levelPromotionEvaluations = new PrismaRepository(this.prisma.levelPromotionEvaluation);
    this.enrollmentRequests = new PrismaRepository(this.prisma.enrollmentRequest);
    this.sessions = new PrismaRepository(this.prisma.session);
    this.auditLogs = new PrismaRepository(this.prisma.auditLog);
  }

  async close() {
    await this.prisma.$disconnect();
  }
}

module.exports = { PrismaDatabaseContext };
