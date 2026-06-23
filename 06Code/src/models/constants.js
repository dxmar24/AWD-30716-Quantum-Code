const Roles = Object.freeze({ VISITOR:'Visitor', STUDENT:'Student', TEACHER:'Teacher', BRANCH_DIRECTOR:'BranchDirector', GENERAL_DIRECTOR:'GeneralDirector', ADMIN:'Admin' });
const AttendanceStatus = Object.freeze({ PRESENT:'present', ABSENT:'absent', JUSTIFIED:'justified', LATE:'late' });
module.exports = { Roles, AttendanceStatus };
