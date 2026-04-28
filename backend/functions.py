"""
Vat-Officer Backend Functions
All backend logic for the VATSIM flight companion application.
"""

import asyncio
import re
import time
from typing import Optional
import httpx

# Cache for VATSIM data to avoid excessive API calls
_vatsim_cache = {
    "data": None,
    "timestamp": 0,
    "ttl": 30  # Cache TTL in seconds
}

# Lock to prevent race conditions when updating cache
_cache_lock = asyncio.Lock()

# VATSIM API endpoint
VATSIM_DATA_URL = "https://data.vatsim.net/v3/vatsim-data.json"

# Shared HTTP client for connection pooling
_http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    """
    Get or create a shared HTTP client instance for connection pooling.
    This improves performance by reusing connections across requests.
    """
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            timeout=10.0,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
        )
    return _http_client

# Controller facility type suffixes
FACILITY_TYPES = {
    "_DEL": "Delivery",
    "_GND": "Ground",
    "_TWR": "Tower",
    "_APP": "Approach",
    "_DEP": "Departure",
    "_CTR": "Center",
    "_FSS": "Flight Service Station",
    "_ATIS": "ATIS"
}

# ICAO code validation pattern (2-4 uppercase letters)
ICAO_PATTERN = re.compile(r'^[A-Z]{2,4}$')


def validate_icao_code(code: Optional[str]) -> bool:
    """
    Validate an ICAO airport or FIR code.
    
    Args:
        code: The ICAO code to validate (e.g., "EGLL", "EGTT")
    
    Returns:
        True if valid, False otherwise
    """
    if code is None:
        return True  # None is valid (means no filter)
    return bool(ICAO_PATTERN.match(code.upper()))


def sanitize_icao_code(code: Optional[str]) -> Optional[str]:
    """
    Sanitize and normalize an ICAO code.
    
    Args:
        code: The ICAO code to sanitize
    
    Returns:
        Sanitized uppercase code or None if invalid
    """
    if code is None or code.strip() == "":
        return None
    
    sanitized = code.strip().upper()
    if validate_icao_code(sanitized):
        return sanitized
    return None


async def fetch_vatsim_data() -> dict:
    """
    Fetch VATSIM network data with caching and thread-safe updates.
    
    Returns cached data if within TTL, otherwise fetches fresh data
    from the VATSIM API. Uses a lock to prevent race conditions when
    multiple concurrent requests try to update the cache simultaneously.
    
    Returns:
        Dictionary containing VATSIM network data
    
    Raises:
        httpx.HTTPError: If the API request fails
    """
    current_time = time.time()
    
    # Fast path: check cache without lock (read-only)
    if (_vatsim_cache["data"] is not None and 
        current_time - _vatsim_cache["timestamp"] < _vatsim_cache["ttl"]):
        return _vatsim_cache["data"]
    
    # Cache expired or missing - acquire lock to update
    async with _cache_lock:
        # Double-check after acquiring lock (another request may have updated it)
        if (_vatsim_cache["data"] is not None and 
            current_time - _vatsim_cache["timestamp"] < _vatsim_cache["ttl"]):
            return _vatsim_cache["data"]
        
        # Fetch fresh data using shared HTTP client
        client = get_http_client()
        response = await client.get(VATSIM_DATA_URL)
        response.raise_for_status()
        data = response.json()
        
        # Update cache atomically
        _vatsim_cache["data"] = data
        _vatsim_cache["timestamp"] = current_time
        
        return data


def parse_controller_type(callsign: str) -> str:
    """
    Determine the facility type from a controller callsign.
    
    Args:
        callsign: The controller's callsign (e.g., "EGLL_TWR", "LON_S_CTR")
    
    Returns:
        Human-readable facility type string
    """
    callsign_upper = callsign.upper()
    
    for suffix, facility_type in FACILITY_TYPES.items():
        if callsign_upper.endswith(suffix):
            return facility_type
    
    return "Unknown"


def extract_airport_from_callsign(callsign: str) -> str:
    """
    Extract the airport/facility prefix from a controller callsign.
    
    Args:
        callsign: The controller's callsign (e.g., "EGLL_TWR", "LON_S_CTR")
    
    Returns:
        The airport/facility prefix
    """
    # Split by underscore and take the first part
    parts = callsign.split("_")
    return parts[0].upper() if parts else callsign.upper()


