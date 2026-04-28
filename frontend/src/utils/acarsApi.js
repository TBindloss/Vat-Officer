/**
 * ACARS API Utilities
 * Functions for sending and receiving ACARS messages via Hoppie's ACARS system.
 */

const API_BASE = '/api/acars'

/**
 * Send an ACARS message.
 * 
 * @param {object} params - Message parameters
 * @param {string} params.logonCode - Hoppie's ACARS logon code
 * @param {string} params.fromCallsign - Sender's callsign (aircraft)
 * @param {string} params.toCallsign - Recipient's callsign (ATC facility)
 * @param {string} params.messageType - Message type: "telex" or "cpdlc"
 * @param {string} params.message - Message content
 * @returns {Promise<{ success: boolean, response?: string, error?: string }>}
 */
export async function sendACARSMessage({ logonCode, fromCallsign, toCallsign, messageType, message }) {
  try {
    if (!logonCode || !logonCode.trim()) {
      return {
        success: false,
        error: 'Logon code is required'
      }
    }

    if (!fromCallsign || !fromCallsign.trim()) {
      return {
        success: false,
        error: 'From callsign is required'
      }
    }

    if (!toCallsign || !toCallsign.trim()) {
      return {
        success: false,
        error: 'To callsign is required'
      }
    }

    if (!message || !message.trim()) {
      return {
        success: false,
        error: 'Message content is required'
      }
    }

    const response = await fetch(`${API_BASE}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        logon_code: logonCode.trim(),
        from_callsign: fromCallsign.trim().toUpperCase(),
        to_callsign: toCallsign.trim().toUpperCase(),
        message_type: messageType || 'telex',
        message: message.trim()
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error ${response.status}`)
    }

    const data = await response.json()
    return {
      success: data.success,
      response: data.response,
      message: data.message
    }
  } catch (error) {
    console.error('Error sending ACARS message:', error)
    return {
      success: false,
      error: error.message || 'Failed to send ACARS message'
    }
  }
}

/**
 * Peek at incoming ACARS messages without consuming them.
 * This allows viewing messages without removing them from the queue,
 * so they can still be received by other clients (like flight simulators).
 * 
 * @param {object} params - Peek parameters
 * @param {string} params.logonCode - Hoppie's ACARS logon code
 * @param {string} params.callsign - Aircraft callsign to peek for
 * @returns {Promise<{ success: boolean, messages?: Array, count?: number, error?: string }>}
 */
