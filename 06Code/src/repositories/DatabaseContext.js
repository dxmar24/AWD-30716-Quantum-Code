const { InMemoryRepository } = require('./InMemoryRepository');
const { Roles } = require('../models/constants');
const branchIds = { norte:'11111111-1111-4111-8111-111111111111', matriz:'22222222-2222-4222-8222-222222222222' };
class DatabaseContext {
  constructor() {
    this.users = new InMemoryRepository([{ id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email:'admin@alc.edu', name:'Admin User', role:Roles.ADMIN, googleSub:'test-admin' }]);
    this.branches = new InMemoryRepository([{ id:branchIds.norte, name:'Norte', city:'Quito' },{ id:branchIds.matriz, name:'Matriz', city:'Quito' },{ name:'Sur Guamaní', city:'Quito' },{ name:'Tumbaco', city:'Quito' },{ name:'Conocoto', city:'Quito' }]);
    this.students = new InMemoryRepository([{ id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', userId:null, branchId:branchIds.norte, level:'B1', fullName:'Demo Student', active:true }]);
    this.teachers = new InMemoryRepository([{ id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc', userId:null, branchId:branchIds.norte, fullName:'Demo Teacher', active:true, hourlyRate:12.5 }]);
    this.classGroups = new InMemoryRepository([{ id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd', branchId:branchIds.norte, level:'B1', styleId:null, name:'B1 Urban Norte' }]);
    this.classSessions = new InMemoryRepository([{ id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', classGroupId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd', startsAt:'2026-06-01T18:00:00.000Z', endsAt:'2026-06-01T20:00:00.000Z' }]);
    this.studentAttendance = new InMemoryRepository([]); this.teacherAttendance = new InMemoryRepository([]); this.auditLogs = new InMemoryRepository([]); this.sessions = new InMemoryRepository([]);
  }
}
module.exports = { DatabaseContext };
