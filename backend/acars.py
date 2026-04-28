"""
ACARS Service Module
Integration with Hoppie's ACARS system for messaging and clearances.
"""

import re
from typing import Optional, Dict, Any, List
import httpx

# Hoppie's ACARS API endpoint
HOPPIE_ACARS_URL = "http://www.hoppie.nl/acars/system/connect.html"

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
            timeout=15.0,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
        )
    return _http_client

# Message types supported by Hoppie's ACARS
MESSAGE_TYPES = {
    "telex": "telex",  # Standard telex message
    "cpdlc": "cpdlc",  # Controller-Pilot Data Link Communications
    "poll": "poll",    # Poll for messages
    "peek": "peek"     # Peek at messages without removing them
}

# ACARS message validation
CALLSIGN_PATTERN = re.compile(r'^[A-Z0-9]{2,10}$')
ATC_CALLSIGN_PATTERN = re.compile(r'^[A-Z0-9_]{2,20}$')  # ATC facility callsigns can have underscores
ICAO_PATTERN = re.compile(r'^[A-Z]{2,4}$')


def validate_callsign(callsign: str) -> bool:
    """
    Validate an aircraft callsign format.
    
    Args:
        callsign: Callsign to validate (e.g., "BAW573", "N123AB")
    
    Returns:
        True if valid, False otherwise
    """
    if not callsign:
        return False
    callsign = callsign.strip().upper()
    return bool(CALLSIGN_PATTERN.match(callsign))


def validate_icao_code(code: str) -> bool:
    """
    Validate an ICAO airport/facility code.
    
    Args:
        code: ICAO code to validate (e.g., "EGLL", "KJFK")
    
    Returns:
        True if valid, False otherwise
    """
    if not code:
        return False
    code = code.strip().upper()
    return bool(ICAO_PATTERN.match(code))


def sanitize_callsign(callsign: str) -> Optional[str]:
    """
    Sanitize and normalize a callsign.
    
    Args:
        callsign: Callsign to sanitize
    
    Returns:
        Sanitized uppercase callsign or None if invalid
    """
    if not callsign:
        return None
    sanitized = callsign.strip().upper()
    if validate_callsign(sanitized):
        return sanitized
    return None


def sanitize_icao_code(code: str) -> Optional[str]:
    """
    Sanitize and normalize an ICAO code.
    
    Args:
        code: ICAO code to sanitize
    
    Returns:
        Sanitized uppercase code or None if invalid
    """
    if not code:
        return None
    sanitized = code.strip().upper()
    if validate_icao_code(sanitized):
        return sanitized
    return None


def validate_atc_callsign(callsign: str) -> bool:
    """
    Validate an ATC facility callsign format (allows underscores).
    
    Args:
        callsign: ATC facility callsign to validate (e.g., "EGLL_DEL", "EGLL_1_GND")
    
    Returns:
        True if valid, False otherwise
    """
    if not callsign:
        return False
    callsign = callsign.strip().upper()
    return bool(ATC_CALLSIGN_PATTERN.match(callsign))


def sanitize_atc_callsign(callsign: str) -> Optional[str]:
    """
    Sanitize and normalize an ATC facility callsign (allows underscores).
    
    Args:
        callsign: ATC facility callsign to sanitize (e.g., "EGLL_DEL", "EGLL_1_GND")
    
    Returns:
        Sanitized uppercase callsign or None if invalid
    """
    if not callsign:
        return None
    sanitized = callsign.strip().upper()
    if validate_atc_callsign(sanitized):
        return sanitized
    return None