export async function peekACARSMessages({ logonCode, callsign }) {
  try {
    if (!logonCode || !logonCode.trim()) {
      return {
        success: false,
        error: 'Logon code is required',
        messages: []
      }
    }

    if (!callsign || !callsign.trim()) {
      return {
        success: false,
        error: 'Callsign is required',
        messages: []
      }
    }

    const response = await fetch(`${API_BASE}/peek`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        logon_code: logonCode.trim(),
        callsign: callsign.trim().toUpperCase()
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error ${response.status}`)
    }

    const data = await response.json()
    return {
      success: data.success,
      messages: data.messages || [],
      count: data.count || 0
    }
  } catch (error) {
    console.error('Error peeking ACARS messages:', error)
    return {
      success: false,
      error: error.message || 'Failed to peek ACARS messages',
      messages: []
    }
  }
}

/**
 * Poll for incoming ACARS messages (consumes them from the queue).
 * WARNING: This will remove messages from the queue, preventing other clients
 * (like flight simulators) from receiving them.
 * 
 * @param {object} params - Poll parameters
 * @param {string} params.logonCode - Hoppie's ACARS logon code
 * @param {string} params.callsign - Aircraft callsign to poll for
 * @returns {Promise<{ success: boolean, messages?: Array, count?: number, error?: string }>}
 */
export async function pollACARSMessages({ logonCode, callsign }) {
  try {
    if (!logonCode || !logonCode.trim()) {
      return {
        success: false,
        error: 'Logon code is required',
        messages: []
      }
    }

    if (!callsign || !callsign.trim()) {
      return {
        success: false,
        error: 'Callsign is required',
        messages: []
      }
    }

    const response = await fetch(`${API_BASE}/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        logon_code: logonCode.trim(),
        callsign: callsign.trim().toUpperCase()
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error ${response.status}`)
    }

    const data = await response.json()
    return {
      success: data.success,
      messages: data.messages || [],
      count: data.count || 0
    }
  } catch (error) {
    console.error('Error polling ACARS messages:', error)
    return {
      success: false,
      error: error.message || 'Failed to poll ACARS messages',
      messages: []
    }
  }
}

/**
 * Send a Pre-Departure Clearance (PDC) request.
 * 
 * @param {object} params - PDC request parameters
 * @param {string} params.logonCode - Hoppie's ACARS logon code
 * @param {string} params.fromCallsign - Aircraft callsign
 * @param {string} params.toCallsign - ATC facility callsign (e.g., EGLL_DEL)
 * @param {string} params.aircraftType - Aircraft type (e.g., B738, A320)
 * @param {string} params.departure - Departure airport ICAO code
 * @param {string} params.destination - Destination airport ICAO code
 * @param {string} [params.stand] - Optional stand/gate number
 * @param {string} [params.atis] - Optional ATIS code
 * @returns {Promise<{ success: boolean, response?: string, pdcMessage?: string, error?: string }>}
 */
export async function requestPDC({ logonCode, fromCallsign, toCallsign, aircraftType, departure, destination, stand, atis }) {
  try {
    if (!logonCode || !logonCode.trim()) {
      return {
        success: false,
        error: 'Logon code is required'
      }
    }

    if (!fromCallsign || !fromCallsign.trim()) {
      return {
        success: false,
        error: 'From callsign is required'
      }
    }

    if (!toCallsign || !toCallsign.trim()) {
      return {
        success: false,
        error: 'To callsign is required'
      }
    }

    if (!aircraftType || !aircraftType.trim()) {
      return {
        success: false,
        error: 'Aircraft type is required'
      }
    }

    if (!departure || !departure.trim()) {
      return {
        success: false,
        error: 'Departure airport is required'
      }
    }

    if (!destination || !destination.trim()) {
      return {
        success: false,
        error: 'Destination airport is required'
      }
    }

    const response = await fetch(`${API_BASE}/pdc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        logon_code: logonCode.trim(),
        from_callsign: fromCallsign.trim().toUpperCase(),
        to_callsign: toCallsign.trim().toUpperCase(),
        aircraft_type: aircraftType.trim().toUpperCase(),
        departure: departure.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        stand: stand ? stand.trim().toUpperCase() : null,
        atis: atis ? atis.trim().toUpperCase() : null
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error ${response.status}`)
    }

    const data = await response.json()
    return {
      success: data.success,
      response: data.response,
      pdcMessage: data.pdc_message,
      message: data.message
    }
  } catch (error) {
    console.error('Error sending PDC request:', error)
    return {
      success: false,
      error: error.message || 'Failed to send PDC request'
    }
  }
}

/**
 * Validate a callsign format.
 * 
 * @param {string} callsign - Callsign to validate
 * @returns {boolean}
 */
export function isValidCallsign(callsign) {
  if (!callsign || !callsign.trim()) {
    return false
  }
  const pattern = /^[A-Z0-9]{2,10}$/
  return pattern.test(callsign.trim().toUpperCase())
}

/**
 * Validate an ICAO code format.
 * 
 * @param {string} code - ICAO code to validate
 * @returns {boolean}
 */
export function isValidIcaoCode(code) {
  if (!code || !code.trim()) {
    return false
  }
  const pattern = /^[A-Z]{2,4}$/
  return pattern.test(code.trim().toUpperCase())
}

export default {
  sendACARSMessage,
  peekACARSMessages,
  pollACARSMessages,
  requestPDC,
  isValidCallsign,
  isValidIcaoCode
}
