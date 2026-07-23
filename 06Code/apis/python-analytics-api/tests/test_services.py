import unittest

from app.services import AnalyticsService, ForbiddenError, NotFoundError


class FakeRepository:
    def get_student(self, student_id):
        if student_id == "missing":
            return None
        return {
            "id": student_id,
            "full_name": "Camila Rojas",
            "level": "B1",
            "active": True,
            "branch_id": "branch-1",
            "branch_name": "Santo Domingo Central",
        }

    def get_student_by_user(self, user_id):
        if user_id == "student-user-1":
            return {"id": "student-1", "branch_id": "branch-1"}
        return None

    def get_teacher_by_user(self, user_id):
        if user_id == "teacher-user-1":
            return {"id": "teacher-1", "branch_id": "branch-1"}
        return None

    def get_user_branch_ids(self, user_id):
        return ["branch-1"] if user_id == "branch-director-1" else []

    def teacher_has_student(self, teacher_id, student_id):
        return teacher_id == "teacher-1" and student_id == "student-1"

    def get_student_attendance_metrics(self, student_id, start=None, end=None):
        return {
            "total_records": 10,
            "attended_records": 8,
            "absent_records": 2,
            "late_records": 1,
            "last_session_at": None,
        }

    def get_active_scholarship_rule(self):
        return {"min_attendance_percent": 90, "period_months": 2}

    def get_branch(self, branch_id):
        return {"id": branch_id, "name": "Santo Domingo Central", "city": "Santo Domingo", "active": True}

    def get_branch_metrics(self, branch_id):
        return {
            "students_total": 20,
            "students_active": 18,
            "teachers_total": 4,
            "class_groups_total": 6,
            "class_sessions_total": 30,
            "attendance_records_total": 100,
            "attendance_records_positive": 92,
            "pending_enrollment_requests": 3,
        }

    def get_teacher(self, teacher_id):
        return {
            "id": teacher_id,
            "full_name": "Isabella Torres",
            "hourly_rate": 22.5,
            "active": True,
            "branch_id": "branch-1",
            "branch_name": "Santo Domingo Central",
        }

    def get_teacher_workload_metrics(self, teacher_id, start=None, end=None):
        return {
            "check_ins_total": 4,
            "open_check_ins": 1,
            "completed_check_ins": 3,
            "completed_hours": 5.5,
            "class_sessions_total": 4,
        }


class AnalyticsServiceTest(unittest.TestCase):
    def setUp(self):
        self.service = AnalyticsService(FakeRepository())

    def test_attendance_risk_classifies_medium_risk(self):
        result = self.service.attendance_risk("student-1")

        self.assertEqual(result["attendanceRate"], 80.0)
        self.assertEqual(result["riskLevel"], "medium")
        self.assertEqual(result["absentRecords"], 2)

    def test_scholarship_readiness_requires_threshold(self):
        result = self.service.scholarship_readiness("student-1")

        self.assertFalse(result["scholarshipEligible"])
        self.assertEqual(result["missingPercentagePoints"], 10.0)
        self.assertEqual(result["requiredAttendanceRate"], 90.0)

    def test_branch_performance_summary(self):
        result = self.service.branch_performance_summary("branch-1")

        self.assertEqual(result["attendanceRate"], 92.0)
        self.assertEqual(result["performanceLevel"], "strong")
        self.assertEqual(result["pendingEnrollmentRequests"], 3)

    def test_teacher_workload_estimates_pay(self):
        result = self.service.teacher_workload_summary("teacher-1")

        self.assertEqual(result["completedHours"], 5.5)
        self.assertEqual(result["estimatedPay"], 123.75)
        self.assertEqual(result["openCheckIns"], 1)

    def test_missing_student_raises_not_found(self):
        with self.assertRaises(NotFoundError):
            self.service.attendance_risk("missing")

    def test_student_cannot_read_another_student_risk(self):
        with self.assertRaises(ForbiddenError):
            self.service.attendance_risk(
                "student-2",
                current_user={"id": "student-user-1", "email": "s1@example.com", "role": "Student"},
            )

    def test_branch_director_can_read_assigned_branch_summary(self):
        result = self.service.branch_performance_summary(
            "branch-1",
            current_user={"id": "branch-director-1", "email": "director@example.com", "role": "BranchDirector"},
        )

        self.assertEqual(result["branchId"], "branch-1")


if __name__ == "__main__":
    unittest.main()