def _parse_hoppie_messages(message_data: str) -> List[Dict[str, Any]]:
    """
    Parse Hoppie's ACARS message format.
    
    Format: {timestamp from→to type {message}} {timestamp from→to type {message}} ...
    Example: {22251949→BCS718 cpdlc {TEST}} {22252021 EGKK cpdlc {/data2/10260//NE/UNABLE}}
    
    Args:
        message_data: Raw message data string from Hoppie
    
    Returns:
        List of parsed message dictionaries
    """
    messages = []
    if not message_data or not message_data.strip():
        return messages
    
    # Split by } { to get individual messages (but preserve the braces)
    # Pattern: messages are separated by "} {" 
    # We need to handle nested braces in message content
    
    # Use regex to find message boundaries: } followed by space and {
    # But be careful with nested braces in message content
    message_parts = []
    current_message = ""
    brace_depth = 0
    i = 0
    
    while i < len(message_data):
        char = message_data[i]
        current_message += char
        
        if char == '{':
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            # If we've closed all braces, this might be the end of a message
            if brace_depth == 0:
                # Check if next is space and another {
                if i + 2 < len(message_data) and message_data[i+1] == ' ' and message_data[i+2] == '{':
                    # End of current message, start of next
                    message_parts.append(current_message.strip())
                    current_message = ""
                    i += 2  # Skip the " {"
                    continue
        
        i += 1
    
    # Add the last message
    if current_message.strip():
        message_parts.append(current_message.strip())
    
    # Parse each message part
    for msg_str in message_parts:
        msg_str = msg_str.strip()
        if not msg_str:
            continue
        
        # Remove outer braces
        if msg_str.startswith('{') and msg_str.endswith('}'):
            msg_str = msg_str[1:-1].strip()
        
        # Parse format: timestamp from→to type {message}
        # Try to find the message content (last part in braces)
        last_brace_start = msg_str.rfind('{')
        if last_brace_start == -1:
            # No message content, try simple space split
            parts = msg_str.split(' ', 3)
            if len(parts) >= 3:
                timestamp = parts[0] if parts[0] else None
                from_to = parts[1] if len(parts) > 1 else ""
                msg_type = parts[2] if len(parts) > 2 else "telex"
                message_content = parts[3] if len(parts) > 3 else ""
                
                # Parse from→to
                if '→' in from_to:
                    from_callsign, to_callsign = from_to.split('→', 1)
                else:
                    from_callsign = from_to
                    to_callsign = ""
                
                messages.append({
                    "from": from_callsign.strip(),
                    "to": to_callsign.strip(),
                    "type": msg_type.strip(),
                    "message": message_content.strip(),
                    "raw": msg_str,
                    "timestamp": timestamp
                })
            continue
        
        # Extract message content (last part in braces)
        message_content = msg_str[last_brace_start+1:-1] if msg_str.endswith('}') else msg_str[last_brace_start+1:]
        prefix = msg_str[:last_brace_start].strip()
        
        # Parse prefix: timestamp from→to type OR timestamp from type
        # Examples: "22251949→BCS718 cpdlc" or "22252021 EGKK cpdlc"
        parts = prefix.split(' ', 2)
        if len(parts) >= 2:
            timestamp = parts[0] if parts[0] else None
            second_part = parts[1] if len(parts) > 1 else ""
            msg_type = parts[2] if len(parts) > 2 else "telex"
            
            # Parse from→to or from
            # If second part starts with →, it's "→to" format
            # Otherwise it's "from" format
            if second_part.startswith('→'):
                # Format: timestamp→to type
                to_callsign = second_part[1:].strip()  # Remove the →
                from_callsign = ""  # No "from" in this format
            elif '→' in second_part:
                # Format: from→to
                from_callsign, to_callsign = second_part.split('→', 1)
            else:
                # Format: from (no arrow)
                from_callsign = second_part
                to_callsign = ""
            
            messages.append({
                "from": from_callsign.strip(),
                "to": to_callsign.strip(),
                "type": msg_type.strip(),
                "message": message_content.strip(),
                "raw": msg_str,
                "timestamp": timestamp
            })
    
    return messages


async def send_acars_message(
    logon_code: str,
    from_callsign: str,
    to_callsign: str,
    message_type: str,
    message: str
) -> Dict[str, Any]:
    """
    Send an ACARS message via Hoppie's ACARS system.
    
    Args:
        logon_code: Hoppie's ACARS logon code (user-specific)
        from_callsign: Sender's callsign (aircraft)
        to_callsign: Recipient's callsign (ATC facility)
        message_type: Type of message ("telex" or "cpdlc")
        message: Message content
    
    Returns:
        Dictionary with response data:
        - success: Boolean indicating if request succeeded
        - response: Response text from Hoppie's server
        - error: Error message if failed
    """
    # Validate inputs
    from_callsign = sanitize_callsign(from_callsign)
    to_callsign = sanitize_atc_callsign(to_callsign)  # ATC facility callsigns can have underscores
    
    if not from_callsign:
        return {
            "success": False,
            "error": "Invalid from callsign"
        }
    
    if not to_callsign:
        return {
            "success": False,
            "error": "Invalid to callsign"
        }
    
    if message_type not in ["telex", "cpdlc"]:
        return {
            "success": False,
            "error": f"Invalid message type. Must be 'telex' or 'cpdlc'"
        }
    
    if not message or not message.strip():
        return {
            "success": False,
            "error": "Message content cannot be empty"
        }
    
    # Prepare request parameters
    params = {
        "logon": logon_code,
        "from": from_callsign,
        "to": to_callsign,
        "type": message_type,
        "packet": message.strip()
    }
    
    try:
        client = get_http_client()
        response = await client.get(HOPPIE_ACARS_URL, params=params)
        response.raise_for_status()
        
        # Hoppie's ACARS returns plain text responses
        response_text = response.text.strip()
        
        # Check for error responses
        if response_text.startswith("error"):
            return {
                "success": False,
                "response": response_text,
                "error": response_text
            }
        
        # Success responses typically start with "ok" or contain message data
        return {
            "success": True,
            "response": response_text,
            "error": None
        }
    
    except httpx.HTTPError as e:
        return {
            "success": False,
            "error": f"HTTP error: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }


async def peek_acars_messages(
    logon_code: str,
    callsign: str
) -> Dict[str, Any]:
    """
    Peek at incoming ACARS messages without consuming them.
    This allows viewing messages without removing them from the queue,
    so they can still be received by other clients (like flight simulators).
    
    Args:
        logon_code: Hoppie's ACARS logon code
        callsign: Aircraft callsign to peek for
    
    Returns:
        Dictionary with response data:
        - success: Boolean indicating if request succeeded
        - messages: List of received messages
        - error: Error message if failed
    """
    callsign = sanitize_callsign(callsign)
    
    if not callsign:
        return {
            "success": False,
            "error": "Invalid callsign"
        }
    
    params = {
        "logon": logon_code,
        "from": callsign,
        "to": callsign,
        "type": "peek"  # Use peek instead of poll to not consume messages
    }
    
    try:
        client = get_http_client()
        response = await client.get(HOPPIE_ACARS_URL, params=params)
        response.raise_for_status()
        
        response_text = response.text.strip()
        
        # Debug logging (can be removed in production)
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"ACARS peek response: {response_text[:200]}")  # Log first 200 chars
        
        # Check for errors
        if response_text.lower().startswith("error"):
            return {
                "success": False,
                "response": response_text,
                "error": response_text,
                "messages": []
            }
        
        # Parse messages from response
        # Hoppie's format: {timestamp from→to type {message}} {timestamp from→to type {message}} ...
        messages = []
        
        if response_text and response_text.lower().startswith("ok"):
            response_lower = response_text.lower()
            if response_lower == "ok":
                # No messages
                pass
            else:
                # Remove "ok" prefix
                message_data = response_text[2:].strip()
                messages = _parse_hoppie_messages(message_data)
        elif response_text and not response_text.lower().startswith("ok"):
            # Direct message format (no "ok" prefix)
            messages = _parse_hoppie_messages(response_text)
        
        return {
            "success": True,
            "response": response_text,
            "messages": messages,
            "error": None
        }
    
    except httpx.HTTPError as e:
        return {
            "success": False,
            "error": f"HTTP error: {str(e)}",
            "messages": []
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "messages": []
        }


