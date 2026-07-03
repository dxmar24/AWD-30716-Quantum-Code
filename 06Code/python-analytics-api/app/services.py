from decimal import Decimal


class NotFoundError(Exception):
    pass


def _number(value, default=0):
    if value is None:
        return default
    if isinstance(value, Decimal):
        return float(value)
    return value


def _rate(positive: int, total: int) -> float:
    if not total:
        return 0.0
    return round((positive / total) * 100, 2)


class AnalyticsService:
    def __init__(self, repository):
        self.repository = repository

    def attendance_risk(self, student_id: str, start=None, end=None):
        student = self.repository.get_student(student_id)
        if not student:
            raise NotFoundError("Student not found")

        metrics = self.repository.get_student_attendance_metrics(student_id, start, end) or {}
        total = int(metrics.get("total_records") or 0)
        attended = int(metrics.get("attended_records") or 0)
        attendance_rate = _rate(attended, total)
        risk_level = self._risk_level(attendance_rate, total)

        return {
            "studentId": str(student["id"]),
            "studentName": student["full_name"],
            "branchId": str(student["branch_id"]) if student.get("branch_id") else None,
            "branchName": student.get("branch_name"),
            "level": student.get("level"),
            "totalRecords": total,
            "attendedRecords": attended,
            "absentRecords": int(metrics.get("absent_records") or 0),
            "lateRecords": int(metrics.get("late_records") or 0),
            "attendanceRate": attendance_rate,
            "riskLevel": risk_level,
            "lastSessionAt": metrics.get("last_session_at"),
            "recommendation": self._attendance_recommendation(attendance_rate, total),
        }

    def scholarship_readiness(self, student_id: str, start=None, end=None):
        student_risk = self.attendance_risk(student_id, start, end)
        rule = self.repository.get_active_scholarship_rule() or {}
        threshold = float(_number(rule.get("min_attendance_percent"), 90))
        period_months = int(rule.get("period_months") or 2)
        attendance_rate = student_risk["attendanceRate"]
        eligible = student_risk["totalRecords"] > 0 and attendance_rate >= threshold

        return {
            "studentId": student_risk["studentId"],
            "studentName": student_risk["studentName"],
            "attendanceRate": attendance_rate,
            "requiredAttendanceRate": threshold,
            "periodMonths": period_months,
            "scholarshipEligible": eligible,
            "missingPercentagePoints": round(max(threshold - attendance_rate, 0), 2),
            "recommendation": (
                "Student meets the scholarship attendance threshold."
                if eligible
                else f"Student needs at least {threshold:.2f}% attendance for scholarship eligibility."
            ),
        }

    def branch_performance_summary(self, branch_id: str):
        branch = self.repository.get_branch(branch_id)
        if not branch:
            raise NotFoundError("Branch not found")
        metrics = self.repository.get_branch_metrics(branch_id) or {}
        total_attendance = int(metrics.get("attendance_records_total") or 0)
        positive_attendance = int(metrics.get("attendance_records_positive") or 0)
        attendance_rate = _rate(positive_attendance, total_attendance)

        return {
            "branchId": str(branch["id"]),
            "branchName": branch["name"],
            "city": branch.get("city"),
            "active": branch.get("active"),
            "studentsTotal": int(metrics.get("students_total") or 0),
            "studentsActive": int(metrics.get("students_active") or 0),
            "teachersTotal": int(metrics.get("teachers_total") or 0),
            "classGroupsTotal": int(metrics.get("class_groups_total") or 0),
            "classSessionsTotal": int(metrics.get("class_sessions_total") or 0),
            "attendanceRecordsTotal": total_attendance,
            "attendanceRate": attendance_rate,
            "pendingEnrollmentRequests": int(metrics.get("pending_enrollment_requests") or 0),
            "performanceLevel": self._branch_performance_level(attendance_rate, total_attendance),
        }

    def teacher_workload_summary(self, teacher_id: str, start=None, end=None):
        teacher = self.repository.get_teacher(teacher_id)
        if not teacher:
            raise NotFoundError("Teacher not found")
        metrics = self.repository.get_teacher_workload_metrics(teacher_id, start, end) or {}
        hourly_rate = float(_number(teacher.get("hourly_rate"), 0))
        hours = round(float(metrics.get("completed_hours") or 0), 2)

        return {
            "teacherId": str(teacher["id"]),
            "teacherName": teacher["full_name"],
            "branchId": str(teacher["branch_id"]) if teacher.get("branch_id") else None,
            "branchName": teacher.get("branch_name"),
            "hourlyRate": hourly_rate,
            "checkInsTotal": int(metrics.get("check_ins_total") or 0),
            "completedCheckIns": int(metrics.get("completed_check_ins") or 0),
            "openCheckIns": int(metrics.get("open_check_ins") or 0),
            "classSessionsTotal": int(metrics.get("class_sessions_total") or 0),
            "completedHours": hours,
            "estimatedPay": round(hours * hourly_rate, 2),
        }

    def _risk_level(self, attendance_rate: float, total: int) -> str:
        if total == 0:
            return "no_data"
        if attendance_rate < 75:
            return "high"
        if attendance_rate < 90:
            return "medium"
        return "low"

    def _attendance_recommendation(self, attendance_rate: float, total: int) -> str:
        if total == 0:
            return "No attendance records are available for this student."
        if attendance_rate < 75:
            return "Immediate attendance follow-up is recommended."
        if attendance_rate < 90:
            return "Student is close to the scholarship threshold but needs improvement."
        return "Student attendance is healthy."

    def _branch_performance_level(self, attendance_rate: float, total: int) -> str:
        if total == 0:
            return "no_data"
        if attendance_rate >= 90:
            return "strong"
        if attendance_rate >= 75:
            return "watch"
        return "needs_attention"
