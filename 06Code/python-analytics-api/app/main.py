from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .auth import get_current_user
from .config import Settings, get_settings
from .database import Database, get_database
from .repositories import AnalyticsRepository
from .services import AnalyticsService, NotFoundError


def envelope(data, message: str = "OK"):
    return {"success": True, "message": message, "data": data}


def get_service(database: Database = Depends(get_database)):
    with database.connect() as connection:
        yield AnalyticsService(AnalyticsRepository(connection))


settings = get_settings()
app = FastAPI(title=settings.service_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(HTTPException)
def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail, "data": None},
    )


@app.get("/api/analytics/v1/health")
def health(settings: Settings = Depends(get_settings)):
    return envelope(
        {
            "service": settings.service_name,
            "status": "healthy",
            "authRequired": settings.auth_required,
        },
        "Analytics API healthy",
    )


@app.get("/api/analytics/v1/students/{student_id}/attendance-risk")
def student_attendance_risk(
    student_id: str,
    start: datetime | None = Query(None, alias="from"),
    end: datetime | None = Query(None, alias="to"),
    current_user=Depends(get_current_user),
    service: AnalyticsService = Depends(get_service),
):
    try:
        return envelope(service.attendance_risk(student_id, start, end), "Student attendance risk")
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/analytics/v1/students/{student_id}/scholarship-readiness")
def student_scholarship_readiness(
    student_id: str,
    start: datetime | None = Query(None, alias="from"),
    end: datetime | None = Query(None, alias="to"),
    current_user=Depends(get_current_user),
    service: AnalyticsService = Depends(get_service),
):
    try:
        return envelope(service.scholarship_readiness(student_id, start, end), "Student scholarship readiness")
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/analytics/v1/branches/{branch_id}/performance-summary")
def branch_performance_summary(
    branch_id: str,
    current_user=Depends(get_current_user),
    service: AnalyticsService = Depends(get_service),
):
    try:
        return envelope(service.branch_performance_summary(branch_id), "Branch performance summary")
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/analytics/v1/teachers/{teacher_id}/workload-summary")
def teacher_workload_summary(
    teacher_id: str,
    start: datetime | None = Query(None, alias="from"),
    end: datetime | None = Query(None, alias="to"),
    current_user=Depends(get_current_user),
    service: AnalyticsService = Depends(get_service),
):
    try:
        return envelope(service.teacher_workload_summary(teacher_id, start, end), "Teacher workload summary")
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
