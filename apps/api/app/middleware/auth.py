"""
Session authentication middleware for attaching session details to request state.
"""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class SessionAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Extract session id from cookies or headers
        session_id = request.cookies.get("shaliach_session")
        if not session_id:
            session_id = request.headers.get("x-session-id")
        if not session_id:
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                session_id = auth_header[7:].strip()

        request.state.session_id = session_id
        response = await call_next(request)
        return response