def filter_controllers(
    data: dict,
    airport: Optional[str] = None,
    fir: Optional[str] = None
) -> list[dict]:
    """
    Filter VATSIM controllers by airport or FIR.
    
    Args:
        data: Raw VATSIM data dictionary
        airport: Optional ICAO airport code to filter by (e.g., "EGLL")
        fir: Optional FIR code to filter by (e.g., "EGTT")
    
    Returns:
        List of controller dictionaries with callsign, frequency, and facility type
    """
    controllers = data.get("controllers", [])
    filtered = []
    
    # Sanitize filter parameters
    airport = sanitize_icao_code(airport)
    fir = sanitize_icao_code(fir)
    
    for controller in controllers:
        callsign = controller.get("callsign", "")
        frequency = controller.get("frequency", "")
        
        # Skip if no callsign
        if not callsign:
            continue
        
        # Skip ATIS entries (they're informational, not controllers)
        if "_ATIS" in callsign.upper():
            continue
        
        # Apply airport filter
        if airport:
            airport_prefix = extract_airport_from_callsign(callsign)
            if not airport_prefix.startswith(airport):
                continue
        
        # Apply FIR filter (check if callsign contains FIR code)
        if fir:
            if fir not in callsign.upper():
                continue
        
        facility_type = parse_controller_type(callsign)
        
        filtered.append({
            "callsign": callsign,
            "frequency": frequency,
            "facility_type": facility_type,
            "name": controller.get("name", ""),
            "rating": controller.get("rating", 0)
        })
    
    # Sort by facility type priority (DEL -> GND -> TWR -> APP -> CTR)
    priority_order = ["Delivery", "Ground", "Tower", "Approach", "Departure", "Center", "Flight Service Station", "Unknown"]
    filtered.sort(key=lambda x: (
        priority_order.index(x["facility_type"]) if x["facility_type"] in priority_order else 99,
        x["callsign"]
    ))
    
    return filtered


def get_atis_info(data: dict, airport: Optional[str] = None) -> list[dict]:
    """
    Get ATIS information for airports.
    
    Args:
        data: Raw VATSIM data dictionary
        airport: Optional ICAO airport code to filter by
    
    Returns:
        List of ATIS entries with callsign, frequency, and ATIS text
    """
    atis_list = data.get("atis", [])
    filtered = []
    
    airport = sanitize_icao_code(airport)
    
    for atis in atis_list:
        callsign = atis.get("callsign", "")
        
        if not callsign:
            continue
        
        # Apply airport filter
        if airport:
            airport_prefix = extract_airport_from_callsign(callsign)
            if not airport_prefix.startswith(airport):
                continue
        
        filtered.append({
            "callsign": callsign,
            "frequency": atis.get("frequency", ""),
            "atis_code": atis.get("atis_code", ""),
            "text_atis": atis.get("text_atis", [])
        })
    
    return filtered


