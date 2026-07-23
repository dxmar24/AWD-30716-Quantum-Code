const { ApiResponse } = require('../utils/ApiResponse');

class AttendanceController {
  constructor(attendanceService) {
    this.attendanceService = attendanceService;
  }

  listEnrollments = async (req, res) => ApiResponse.success(
    res,
    await this.attendanceService.listEnrollments(req.sessionUser),
    'Class group enrollments',
  );

  createEnrollment = async (req, res) => ApiResponse.success(
    res,
    await this.attendanceService.createEnrollment(req.sessionUser, req.body),
    'Class group enrollment created',
    201,
  );

  updateEnrollment = async (req, res) => ApiResponse.success(
    res,
    await this.attendanceService.updateEnrollment(req.sessionUser, req.params.id, req.body),
    'Class group enrollment updated',
  );

  deleteEnrollment = async (req, res) => ApiResponse.success(
    res,
    await this.attendanceService.deleteEnrollment(req.sessionUser, req.params.id),
    'Class group enrollment deleted',
  );

  sessionRoster = async (req, res) => ApiResponse.success(
    res,
    await this.attendanceService.getSessionRoster(req.sessionUser, req.params.id),
    'Class session roster',
  );

  sessionAttendance = async (req, res) => ApiResponse.success(
    res,
    await this.attendanceService.recordSessionAttendance(req.sessionUser, req.params.id, req.body),
    req.body.state === 'finalized' ? 'Class session attendance finalized' : 'Class session attendance draft saved',
  );

  recordStudent = async (req, res) => ApiResponse.success(
    res,
    await this.attendanceService.recordStudentAttendance(req.sessionUser, req.body),
    'Attendance recorded',
    201,
  );

  listTeacherAttendance = async (req, res) => ApiResponse.success(
    res,
    await this.attendanceService.listTeacherAttendance(req.sessionUser),
    'Teacher attendance list',
  );

  teacherCheckIn = async (req, res) => ApiResponse.success(
    res,
    await this.attendanceService.checkInTeacher(req.sessionUser, req.body),
    'Teacher checked in',
    201,
  );

  teacherCheckOut = async (req, res) => ApiResponse.success(
    res,
    await this.attendanceService.checkOutTeacher(req.sessionUser, req.params.id),
    'Teacher checked out',
  );
}

module.exports = { AttendanceController };
