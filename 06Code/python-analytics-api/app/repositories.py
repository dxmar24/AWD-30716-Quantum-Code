from datetime import datetime
from typing import Any


class AnalyticsRepository:
    def __init__(self, connection):
        self.connection = connection

    def _one(self, query: str, params: tuple[Any, ...]):
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()

    def get_student(self, student_id: str):
        return self._one(
            """
            SELECT s.id, s.full_name, s.level, s.active, b.id AS branch_id, b.name AS branch_name
            FROM students s
            LEFT JOIN branches b ON b.id = s.branch_id
            WHERE s.id = %s
            LIMIT 1
            """,
            (student_id,),
        )

    def get_student_by_user(self, user_id: str):
        return self._one(
            """
            SELECT id, branch_id
            FROM students
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

    def get_teacher_by_user(self, user_id: str):
        return self._one(
            """
            SELECT id, branch_id
            FROM teachers
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

    def get_user_branch_ids(self, user_id: str):
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT branch_id
                FROM user_branch_access
                WHERE user_id = %s
                """,
                (user_id,),
            )
            return [row["branch_id"] for row in cursor.fetchall()]

    def teacher_has_student(self, teacher_id: str, student_id: str):
        row = self._one(
            """
            SELECT 1
            FROM student_attendance_records sar
            JOIN class_sessions cs ON cs.id = sar.class_session_id
            JOIN class_groups cg ON cg.id = cs.class_group_id
            WHERE sar.student_id = %s
              AND cg.teacher_id = %s
            LIMIT 1
            """,
            (student_id, teacher_id),
        )
        return bool(row)

    def get_student_attendance_metrics(self, student_id: str, start: datetime | None = None, end: datetime | None = None):
        params: list[Any] = [student_id]
        date_filter = ""
        if start:
            params.append(start)
            date_filter += f" AND cs.starts_at >= %s"
        if end:
            params.append(end)
            date_filter += f" AND cs.starts_at <= %s"

        return self._one(
            f"""
            SELECT
              COUNT(sar.id)::int AS total_records,
              COALESCE(SUM(CASE WHEN sar.status IN ('present', 'late', 'justified') THEN 1 ELSE 0 END), 0)::int AS attended_records,
              COALESCE(SUM(CASE WHEN sar.status = 'absent' THEN 1 ELSE 0 END), 0)::int AS absent_records,
              COALESCE(SUM(CASE WHEN sar.status = 'late' THEN 1 ELSE 0 END), 0)::int AS late_records,
              MAX(cs.starts_at) AS last_session_at
            FROM student_attendance_records sar
            LEFT JOIN class_sessions cs ON cs.id = sar.class_session_id
            WHERE sar.student_id = %s
            {date_filter}
            """,
            tuple(params),
        )

    def get_active_scholarship_rule(self):
        return self._one(
            """
            SELECT min_attendance_percent, period_months
            FROM scholarship_rules
            WHERE active = TRUE
            ORDER BY period_months DESC
            LIMIT 1
            """,
            (),
        )

    def get_branch(self, branch_id: str):
        return self._one(
            """
            SELECT id, name, city, active
            FROM branches
            WHERE id = %s
            LIMIT 1
            """,
            (branch_id,),
        )

    def get_branch_metrics(self, branch_id: str):
        return self._one(
            """
            SELECT
              (SELECT COUNT(*)::int FROM students WHERE branch_id = %s) AS students_total,
              (SELECT COUNT(*)::int FROM students WHERE branch_id = %s AND active = TRUE) AS students_active,
              (SELECT COUNT(*)::int FROM teachers WHERE branch_id = %s) AS teachers_total,
              (SELECT COUNT(*)::int FROM class_groups WHERE branch_id = %s) AS class_groups_total,
              (
                SELECT COUNT(cs.id)::int
                FROM class_sessions cs
                JOIN class_groups cg ON cg.id = cs.class_group_id
                WHERE cg.branch_id = %s
              ) AS class_sessions_total,
              (
                SELECT COUNT(sar.id)::int
                FROM student_attendance_records sar
                JOIN students s ON s.id = sar.student_id
                WHERE s.branch_id = %s
              ) AS attendance_records_total,
              (
                SELECT COALESCE(SUM(CASE WHEN sar.status IN ('present', 'late', 'justified') THEN 1 ELSE 0 END), 0)::int
                FROM student_attendance_records sar
                JOIN students s ON s.id = sar.student_id
                WHERE s.branch_id = %s
              ) AS attendance_records_positive,
              (
                SELECT COUNT(*)::int
                FROM enrollment_requests
                WHERE branch_id = %s AND COALESCE(status, 'pending') = 'pending'
              ) AS pending_enrollment_requests
            """,
            (branch_id, branch_id, branch_id, branch_id, branch_id, branch_id, branch_id, branch_id),
        )

    def get_teacher(self, teacher_id: str):
        return self._one(
            """
            SELECT t.id, t.full_name, t.hourly_rate, t.active, b.id AS branch_id, b.name AS branch_name
            FROM teachers t
            LEFT JOIN branches b ON b.id = t.branch_id
            WHERE t.id = %s
            LIMIT 1
            """,
            (teacher_id,),
        )

    def get_teacher_workload_metrics(self, teacher_id: str, start: datetime | None = None, end: datetime | None = None):
        params: list[Any] = [teacher_id]
        date_filter = ""
        if start:
            params.append(start)
            date_filter += " AND check_in_at >= %s"
        if end:
            params.append(end)
            date_filter += " AND check_in_at <= %s"

        return self._one(
            f"""
            SELECT
              COUNT(id)::int AS check_ins_total,
              COALESCE(SUM(CASE WHEN check_out_at IS NULL THEN 1 ELSE 0 END), 0)::int AS open_check_ins,
              COALESCE(SUM(CASE WHEN check_out_at IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS completed_check_ins,
              COALESCE(SUM(EXTRACT(EPOCH FROM (check_out_at - check_in_at)) / 3600), 0)::float AS completed_hours,
              COUNT(DISTINCT class_session_id)::int AS class_sessions_total
            FROM teacher_attendance_records
            WHERE teacher_id = %s
            {date_filter}
            """,
            tuple(params),
        )


class SessionRepository:
    def __init__(self, connection):
        self.connection = connection

    def get_user_for_token_hash(self, token_hash: str):
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                  s.revoked,
                  s.expires_at,
                  s.user_id AS session_user_id,
                  u.id,
                  u.email,
                  u.name,
                  u.active,
                  u.must_change_password,
                  COALESCE(r.name, 'Student') AS role
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                LEFT JOIN roles r ON r.id = u.role_id
                WHERE s.token_hash = %s
                LIMIT 1
                """,
                (token_hash,),
            )
            return cursor.fetchone()
