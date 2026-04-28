"""
Vat-Officer Backend - FastAPI Application
VATSIM Flight Companion / Digital Kneeboard
"""

import os
import sys
import logging
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

_backend_dir = Path(__file__).resolve().parent
_parent_dir = _backend_dir.parent
if str(_parent_dir) not in sys.path:
    sys.path.insert(0, str(_parent_dir))

# Import handling for both Docker (package) and local development
if __name__.startswith('backend.') or __name__ == 'backend.main':
    from backend.functions import (
        fetch_vatsim_data,
        filter_controllers,
        get_atis_info,
        fetch_realworld_atis,
        validate_icao_code,
        sanitize_icao_code,
        find_pilot_by_callsign,
        extract_flight_data,
    )
    from backend.acars import (
        send_acars_message,
        poll_acars_messages,
        peek_acars_messages,
        format_pdc_request,
        format_clearance_request,
        validate_callsign,
        validate_icao_code,
        sanitize_callsign,
        sanitize_atc_callsign,
        sanitize_icao_code as sanitize_icao_acars
    )
else:
    from functions import (
        fetch_vatsim_data,
        filter_controllers,
        get_atis_info,
        fetch_realworld_atis,
        validate_icao_code,
        sanitize_icao_code,
        find_pilot_by_callsign,
        extract_flight_data,
    )
    from acars import (
        send_acars_message,
        poll_acars_messages,
        peek_acars_messages,
        format_pdc_request,
        format_clearance_request,
        validate_callsign,
        validate_icao_code,
        sanitize_callsign,
        sanitize_atc_callsign,
        sanitize_icao_code as sanitize_icao_acars
    )

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

APP_TITLE = "Vat-Officer - VATSIM Flight Companion"
APP_VERSION = "1.0.0"

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR.parent / "frontend" / "dist"

RATE_LIMIT_REQUESTS = 30
RATE_LIMIT_WINDOW = 60