async def poll_acars_messages(
    logon_code: str,
    callsign: str
) -> Dict[str, Any]:
    """
    Poll for incoming ACARS messages.
    
    Args:
        logon_code: Hoppie's ACARS logon code
        callsign: Aircraft callsign to poll for
    
    Returns:
        Dictionary with response data:
        - success: Boolean indicating if request succeeded
        - messages: List of received messages
        - error: Error message if failed
    """
    callsign = sanitize_callsign(callsign)
    
    if not callsign:
        return {
            "success": False,
            "error": "Invalid callsign"
        }
    
    params = {
        "logon": logon_code,
        "from": callsign,
        "to": callsign,
        "type": "poll"
    }
    
    try:
        client = get_http_client()
        response = await client.get(HOPPIE_ACARS_URL, params=params)
        response.raise_for_status()
        
        response_text = response.text.strip()
        
        # Debug logging (can be removed in production)
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"ACARS poll response: {response_text[:200]}")  # Log first 200 chars
        
        # Check for errors
        if response_text.lower().startswith("error"):
            return {
                "success": False,
                "response": response_text,
                "error": response_text,
                "messages": []
            }
        
        # Parse messages from response
        # Hoppie's format: {timestamp from→to type {message}} {timestamp from→to type {message}} ...
        messages = []
        
        if response_text and response_text.lower().startswith("ok"):
            response_lower = response_text.lower()
            if response_lower == "ok":
                # No messages
                pass
            else:
                # Remove "ok" prefix
                message_data = response_text[2:].strip()
                messages = _parse_hoppie_messages(message_data)
        elif response_text and not response_text.lower().startswith("ok"):
            # Direct message format (no "ok" prefix)
            messages = _parse_hoppie_messages(response_text)
        
        return {
            "success": True,
            "response": response_text,
            "messages": messages,
            "error": None
        }
    
    except httpx.HTTPError as e:
        return {
            "success": False,
            "error": f"HTTP error: {str(e)}",
            "messages": []
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "messages": []
        }


def format_pdc_request(
    callsign: str,
    aircraft_type: str,
    departure: str,
    destination: str,
    stand: Optional[str] = None,
    atis: Optional[str] = None
) -> str:
    """
    Format a Pre-Departure Clearance (PDC) request message.
    
    Args:
        callsign: Aircraft callsign
        aircraft_type: Aircraft type (e.g., "B738", "A320")
        departure: Departure airport ICAO code
        destination: Destination airport ICAO code
        stand: Optional stand/gate number
        atis: Optional ATIS code
    
    Returns:
        Formatted PDC request string
    """
    parts = [
        "REQUEST PREDEP CLEARANCE",
        callsign.upper(),
        aircraft_type.upper(),
        f"TO {destination.upper()}",
        f"AT {departure.upper()}"
    ]
    
    if stand:
        parts.append(f"STAND {stand.upper()}")
    
    if atis:
        parts.append(f"ATIS {atis.upper()}")
    
    return " ".join(parts)


def format_clearance_request(
    callsign: str,
    clearance_type: str = "CLEARANCE"
) -> str:
    """
    Format a general clearance request.
    
    Args:
        callsign: Aircraft callsign
        clearance_type: Type of clearance (default: "CLEARANCE")
    
    Returns:
        Formatted clearance request string
    """
    return f"REQUEST {clearance_type} {callsign.upper()}"
