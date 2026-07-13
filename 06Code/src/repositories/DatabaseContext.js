const { InMemoryRepository } = require('./InMemoryRepository');
const { Roles } = require('../models/constants');
const { hashPassword } = require('../utils/passwordHasher');

const branchIds = {
  norte: '11111111-1111-4111-8111-111111111111',
  matriz: '22222222-2222-4222-8222-222222222222',
};

const categoryIds = {
  urban: '10000000-0000-4000-8000-000000000001',
  tropical: '10000000-0000-4000-8000-000000000002',
  ethnic: '10000000-0000-4000-8000-000000000003',
};

class DatabaseContext {
  constructor() {
    this.transactionQueue = Promise.resolve();
    this.users = new InMemoryRepository([
      { id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email:'admin@alc.edu', name:'Admin User', role:Roles.ADMIN, googleSub:'test-admin', active:true, mustChangePassword:false, passwordHash:hashPassword('AmericanLatin2026!') },
      { id:'abababab-abab-4aba-8bab-abababababab', email:'student@alc.edu', name:'Demo Student User', role:Roles.STUDENT, googleSub:'test-student', active:true, mustChangePassword:false },
      { id:'acacacac-acac-4aca-8cac-acacacacacac', email:'teacher@alc.edu', name:'Demo Teacher User', role:Roles.TEACHER, googleSub:'test-teacher', active:true, mustChangePassword:false },
    ]);
    this.roles = new InMemoryRepository([{ name:Roles.VISITOR },{ name:Roles.STUDENT },{ name:Roles.TEACHER },{ name:Roles.BRANCH_DIRECTOR },{ name:Roles.GENERAL_DIRECTOR },{ name:Roles.ADMIN }]);
    this.permissions = new InMemoryRepository([]);
    this.branches = new InMemoryRepository([{ id:branchIds.norte, name:'Norte', city:'Quito', active:true },{ id:branchIds.matriz, name:'Matriz', city:'Quito', active:true },{ name:'Sur Guamani', city:'Quito', active:true },{ name:'Tumbaco', city:'Quito', active:true },{ name:'Conocoto', city:'Quito', active:true }]);
    this.userBranchAccess = new InMemoryRepository([]);
    this.userBranchAccess.listByUser = (userId) => this.userBranchAccess.rows.filter((row) => row.userId === userId);
    this.userBranchAccess.replaceForUser = (userId, branchIdsToAssign) => {
      this.userBranchAccess.deleteWhere((row) => row.userId === userId);
      return branchIdsToAssign.map((branchId) => this.userBranchAccess.create({ userId, branchId }));
    };
    this.students = new InMemoryRepository([{ id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', userId:'abababab-abab-4aba-8bab-abababababab', branchId:branchIds.norte, level:'B1', fullName:'Demo Student', active:true }]);
    this.teachers = new InMemoryRepository([{ id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc', userId:'acacacac-acac-4aca-8cac-acacacacacac', branchId:branchIds.norte, fullName:'Demo Teacher', active:true, hourlyRate:12.5 }]);
    this.danceCategories = new InMemoryRepository([{ id:categoryIds.urban, name:'Urban' },{ id:categoryIds.tropical, name:'Tropical' },{ id:categoryIds.ethnic, name:'Ethnic' }]);
    this.danceStyles = new InMemoryRepository([{ categoryId:categoryIds.urban, name:'Hip hop' },{ categoryId:categoryIds.urban, name:'Afro' },{ categoryId:categoryIds.urban, name:'House' },{ categoryId:categoryIds.urban, name:'Locking' },{ categoryId:categoryIds.urban, name:'Popping' },{ categoryId:categoryIds.urban, name:'Waacking' },{ categoryId:categoryIds.urban, name:'Dancehall' },{ categoryId:categoryIds.urban, name:'Fem' },{ categoryId:categoryIds.urban, name:'Heels' },{ categoryId:categoryIds.tropical, name:'Salsa' },{ categoryId:categoryIds.tropical, name:'Bachata' },{ categoryId:categoryIds.ethnic, name:'Traditional Ecuadorian dances' }]);
    this.teacherStyles = new InMemoryRepository([]);
    this.classGroups = new InMemoryRepository([{ id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd', branchId:branchIds.norte, level:'B1', styleId:null, teacherId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name:'Hip Hop Foundation', active:true, capacity:30 }]);
    const classSessionSeed = [{ id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', classGroupId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name:'Hip Hop Foundation', startsAt:'2026-06-01T18:00:00.000Z', endsAt:'2026-06-01T20:00:00.000Z', status:'scheduled', attendanceState:'draft' }];
    if (process.env.NODE_ENV !== 'test') {
      classSessionSeed.push({
        id:'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
        classGroupId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        name:'Clase operativa de hoy',
        startsAt:new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        endsAt:new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        status:'scheduled',
        attendanceState:'draft',
      });
    }
    this.classSessions = new InMemoryRepository(classSessionSeed);
    this.classGroupEnrollments = new InMemoryRepository([{
      id:'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0',
      studentId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      classGroupId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      status:'active',
      startsAt:'2026-01-01T00:00:00.000Z',
      endsAt:null,
      enrolledAt:'2026-01-01T00:00:00.000Z',
      withdrawalReason:null,
      createdBy:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      createdAt:'2026-01-01T00:00:00.000Z',
      updatedAt:'2026-01-01T00:00:00.000Z',
    }]);
    this.academyEvents = new InMemoryRepository([]);
    this.studentPayments = new InMemoryRepository([]);
    this.studentAttendance = new InMemoryRepository([]);
    this.teacherAttendance = new InMemoryRepository([]);
    this.absenceJustifications = new InMemoryRepository([]);
    this.scholarshipRules = new InMemoryRepository([{ minAttendancePercent:90, periodMonths:2, minimumSessions:8, active:true }]);
    this.scholarshipEvaluations = new InMemoryRepository([]);
    this.levelPromotionEvaluations = new InMemoryRepository([]);
    this.enrollmentRequests = new InMemoryRepository([]);
    this.auditLogs = new InMemoryRepository([]);
    this.sessions = new InMemoryRepository([]);
  }

  async transaction(work) {
    const previous = this.transactionQueue;
    let release;
    this.transactionQueue = new Promise((resolve) => { release = resolve; });
    await previous;

    const repositories = Object.values(this).filter((value) => value instanceof InMemoryRepository);
    const snapshots = new Map(repositories.map((repository) => [repository, structuredClone(repository.rows)]));
    try {
      return await work(this);
    } catch (error) {
      for (const [repository, rows] of snapshots) repository.rows = rows;
      throw error;
    } finally {
      release();
    }
  }
}

module.exports = { DatabaseContext };