async def fetch_realworld_atis(airport: str) -> dict:
    """
    Fetch real-world METAR data for an airport (used as ATIS substitute).
    
    Uses Aviation Weather Center's METAR service which is free and doesn't require API keys.
    METAR contains weather information similar to what ATIS provides.
    
    Args:
        airport: ICAO airport code (e.g., "EGLL", "KJFK")
    
    Returns:
        Dictionary with METAR data formatted as ATIS-like information
    """
    airport = sanitize_icao_code(airport)
    
    if not airport or not validate_icao_code(airport):
        return {
            "success": False,
            "error": "Invalid airport ICAO code"
        }
    
    try:
        # Aviation Weather Center METAR service (free, no API key required)
        # Format: https://aviationweather.gov/api/data/metar?ids=ICAO&format=json&taf=false&hours=1
        metar_url = f"https://aviationweather.gov/api/data/metar?ids={airport}&format=json&taf=false&hours=1"
        
        client = get_http_client()
        response = await client.get(metar_url, timeout=10.0)
        response.raise_for_status()
        
        data = response.json()
        
        if not data or len(data) == 0:
            return {
                "success": False,
                "error": f"No METAR data available for {airport}"
            }
        
        # Get the first (most recent) METAR
        metar = data[0]
        
        # Parse METAR string - the API returns 'rawOb' or 'rawOb' field
        metar_text = metar.get("rawOb", metar.get("raw", ""))
        
        # Extract structured information if available
        # The API may return different field names, so we handle both formats
        wind_data = metar.get("winds", {}) or {}
        visib_data = metar.get("visib", {}) or {}
        temp_data = metar.get("temp", {}) or {}
        dewp_data = metar.get("dewp", {}) or {}
        altim_data = metar.get("altim", {}) or {}
        
        return {
            "success": True,
            "airport": airport,
            "metar": metar_text,
            "observation_time": metar.get("obsTime", metar.get("time", "")),
            "wind": wind_data,
            "visibility": visib_data,
            "weather": metar.get("wxString", metar.get("wxcodes", "")),
            "clouds": metar.get("clouds", []),
            "temperature": temp_data,
            "dewpoint": dewp_data,
            "altimeter": altim_data,
            "remarks": metar.get("remarks", "")
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {
                "success": False,
                "error": f"Airport {airport} not found or no METAR data available"
            }
        return {
            "success": False,
            "error": f"HTTP error {e.response.status_code}: Failed to fetch METAR data"
        }
    except httpx.HTTPError as e:
        return {
            "success": False,
            "error": f"Network error: Failed to fetch METAR data"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error processing METAR data: {str(e)}"
        }


# Common airline ICAO codes to telephony (radio callsign) mapping
# This covers most major airlines - can be extended as needed
AIRLINE_TELEPHONY = {
    # Major International
    "AAL": "American",
    "AAR": "Asiana",
    "ACA": "Air Canada",
    "AFR": "Air France",
    "AIC": "Air India",
    "ALK": "Sri Lankan",
    "ANA": "All Nippon",
    "ANZ": "New Zealand",
    "AUA": "Austrian",
    "AZA": "Alitalia",
    "BAW": "Speedbird",
    "BCS": "Postman",
    "BEL": "Bee-Line",
    "CAL": "Dynasty",
    "CCA": "Air China",
    "CES": "China Eastern",
    "CLX": "Cargolux",
    "CPA": "Cathay",
    "CSN": "China Southern",
    "DAL": "Delta",
    "DLH": "Lufthansa",
    "EIN": "Shamrock",
    "ELY": "El Al",
    "ETD": "Etihad",
    "ETH": "Ethiopian",
    "EVA": "Eva",
    "FDX": "FedEx",
    "FIN": "Finnair",
    "GIA": "Indonesia",
    "IBE": "Iberia",
    "ICE": "Iceair",
    "JAL": "Japan Air",
    "JBU": "JetBlue",
    "KAL": "Korean Air",
    "KLM": "KLM",
    "LAN": "Lan Chile",
    "LOT": "LOT",
    "MAU": "Mauritius",
    "MAS": "Malaysian",
    "MEA": "Cedar Jet",
    "MSR": "Egyptair",
    "NAX": "Nor Shuttle",
    "NCA": "Nippon Cargo",
    "QFA": "Qantas",
    "QTR": "Qatari",
    "RAM": "Royal Air Maroc",
    "RYR": "Ryanair",
    "SAS": "Scandinavian",
    "SAA": "Springbok",
    "SIA": "Singapore",
    "SKW": "Skywest",
    "SWA": "Southwest",
    "SWR": "Swiss",
    "TAP": "Air Portugal",
    "THA": "Thai",
    "THY": "Turkish",
    "TOM": "Tomjet",
    "UAE": "Emirates",
    "UAL": "United",
    "UPS": "UPS",
    "VIR": "Virgin",
    "VOZ": "Velocity",
    
    # European Regionals & Low Cost
    "BER": "Air Berlin",
    "EJU": "Alpine",
    "EWG": "Eurowings",
    "EXS": "Channex",
    "EZS": "Topswiss",
    "EZY": "Easy",
    "FHY": "Freebird",
    "GWI": "Germanwings",
    "HVN": "Vietnam Airlines",
    "LOG": "Logan",
    "MON": "Monarch",
    "NAX": "Norseman",
    "NOS": "Moonflower",
    "PGT": "Sunturk",
    "RUK": "Ruk Air",
    "SXS": "Sunexpress",
    "TUI": "Beauty",
    "VLG": "Vueling",
    "WZZ": "Wizzair",
    
    # UK & Ireland
    "BMI": "Midland",
    "EZE": "Jersey",
    "SHT": "Shuttle",
    "BAF": "Bealine",
    
    # North American Regionals
    "AAY": "Allegiant",
    "ASA": "Alaska",
    "AWE": "Cactus",
    "ENY": "Envoy",
    "FFT": "Frontier Flight",
    "HAL": "Hawaiian",
    "JIA": "Blue Streak",
    "NKS": "Spirit Wings",
    "PDT": "Piedmont",
    "RPA": "Brickyard",
    "SKY": "Skymark",
    "TCF": "shuttle",
    "WJA": "Westjet",
    
    # Cargo
    "ABW": "Airbridge Cargo",
    "AZG": "Silk Way",
    "BOX": "German Cargo",
    "CAO": "Air China Cargo",
    "CLU": "Champ",
    "GEC": "Lufthansa Cargo",
    "GTI": "Giant",
    "KZR": "Comet",
    "MYW": "Mway",
    "SQC": "Singapore Cargo",
}


def get_airline_telephony(icao_code: str) -> Optional[str]:
    """
    Get the radio telephony (callsign) for an airline ICAO code.
    
    Args:
        icao_code: 3-letter airline ICAO code (e.g., "BAW")
    
    Returns:
        Telephony string (e.g., "Speedbird") or None if not found
    """
    return AIRLINE_TELEPHONY.get(icao_code.upper())


def parse_callsign_to_telephony(callsign: str) -> dict:
    """
    Parse an ICAO callsign into its components and derive radio telephony.
    
    Args:
        callsign: Full callsign (e.g., "BAW573", "N123AB")
    
    Returns:
        Dictionary with parsed components:
        - icao_callsign: Original callsign (e.g., "BAW573")
        - airline_code: Extracted airline code if applicable (e.g., "BAW")
        - flight_number: Extracted number portion (e.g., "573")
        - telephony: Radio callsign if known (e.g., "Speedbird 573")
        - is_airline: Whether this appears to be an airline callsign
    """
    callsign = callsign.strip().upper()
    
    result = {
        "icao_callsign": callsign,
        "airline_code": None,
        "flight_number": None,
        "telephony": None,
        "is_airline": False
    }
    
    if not callsign:
        return result
    
    # Check if it matches airline format (3 letters + numbers/alphanumeric)
    # e.g., BAW573, UAL123, DLH4AB
    import re
    airline_match = re.match(r'^([A-Z]{3})(\d+[A-Z]*)$', callsign)
    
    if airline_match:
        airline_code = airline_match.group(1)
        flight_num = airline_match.group(2)
        
        result["airline_code"] = airline_code
        result["flight_number"] = flight_num
        result["is_airline"] = True
        
        # Look up telephony
        telephony = get_airline_telephony(airline_code)
        if telephony:
            result["telephony"] = f"{telephony} {flight_num}"
        else:
            # Unknown airline - use the code itself
            result["telephony"] = f"{airline_code} {flight_num}"
    else:
        # Likely a GA registration (e.g., N123AB, G-ABCD)
        result["telephony"] = callsign
    
    return result


def format_frequency(freq: str) -> str:
    """
    Format a frequency string to standard aviation format.
    
    Args:
        freq: Raw frequency string (e.g., "118.5", "118.500")
    
    Returns:
        Formatted frequency string (e.g., "118.500")
    """
    try:
        freq_float = float(freq)
        return f"{freq_float:.3f}"
    except (ValueError, TypeError):
        return freq


def find_pilot_by_callsign(data: dict, callsign: str) -> Optional[dict]:
    """
    Find a pilot in VATSIM data by callsign.
    
    Args:
        data: Raw VATSIM data dictionary
        callsign: The pilot's callsign to search for
    
    Returns:
        Pilot data dictionary or None if not found
    """
    pilots = data.get("pilots", [])
    callsign_upper = callsign.strip().upper()
    
    for pilot in pilots:
        if pilot.get("callsign", "").upper() == callsign_upper:
            return pilot
    
    return None


def determine_flight_phase(altitude: int, groundspeed: int, cruise_alt: str) -> dict:
    """
    Determine the current flight phase based on flight parameters.
    
    Args:
        altitude: Current altitude in feet
        groundspeed: Current groundspeed in knots
        cruise_alt: Filed cruise altitude
    
    Returns:
        Dictionary with phase info
    """
    # Parse cruise altitude to feet
    cruise_ft = 0
    if cruise_alt:
        try:
            if cruise_alt.upper().startswith('FL'):
                cruise_ft = int(cruise_alt[2:]) * 100
            else:
                cruise_ft = int(cruise_alt)
        except (ValueError, TypeError):
            cruise_ft = 35000  # Default assumption
    
    # Determine phase based on parameters
    phase = "Unknown"
    phase_icon = "✈"
    
    if groundspeed < 30:
        phase = "On Ground"
        phase_icon = "🅿"
    elif groundspeed < 80:
        phase = "Taxiing"
        phase_icon = "🛞"
    elif altitude < 1500 and groundspeed > 80:
        phase = "Takeoff / Landing"
        phase_icon = "🛫"
    elif altitude < 10000:
        if cruise_ft > 0 and altitude < cruise_ft * 0.5:
            phase = "Climbing"
            phase_icon = "📈"
        else:
            phase = "Low Altitude"
            phase_icon = "✈"
    else:
        # Above 10000ft - determine based on cruise altitude comparison
        if cruise_ft > 0:
            alt_ratio = altitude / cruise_ft
            
            if alt_ratio < 0.85:
                phase = "Climbing"
                phase_icon = "📈"
            elif alt_ratio >= 0.85 and alt_ratio <= 1.10:
                phase = "Cruise"
                phase_icon = "✈"
            else:
                # Above filed altitude - probably still cruising
                phase = "Cruise"
                phase_icon = "✈"
        else:
            # No cruise altitude filed
            if altitude > 30000:
                phase = "Cruise"
                phase_icon = "✈"
            elif altitude > 15000:
                phase = "Climbing"
                phase_icon = "📈"
            else:
                phase = "Low Altitude"
                phase_icon = "✈"
    
    return {
        "phase": phase,
        "icon": phase_icon
    }


def extract_flight_data(pilot: dict) -> dict:
    """
    Extract relevant flight data from a pilot entry.
    
    Args:
        pilot: Raw pilot data from VATSIM API
    
    Returns:
        Cleaned flight data dictionary
    """
    flight_plan = pilot.get("flight_plan") or {}
    
    # Parse callsign into components
    raw_callsign = pilot.get("callsign", "")
    callsign_info = parse_callsign_to_telephony(raw_callsign)
    
    # Parse altitude - could be FL350 or 35000
    altitude = flight_plan.get("altitude", "")
    if altitude:
        try:
            alt_int = int(altitude)
            if alt_int >= 1000:
                # Convert to flight level if high enough
                if alt_int >= 18000:
                    altitude = f"FL{alt_int // 100}"
                else:
                    altitude = str(alt_int)
        except (ValueError, TypeError):
            pass
    
    # Extract SID/STAR from route if present
    route = flight_plan.get("route", "")
    sid = ""
    star = ""
    
    if route:
        route_parts = route.split()
        if route_parts:
            # First element might be SID
            first = route_parts[0]
            if not first.startswith(flight_plan.get("departure", "")[:2]):
                sid = first
            # Last element might be STAR
            if len(route_parts) > 1:
                last = route_parts[-1]
                if not last.startswith(flight_plan.get("arrival", "")[:2]):
                    star = last
    
    # Get current position and flight details
    current_lat = pilot.get("latitude", 0)
    current_lon = pilot.get("longitude", 0)
    departure = flight_plan.get("departure", "")
    arrival = flight_plan.get("arrival", "")
    
    # Determine flight phase based on altitude and groundspeed
    current_alt = pilot.get("altitude", 0)
    groundspeed = pilot.get("groundspeed", 0)
    
    phase_info = determine_flight_phase(current_alt, groundspeed, altitude)
    
    return {
        "flightNumber": raw_callsign,
        "callsign": callsign_info["telephony"] or raw_callsign,
        "airlineCode": callsign_info["airline_code"],
        "isAirline": callsign_info["is_airline"],
        "aircraft": flight_plan.get("aircraft_short", "") or flight_plan.get("aircraft_faa", ""),
        "squawk": pilot.get("transponder", ""),
        "departure": departure,
        "arrival": arrival,
        "cruiseAlt": altitude,
        "route": route,
        "sid": sid,
        "star": star,
        "flightRules": flight_plan.get("flight_rules", ""),
        "remarks": flight_plan.get("remarks", ""),
        # Live data
        "currentAltitude": current_alt,
        "groundspeed": groundspeed,
        "heading": pilot.get("heading", 0),
        "latitude": current_lat,
        "longitude": current_lon,
        # Flight phase
        "flightPhase": phase_info["phase"],
        "phaseIcon": phase_info["icon"]
    }
