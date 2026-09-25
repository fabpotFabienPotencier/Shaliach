"""
Global error handling and exception formatting middleware.
Matches the NestJS exception response schema expected by web frontend.
"""

from datetime import datetime, timezone
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from ..errors import AppError, ErrorCode

logger = logging.getLogger("shaliach.error")


def _cors_response(request: Request, status_code: int, payload: dict) -> JSONResponse:
    headers = {}
    origin = request.headers.get("origin")
    if origin and ("fixhubtech.com" in origin or "localhost" in origin or "127.0.0.1" in origin):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"

    return JSONResponse(status_code=status_code, content=payload, headers=headers)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        status_code = exc.status_code
        payload = {
            "success": False,
            "statusCode": status_code,
            "code": exc.code,
            "message": exc.error_message,
            "details": exc.details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "path": str(request.url.path),
        }
        if status_code >= 500:
            logger.error(f"[{request.method}] {request.url.path} - Status: {status_code} - Code: {exc.code} - Message: {exc.error_message}")
        else:
            logger.warning(f"[{request.method}] {request.url.path} - Status: {status_code} - Code: {exc.code} - Message: {exc.error_message}")

        return _cors_response(request, status_code, payload)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        status_code = 400
        errors = exc.errors()
        message = "Validation failed"
        if errors:
            first_err = errors[0]
            loc = " -> ".join(str(l) for l in first_err.get("loc", []))
            msg = first_err.get("msg", "Invalid value")
            message = f"{loc}: {msg}" if loc else msg

        payload = {
            "success": False,
            "statusCode": status_code,
            "code": ErrorCode.VALIDATION_FAILED,
            "message": message,
            "details": {"errors": errors},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "path": str(request.url.path),
        }
        logger.warning(f"[{request.method}] {request.url.path} - Validation Error: {message}")
        return _cors_response(request, status_code, payload)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        status_code = exc.status_code
        message = str(exc.detail) if isinstance(exc.detail, str) else "HTTP Exception"
        code = ErrorCode.INTERNAL_ERROR if status_code >= 500 else ErrorCode.UNAUTHORIZED if status_code == 401 else "HTTP_ERROR"
        details = None

        if isinstance(exc.detail, dict):
            message = exc.detail.get("message", message)
            code = exc.detail.get("code", code)
            details = exc.detail.get("details", details)

        payload = {
            "success": False,
            "statusCode": status_code,
            "code": code,
            "message": message,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "path": str(request.url.path),
        }
        return _cors_response(request, status_code, payload)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
        payload = {
            "success": False,
            "statusCode": 500,
            "code": ErrorCode.INTERNAL_ERROR,
            "message": str(exc) or "An unexpected internal server error occurred",
            "details": f"{type(exc).__name__}: {str(exc)}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "path": str(request.url.path),
        }
        return _cors_response(request, 500, payload)
