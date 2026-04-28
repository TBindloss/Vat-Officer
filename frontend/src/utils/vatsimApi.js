/**
 * VATSIM API Utilities
 * Functions for fetching and processing VATSIM network data.
 */

const API_BASE = '/api/vatsim'

/**
 * Fetch active controllers from the backend proxy.
 * 
 * @param {object} options - Filter options
 * @param {string} [options.airport] - ICAO airport code filter
 * @param {string} [options.fir] - FIR/ARTCC code filter
 * @returns {Promise<{ success: boolean, controllers: Array, error?: string }>}
 */
export async function fetchControllers({ airport, fir } = {}) {
  try {
    const params = new URLSearchParams()
    
    if (airport && airport.trim()) {
      params.set('airport', airport.trim().toUpperCase())
    }
    if (fir && fir.trim()) {
      params.set('fir', fir.trim().toUpperCase())
    }
    
    const queryString = params.toString()
    const url = `${API_BASE}/controllers${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      success: true,
      controllers: data.controllers || [],
      count: data.count || 0,
      filters: data.filters || {}
    }
  } catch (error) {
    console.error('Error fetching controllers:', error)
    return {
      success: false,
      controllers: [],
      error: error.message || 'Failed to fetch controller data'
    }
  }
}

/**
 * Fetch ATIS information from the backend proxy.
 * 
 * @param {object} options - Filter options
 * @param {string} [options.airport] - ICAO airport code filter
 * @returns {Promise<{ success: boolean, atis: Array, error?: string }>}
 */
export async function fetchAtis({ airport } = {}) {
  try {
    const params = new URLSearchParams()
    
    if (airport && airport.trim()) {
      params.set('airport', airport.trim().toUpperCase())
    }
    
    const queryString = params.toString()
    const url = `${API_BASE}/atis${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      success: true,
      atis: data.atis || [],
      count: data.count || 0
    }
  } catch (error) {
    console.error('Error fetching ATIS:', error)
    return {
      success: false,
      atis: [],
      error: error.message || 'Failed to fetch ATIS data'
    }
  }
}

/**
 * Fetch real-world ATIS (METAR) information from the backend.
 * 
 * @param {string} airport - ICAO airport code (required)
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function fetchRealWorldAtis(airport) {
  try {
    if (!airport || !airport.trim()) {
      return {
        success: false,
        error: 'Airport ICAO code is required'
      }
    }
    
    const url = `/api/atis/realworld?airport=${encodeURIComponent(airport.trim().toUpperCase())}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      success: true,
      data: data.data || {},
      airport: data.airport
    }
  } catch (error) {
    console.error('Error fetching real-world ATIS:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch real-world ATIS data'
    }
  }
}

/**
 * Validate an ICAO code format.
 * 
 * @param {string} code - Code to validate
 * @returns {boolean} - True if valid ICAO format
 */
export function isValidIcaoCode(code) {
  if (!code || typeof code !== 'string') return false
  const sanitized = code.trim().toUpperCase()
  return /^[A-Z]{2,4}$/.test(sanitized)
}

/**
 * Format a frequency to standard aviation format (XXX.XXX).
 * 
 * @param {string|number} frequency - Raw frequency value
 * @returns {string} - Formatted frequency string
 */
export function formatFrequency(frequency) {
  if (!frequency) return '---'
  
  try {
    const freq = parseFloat(frequency)
    if (isNaN(freq)) return frequency.toString()
    return freq.toFixed(3)
  } catch {
    return frequency.toString()
  }
}

/**
 * Get facility type color class for styling.
 * 
 * @param {string} facilityType - Facility type string
 * @returns {string} - Tailwind color class
 */
export function getFacilityTypeColor(facilityType) {
  const colors = {
    'Delivery': 'text-violet-400',
    'Ground': 'text-emerald-400',
    'Tower': 'text-red-400',
    'Approach': 'text-blue-400',
    'Departure': 'text-cyan-400',
    'Center': 'text-orange-400',
    'Flight Service Station': 'text-amber-400',
    'Unknown': 'text-aviation-text-secondary'
  }
  return colors[facilityType] || 'text-aviation-text-secondary'
}

/**
 * Fetch pilot/flight information by callsign.
 * 
 * @param {string} callsign - The pilot's callsign
 * @returns {Promise<{ success: boolean, found: boolean, flight?: object, error?: string }>}
 */
export async function fetchPilot(callsign) {
  try {
    if (!callsign || callsign.trim().length < 2) {
      return {
        success: false,
        found: false,
        error: 'Invalid callsign'
      }
    }
    
    const sanitized = callsign.trim().toUpperCase()
    const url = `${API_BASE}/pilot/${encodeURIComponent(sanitized)}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      success: data.success,
      found: data.found,
      flight: data.flight || null,
      message: data.message
    }
  } catch (error) {
    console.error('Error fetching pilot:', error)
    return {
      success: false,
      found: false,
      error: error.message || 'Failed to fetch pilot data'
    }
  }
}

export default {
  fetchControllers,
  fetchAtis,
  fetchRealWorldAtis,
  fetchPilot,
  isValidIcaoCode,
  formatFrequency,
  getFacilityTypeColor
}