limiter = Limiter(key_func=get_remote_address)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        csp = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
            "img-src 'self' data:; "
            "connect-src 'self' https://data.vatsim.net; "
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs API requests to stdout."""
    
    async def dispatch(self, request: StarletteRequest, call_next):
        path = request.url.path
        
        if path in ['/api/health', '/favicon.ico'] or path.startswith('/assets/'):
            return await call_next(request)
        
        is_automatic_refresh = request.headers.get('X-Automatic-Refresh', '').lower() == 'true'
        
        start_time = time.time()
        client_ip = get_remote_address(request)
        
        if not is_automatic_refresh:
            logger.info(f"API Request: {request.method} {path} from {client_ip}")
        
        try:
            response = await call_next(request)
            
            if response.status_code >= 400:
                logger.warning(f"API Error: {request.method} {path} returned {response.status_code}")
            
            return response
            
        except Exception as e:
            logger.error(f"API Exception: {request.method} {path} - {str(e)}", exc_info=True)
            raise


app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description="A web-based VATSIM flight companion and digital kneeboard application.",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "version": APP_VERSION}


@app.get("/api/vatsim/controllers")
@limiter.limit("30/minute")
async def get_controllers(
    request: Request,
    airport: Optional[str] = Query(
        None,
        description="ICAO airport code (e.g., EGLL, KJFK)",
        min_length=2,
        max_length=4,
        pattern=r'^[A-Za-z]{2,4}$'
    ),
    fir: Optional[str] = Query(
        None,
        description="FIR/ARTCC code (e.g., EGTT, ZNY)",
        min_length=2,
        max_length=4,
        pattern=r'^[A-Za-z]{2,4}$'
    )
):
    """
    Get currently active VATSIM controllers.
    
    Optionally filter by airport ICAO code or FIR/ARTCC code.
    Data is cached for 30 seconds to avoid excessive API calls.
    """
    airport = sanitize_icao_code(airport)
    fir = sanitize_icao_code(fir)
    
    if airport and not validate_icao_code(airport):
        raise HTTPException(
            status_code=400,
            detail="Invalid airport ICAO code format"
        )
    
    if fir and not validate_icao_code(fir):
        raise HTTPException(
            status_code=400,
            detail="Invalid FIR code format"
        )
    
    try:
        data = await fetch_vatsim_data()
        controllers = filter_controllers(data, airport=airport, fir=fir)
        
        return {
            "success": True,
            "count": len(controllers),
            "controllers": controllers,
            "filters": {
                "airport": airport,
                "fir": fir
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to fetch VATSIM data: {str(e)}"
        )


@app.get("/api/vatsim/pilot/{callsign}")
@limiter.limit("30/minute")
async def get_pilot(
    request: Request,
    callsign: str,
):
    """
    Get flight information for a specific pilot by callsign.
    
    Returns pilot's current position, flight plan, and other details.
    """
    callsign = callsign.strip().upper()
    if not callsign or len(callsign) < 2 or len(callsign) > 10:
        raise HTTPException(
            status_code=400,
            detail="Invalid callsign format"
        )
    
    if not all(c.isalnum() or c == '-' for c in callsign):
        raise HTTPException(
            status_code=400,
            detail="Callsign must be alphanumeric"
        )
    
    try:
        data = await fetch_vatsim_data()
        pilot = find_pilot_by_callsign(data, callsign)
        
        if not pilot:
            return {
                "success": False,
                "found": False,
                "message": f"No pilot found with callsign {callsign}",
                "callsign": callsign
            }
        
        flight_data = extract_flight_data(pilot)
        
        return {
            "success": True,
            "found": True,
            "callsign": callsign,
            "flight": flight_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to fetch VATSIM data: {str(e)}"
        )


@app.get("/api/vatsim/atis")
@limiter.limit("30/minute")
async def get_atis(
    request: Request,
    airport: Optional[str] = Query(
        None,
        description="ICAO airport code (e.g., EGLL, KJFK)",
        min_length=2,
        max_length=4,
        pattern=r'^[A-Za-z]{2,4}$'
    )
):
    """
    Get ATIS information for airports.
    
    Optionally filter by airport ICAO code.
    """
    airport = sanitize_icao_code(airport)
    
    if airport and not validate_icao_code(airport):
        raise HTTPException(
            status_code=400,
            detail="Invalid airport ICAO code format"
        )
    
    try:
        data = await fetch_vatsim_data()
        atis_info = get_atis_info(data, airport=airport)
        
        return {
            "success": True,
            "count": len(atis_info),
            "atis": atis_info,
            "filters": {
                "airport": airport
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to fetch VATSIM data: {str(e)}"
        )


@app.get("/api/atis/realworld")
@limiter.limit("30/minute")
async def get_realworld_atis(
    request: Request,
    airport: str = Query(
        ...,
        description="ICAO airport code (e.g., EGLL, KJFK)",
        min_length=2,
        max_length=4,
        pattern=r'^[A-Za-z]{2,4}$'
    )
):
    """
    Get real-world METAR data for an airport.
    
    Uses Aviation Weather Center's free METAR service for current weather
    information similar to what ATIS broadcasts.
    """
    airport = sanitize_icao_code(airport)
    
    if not airport or not validate_icao_code(airport):
        raise HTTPException(
            status_code=400,
            detail="Invalid airport ICAO code format"
        )
    
    try:
        result = await fetch_realworld_atis(airport)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=404,
                detail=result.get("error", "Failed to fetch real-world ATIS data")
            )
        
        return {
            "success": True,
            "airport": airport,
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to fetch real-world ATIS data: {str(e)}"
        )


# ACARS request models

class ACARSSendRequest(BaseModel):
    logon_code: str
    from_callsign: str
    to_callsign: str
    message_type: str = "telex"
    message: str


class ACARSPollRequest(BaseModel):
    logon_code: str
    callsign: str


class ACARSPDCRequest(BaseModel):
    logon_code: str
    from_callsign: str
    to_callsign: str
    aircraft_type: str
    departure: str
    destination: str
    stand: Optional[str] = None
    atis: Optional[str] = None


@app.post("/api/acars/send")
@limiter.limit("20/minute")
async def send_acars(
    request: Request,
    acars_request: ACARSSendRequest,
):
    """
    Send an ACARS message via Hoppie's ACARS system.
    
    Requires a valid Hoppie logon code, sender/recipient callsigns,
    message type (telex or cpdlc), and message content.
    """
    from_callsign = sanitize_callsign(acars_request.from_callsign)
    to_callsign = sanitize_atc_callsign(acars_request.to_callsign)
    
    if not from_callsign:
        raise HTTPException(
            status_code=400,
            detail="Invalid from callsign format"
        )
    
    if not to_callsign:
        raise HTTPException(
            status_code=400,
            detail="Invalid to callsign format"
        )
    
    if acars_request.message_type not in ["telex", "cpdlc"]:
        raise HTTPException(
            status_code=400,
            detail="Message type must be 'telex' or 'cpdlc'"
        )
    
    if not acars_request.message or not acars_request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message content cannot be empty"
        )
    
    if not acars_request.logon_code or not acars_request.logon_code.strip():
        raise HTTPException(
            status_code=400,
            detail="Logon code is required"
        )
    
    try:
        result = await send_acars_message(
            logon_code=acars_request.logon_code.strip(),
            from_callsign=from_callsign,
            to_callsign=to_callsign,
            message_type=acars_request.message_type,
            message=acars_request.message
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to send ACARS message")
            )
        
        return {
            "success": True,
            "response": result.get("response", ""),
            "message": "ACARS message sent successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error sending ACARS message: {str(e)}"
        )


@app.post("/api/acars/peek")
@limiter.limit("30/minute")
async def peek_acars(
    request: Request,
    acars_request: ACARSPollRequest,
):
    """
    Peek at incoming ACARS messages without consuming them.
    
    Messages remain in the queue so other clients (like flight sims)
    can still receive them.
    """
    callsign = sanitize_callsign(acars_request.callsign)
    
    if not callsign:
        raise HTTPException(
            status_code=400,
            detail="Invalid callsign format"
        )
    
    if not acars_request.logon_code or not acars_request.logon_code.strip():
        raise HTTPException(
            status_code=400,
            detail="Logon code is required"
        )
    
    try:
        result = await peek_acars_messages(
            logon_code=acars_request.logon_code.strip(),
            callsign=callsign
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to peek ACARS messages")
            )
        
        return {
            "success": True,
            "messages": result.get("messages", []),
            "count": len(result.get("messages", []))
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error peeking ACARS messages: {str(e)}"
        )


@app.post("/api/acars/poll")
@limiter.limit("20/minute")
async def poll_acars(
    request: Request,
    acars_request: ACARSPollRequest,
):
    """
    Poll for incoming ACARS messages (consumes them from the queue).
    
    Warning: this removes messages from the Hoppie queue, preventing other
    clients (like flight simulators) from receiving them.
    """
    callsign = sanitize_callsign(acars_request.callsign)
    
    if not callsign:
        raise HTTPException(
            status_code=400,
            detail="Invalid callsign format"
        )
    
    if not acars_request.logon_code or not acars_request.logon_code.strip():
        raise HTTPException(
            status_code=400,
            detail="Logon code is required"
        )
    
    try:
        result = await poll_acars_messages(
            logon_code=acars_request.logon_code.strip(),
            callsign=callsign
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to poll ACARS messages")
            )
        
        return {
            "success": True,
            "messages": result.get("messages", []),
            "count": len(result.get("messages", []))
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error polling ACARS messages: {str(e)}"
        )


@app.post("/api/acars/pdc")
@limiter.limit("20/minute")
async def request_pdc(
    request: Request,
    pdc_request: ACARSPDCRequest,
):
    """
    Send a Pre-Departure Clearance (PDC) request via ACARS.
    
    Formats a standard PDC request message and sends it to the
    specified ATC facility via Hoppie's network.
    """
    from_callsign = sanitize_callsign(pdc_request.from_callsign)
    to_callsign = sanitize_atc_callsign(pdc_request.to_callsign)
    departure = sanitize_icao_acars(pdc_request.departure)
    destination = sanitize_icao_acars(pdc_request.destination)
    
    if not from_callsign:
        raise HTTPException(
            status_code=400,
            detail="Invalid from callsign format"
        )
    
    if not to_callsign:
        raise HTTPException(
            status_code=400,
            detail="Invalid to callsign format"
        )
    
    if not departure:
        raise HTTPException(
            status_code=400,
            detail="Invalid departure airport ICAO code"
        )
    
    if not destination:
        raise HTTPException(
            status_code=400,
            detail="Invalid destination airport ICAO code"
        )
    
    if not pdc_request.aircraft_type or not pdc_request.aircraft_type.strip():
        raise HTTPException(
            status_code=400,
            detail="Aircraft type is required"
        )
    
    if not pdc_request.logon_code or not pdc_request.logon_code.strip():
        raise HTTPException(
            status_code=400,
            detail="Logon code is required"
        )
    
    try:
        pdc_message = format_pdc_request(
            callsign=from_callsign,
            aircraft_type=pdc_request.aircraft_type.strip().upper(),
            departure=departure,
            destination=destination,
            stand=pdc_request.stand,
            atis=pdc_request.atis
        )
        
        result = await send_acars_message(
            logon_code=pdc_request.logon_code.strip(),
            from_callsign=from_callsign,
            to_callsign=to_callsign,
            message_type="telex",
            message=pdc_message
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to send PDC request")
            )
        
        return {
            "success": True,
            "response": result.get("response", ""),
            "message": "PDC request sent successfully",
            "pdc_message": pdc_message
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error sending PDC request: {str(e)}"
        )


# Serve the built React frontend if available
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve the React frontend application (SPA catch-all)."""
        if full_path.startswith("api/") or full_path.startswith("assets/"):
            raise HTTPException(status_code=404, detail="Not found")
        
        file_path = STATIC_DIR / full_path
        
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        raise HTTPException(status_code=404, detail="Not found")
else:
    @app.get("/")
    async def root():
        """Root endpoint when no frontend is built."""
        return {
            "message": "Vat-Officer API is running",
            "docs": "/api/docs",
            "note": "Frontend not built. Run 'npm run build' in the frontend directory."
        }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True
    )
