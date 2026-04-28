import React, { useCallback, useEffect, useState } from 'react'
import { useLocalStorage, STORAGE_KEYS } from '../hooks/useLocalStorage'
import { fetchAtis, fetchPilot, isValidIcaoCode } from '../utils/vatsimApi'

/**
 * Default flight data structure
 */
const DEFAULT_FLIGHT_DATA = {
  // General
  flightNumber: '',  // ICAO callsign e.g., BAW573
  callsign: '',      // Radio telephony e.g., Speedbird 573
  aircraft: '',
  squawk: '',
  cruiseAlt: '',
  remarks: '',
  // Departure
  depAirport: '',
  depStand: '',
  depTaxi: '',
  depRunway: '',
  depSid: '',
  depQnh: '',
  // Arrival
  arrAirport: '',
  arrStar: '',
  arrRunway: '',
  arrTaxi: '',
  arrStand: '',
  arrQnh: ''
}

/**
 * Field configuration organized by section
 */
const FIELD_SECTIONS = [
  {
    id: 'general',
    title: 'General Information',
    fields: [
      { key: 'flightNumber', label: 'Flight Number', placeholder: 'e.g. BAW573', uppercase: true, hint: 'ICAO code' },
      { key: 'callsign', label: 'Radio Callsign', placeholder: 'e.g. Speedbird 573', hint: 'Telephony' },
      { key: 'aircraft', label: 'Aircraft', placeholder: 'e.g. B738', uppercase: true },
      { key: 'squawk', label: 'Squawk', placeholder: 'e.g. 4521', type: 'squawk' },
      { key: 'cruiseAlt', label: 'Cruise Altitude', placeholder: 'e.g. FL350', uppercase: true }
    ]
  },
  {
    id: 'departure',
    title: 'Departure',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    atisKey: 'depAtis',
    airportKey: 'depAirport',
    altitudeKey: 'depAlt',
    qnhKey: 'depQnh',
    fields: [
      { key: 'depAirport', label: 'Airport', placeholder: 'e.g. EGLL', uppercase: true, triggersAtis: true },
      { key: 'depStand', label: 'Stand', placeholder: 'e.g. 323', uppercase: true },
      { key: 'depRunway', label: 'Runway', placeholder: 'e.g. 27L', uppercase: true },
      { key: 'depSid', label: 'SID', placeholder: 'e.g. CPT3F', uppercase: true },
      { key: 'depAlt', label: 'Departure Altitude', placeholder: 'e.g. 4000', uppercase: true },
      { key: 'depQnh', label: 'QNH', placeholder: 'e.g. 1013', uppercase: true },
      { key: 'depTaxi', label: 'Taxi Route', placeholder: 'e.g. A1 B2 C3', uppercase: true, wide: true }
    ]
  },
  {
    id: 'arrival',
    title: 'Arrival',
    color: 'text-red-400',
    borderColor: 'border-red-500/30',
    atisKey: 'arrAtis',
    airportKey: 'arrAirport',
    qnhKey: 'arrQnh',
    fields: [
      { key: 'arrAirport', label: 'Airport', placeholder: 'e.g. KJFK', uppercase: true, triggersAtis: true },
      { key: 'arrStar', label: 'STAR', placeholder: 'e.g. LENDY6', uppercase: true },
      { key: 'arrRunway', label: 'Runway', placeholder: 'e.g. 31L', uppercase: true },
      { key: 'arrStand', label: 'Stand', placeholder: 'e.g. A5', uppercase: true },
      { key: 'arrQnh', label: 'QNH', placeholder: 'e.g. 1013', uppercase: true },
      { key: 'arrTaxi', label: 'Taxi Route', placeholder: 'e.g. M A B', uppercase: true, wide: true }
    ]
  },
  {
    id: 'notes',
    title: 'Notes',
    fields: [
      { key: 'remarks', label: 'Remarks', placeholder: 'Additional notes, frequencies, instructions...', multiline: true, wide: true }
    ]
  }
]

/**
 * Parse QNH from ATIS text
 * Looks for patterns like "QNH 1013", "Q1013", "QNH1013", "ALTIMETER 2992"
 */
function parseQnhFromAtis(textAtis) {
  if (!textAtis || !Array.isArray(textAtis)) return null
  
  const fullText = textAtis.join(' ').toUpperCase()
  
  // Try QNH patterns (hPa/mb)
  const qnhMatch = fullText.match(/QNH\s*(\d{4})/i) || 
                   fullText.match(/Q\s*(\d{4})/i)
  if (qnhMatch) {
    return qnhMatch[1]
  }
  
  // Try Altimeter patterns (inHg - US) - convert to display
  const altMatch = fullText.match(/ALTIMETER\s*(\d{4})/i) ||
                   fullText.match(/A\s*(\d{4})/i)
  if (altMatch) {
    // Return as-is (e.g., "2992" for 29.92 inHg)
    return `A${altMatch[1]}`
  }
  
  return null
}

/**
 * Convert ATIS code letter to NATO phonetic
 */
function getPhoneticAtis(code) {
  const phonetic = {
    'A': 'Alpha', 'B': 'Bravo', 'C': 'Charlie', 'D': 'Delta',
    'E': 'Echo', 'F': 'Foxtrot', 'G': 'Golf', 'H': 'Hotel',
    'I': 'India', 'J': 'Juliet', 'K': 'Kilo', 'L': 'Lima',
    'M': 'Mike', 'N': 'November', 'O': 'Oscar', 'P': 'Papa',
    'Q': 'Quebec', 'R': 'Romeo', 'S': 'Sierra', 'T': 'Tango',
    'U': 'Uniform', 'V': 'Victor', 'W': 'Whiskey', 'X': 'X-ray',
    'Y': 'Yankee', 'Z': 'Zulu'
  }
  return phonetic[code?.toUpperCase()] || code
}

function FlightData() {
  const [flightData, setFlightData] = useLocalStorage(STORAGE_KEYS.FLIGHT_DATA, DEFAULT_FLIGHT_DATA)
  
  // ATIS data state
  const [depAtis, setDepAtis] = useState(null)
  const [arrAtis, setArrAtis] = useState(null)
  const [atisLoading, setAtisLoading] = useState({ dep: false, arr: false })
  const [atisError, setAtisError] = useState({ dep: null, arr: null })
  
  // Flight lookup state
  const [flightLookupLoading, setFlightLookupLoading] = useState(false)
  const [flightLookupError, setFlightLookupError] = useState(null)
  const [flightLookupSuccess, setFlightLookupSuccess] = useState(null)
  const [liveData, setLiveData] = useState(null)

  // Fetch flight data from VATSIM by flight number
  const handleFetchFlight = useCallback(async () => {
    const flightNum = flightData.flightNumber?.trim()
    if (!flightNum || flightNum.length < 2) {
      setFlightLookupError('Enter a flight number first')
      return
    }
    
    setFlightLookupLoading(true)
    setFlightLookupError(null)
    setFlightLookupSuccess(null)
    
    const result = await fetchPilot(flightNum)
    
    if (result.success && result.found && result.flight) {
      const flight = result.flight
      
      // Update flight data with fetched info
      setFlightData(prev => ({
        ...prev,
        flightNumber: flight.flightNumber || prev.flightNumber,
        callsign: flight.callsign || prev.callsign,
        aircraft: flight.aircraft || prev.aircraft,
        squawk: flight.squawk || prev.squawk,
        cruiseAlt: flight.cruiseAlt || prev.cruiseAlt,
        depAirport: flight.departure || prev.depAirport,
        arrAirport: flight.arrival || prev.arrAirport,
        depSid: flight.sid || prev.depSid,
        arrStar: flight.star || prev.arrStar,
        remarks: flight.remarks || prev.remarks
      }))
      
      // Store live data
      setLiveData({
        altitude: flight.currentAltitude,
        groundspeed: flight.groundspeed,
        heading: flight.heading,
        latitude: flight.latitude,
        longitude: flight.longitude,
        route: flight.route,
        flightPhase: flight.flightPhase,
        phaseIcon: flight.phaseIcon
      })
      
      setFlightLookupSuccess(`Found ${flight.flightNumber} (${flight.callsign}) - ${flight.departure || '????'} → ${flight.arrival || '????'}`)
    } else if (result.found === false) {
      setFlightLookupError(`Flight "${flightNum}" not found on VATSIM. Are you connected?`)
    } else {
      setFlightLookupError(result.error || 'Failed to fetch flight data')
    }
    
    setFlightLookupLoading(false)
  }, [flightData.flightNumber, setFlightData])

  // Fetch ATIS for an airport
  const fetchAtisForAirport = useCallback(async (airport, type) => {
    if (!airport || !isValidIcaoCode(airport)) {
      if (type === 'dep') {
        setDepAtis(null)
        setAtisError(prev => ({ ...prev, dep: null }))
      } else {
        setArrAtis(null)
        setAtisError(prev => ({ ...prev, arr: null }))
      }
      return
    }

    setAtisLoading(prev => ({ ...prev, [type]: true }))
    setAtisError(prev => ({ ...prev, [type]: null }))

    const result = await fetchAtis({ airport: airport.toUpperCase() })

    if (result.success && result.atis.length > 0) {
      const atisData = result.atis[0]
      const qnh = parseQnhFromAtis(atisData.text_atis)
      
      const parsed = {
        code: atisData.atis_code,
        phonetic: getPhoneticAtis(atisData.atis_code),
        frequency: atisData.frequency,
        qnh: qnh,
        fullText: atisData.text_atis
      }
      
      if (type === 'dep') {
        setDepAtis(parsed)
        // Auto-fill QNH if empty
        if (qnh && !flightData.depQnh) {
          setFlightData(prev => ({ ...prev, depQnh: qnh }))
        }
      } else {
        setArrAtis(parsed)
        // Auto-fill QNH if empty
        if (qnh && !flightData.arrQnh) {
          setFlightData(prev => ({ ...prev, arrQnh: qnh }))
        }
      }
    } else {
      if (type === 'dep') {
        setDepAtis(null)
      } else {
        setArrAtis(null)
      }
      if (!result.success) {
        setAtisError(prev => ({ ...prev, [type]: 'Unable to fetch' }))
      }
    }

    setAtisLoading(prev => ({ ...prev, [type]: false }))
  }, [flightData.depQnh, flightData.arrQnh, setFlightData])

  // Fetch ATIS when airports change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (flightData.depAirport && isValidIcaoCode(flightData.depAirport)) {
        fetchAtisForAirport(flightData.depAirport, 'dep')
      } else {
        setDepAtis(null)
      }
    }, 500) // Debounce

    return () => clearTimeout(timer)
  }, [flightData.depAirport, fetchAtisForAirport])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (flightData.arrAirport && isValidIcaoCode(flightData.arrAirport)) {
        fetchAtisForAirport(flightData.arrAirport, 'arr')
      } else {
        setArrAtis(null)
      }
    }, 500) // Debounce

    return () => clearTimeout(timer)
  }, [flightData.arrAirport, fetchAtisForAirport])

  // Handle field change
  const handleChange = useCallback((key, value, uppercase = false) => {
    setFlightData(prev => ({
      ...prev,
      [key]: uppercase ? value.toUpperCase() : value
    }))
  }, [setFlightData])

  // Validate squawk code (0000-7777, octal)
  const validateSquawk = (value) => {
    const cleaned = value.replace(/[^0-7]/g, '').slice(0, 4)
    return cleaned
  }

  // Clear all flight data
  const handleClearAll = useCallback(() => {
    setFlightData(DEFAULT_FLIGHT_DATA)
    setDepAtis(null)
    setArrAtis(null)
    setLiveData(null)
    setFlightLookupError(null)
    setFlightLookupSuccess(null)
  }, [setFlightData])

  // Refresh ATIS data
  const handleRefreshAtis = useCallback(() => {
    if (flightData.depAirport) {
      fetchAtisForAirport(flightData.depAirport, 'dep')
    }
    if (flightData.arrAirport) {
      fetchAtisForAirport(flightData.arrAirport, 'arr')
    }
  }, [flightData.depAirport, flightData.arrAirport, fetchAtisForAirport])

  // Check if any data is entered
  const hasData = Object.values(flightData).some(v => v && v.trim())

  // ATIS display component
  const AtisDisplay = ({ atis, loading, error, type, airport }) => {
    if (!airport || !isValidIcaoCode(airport)) return null
    
    return (
      <div className="mt-3 p-3 bg-aviation-surface-light rounded-md border border-aviation-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-aviation-text-secondary uppercase tracking-wider">
            VATSIM ATIS
          </span>
          {loading && (
            <span className="text-xs text-aviation-text-secondary animate-pulse">Loading...</span>
          )}
        </div>
        
        {error && (
          <p className="text-xs text-aviation-text-secondary">No ATIS available</p>
        )}
        
        {!loading && !error && !atis && (
          <p className="text-xs text-aviation-text-secondary">No ATIS online for {airport}</p>
        )}
        
        {atis && (
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-aviation-text-secondary">Information </span>
                <span className="text-lg font-bold text-violet-400">{atis.code}</span>
                <span className="text-sm text-aviation-text-secondary ml-1">({atis.phonetic})</span>
              </div>
              {atis.qnh && (
                <div>
                  <span className="text-xs text-aviation-text-secondary">QNH </span>
                  <span className="text-lg font-bold text-amber-400">{atis.qnh}</span>
                </div>
              )}
            </div>
            {atis.fullText && atis.fullText.length > 0 && (
              <details className="text-xs">
                <summary className="text-aviation-text-secondary cursor-pointer hover:text-aviation-text">
                  View full ATIS
                </summary>
                <div className="mt-2 p-2 bg-aviation-surface rounded text-aviation-text-secondary font-mono text-xs leading-relaxed">
                  {atis.fullText.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium">Flight Data</h2>
          <p className="text-sm text-aviation-text-secondary">
            Quick reference scratchpad for your current flight
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(flightData.depAirport || flightData.arrAirport) && (
            <button
              onClick={handleRefreshAtis}
              className="btn-secondary text-sm"
              title="Refresh ATIS data"
            >
              ↻ ATIS
            </button>
          )}
          {hasData && (
            <button
              onClick={handleClearAll}
              className="btn-danger text-sm"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* VATSIM Flight Lookup */}
      <div className="card border-l-4 border-aviation-accent/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-aviation-accent">Fetch from VATSIM</h3>
        </div>
        <p className="text-sm text-aviation-text-secondary mb-4">
          Enter your flight number (ICAO code) and click "Fetch" to auto-populate your flight plan from VATSIM.
        </p>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={flightData.flightNumber || ''}
            onChange={(e) => handleChange('flightNumber', e.target.value, true)}
            placeholder="Enter flight number (e.g. BAW573)"
            className="input-field font-mono flex-1"
            spellCheck="false"
            autoComplete="off"
          />
          <button
            onClick={handleFetchFlight}
            disabled={flightLookupLoading || !flightData.flightNumber}
            className="btn-primary whitespace-nowrap"
          >
            {flightLookupLoading ? 'Searching...' : 'Fetch Flight'}
          </button>
        </div>
        
        {/* Success message with refresh button */}
        {flightLookupSuccess && (
          <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-md text-emerald-300 text-sm flex items-center justify-between">
            <span>{flightLookupSuccess}</span>
            <button
              onClick={handleFetchFlight}
              disabled={flightLookupLoading}
              className="ml-2 px-2 py-1 bg-emerald-900/50 hover:bg-emerald-800/50 rounded text-xs text-emerald-300"
              title="Refresh flight data"
            >
              {flightLookupLoading ? '...' : '↻ Refresh'}
            </button>
          </div>
        )}
        
        {/* Error message */}
        {flightLookupError && (
          <div className="mt-3 p-3 bg-red-950/40 border border-red-800/50 rounded-md text-red-300 text-sm">
            {flightLookupError}
          </div>
        )}
        
        {/* Live Data Display */}
        {liveData && (
          <div className="mt-4 p-4 bg-aviation-surface-light rounded-md border border-aviation-border">
            {/* Flight Phase */}
            <div className="flex items-center justify-center gap-2 mb-4 pb-3 border-b border-aviation-border">
              <span className="text-2xl">{liveData.phaseIcon}</span>
              <span className="text-base font-semibold text-aviation-accent">{liveData.flightPhase}</span>
            </div>
            
            {/* Live Flight Data */}
            <div className="text-xs text-aviation-text-secondary uppercase tracking-wider mb-2">Live Data</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm font-mono">
              <div>
                <span className="text-aviation-text-secondary">Alt: </span>
                <span className="text-aviation-text">{liveData.altitude?.toLocaleString() || '---'} ft</span>
              </div>
              <div>
                <span className="text-aviation-text-secondary">GS: </span>
                <span className="text-aviation-text">{liveData.groundspeed || '---'} kts</span>
              </div>
              <div>
                <span className="text-aviation-text-secondary">HDG: </span>
                <span className="text-aviation-text">{liveData.heading || '---'}°</span>
              </div>
              <div>
                <span className="text-aviation-text-secondary">Pos: </span>
                <span className="text-aviation-text">
                  {liveData.latitude?.toFixed(2) || '--'}, {liveData.longitude?.toFixed(2) || '--'}
                </span>
              </div>
            </div>
            {liveData.route && (
              <div className="mt-2 pt-2 border-t border-aviation-border">
                <span className="text-xs text-aviation-text-secondary">Route: </span>
                <span className="text-xs text-aviation-text font-mono break-all">{liveData.route}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick View Summary */}
      {hasData && (
        <div className="card bg-aviation-surface border-aviation-accent/30">
          <div className="font-mono text-sm">
            {/* Route Line */}
            <div className="flex flex-col items-center gap-1 mb-4">
              {(flightData.flightNumber || flightData.callsign) && (
                <div className="flex items-center gap-3">
                  {flightData.flightNumber && (
                    <span className="text-aviation-accent font-bold text-lg">{flightData.flightNumber}</span>
                  )}
                  {flightData.callsign && flightData.callsign !== flightData.flightNumber && (
                    <span className="text-violet-400 text-base">"{flightData.callsign}"</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4 text-lg">
                {(flightData.depAirport || flightData.arrAirport) && (
                  <>
                    <span className="text-emerald-400 font-bold">{flightData.depAirport || '----'}</span>
                    <span className="text-aviation-text-secondary">→</span>
                    <span className="text-red-400 font-bold">{flightData.arrAirport || '----'}</span>
                  </>
                )}
                {flightData.aircraft && (
                  <span className="text-aviation-text-secondary">({flightData.aircraft})</span>
                )}
              </div>
            </div>
            
            {/* Key Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              {flightData.squawk && (
                <div>
                  <div className="text-xs text-aviation-text-secondary uppercase">Squawk</div>
                  <div className="text-amber-400 font-bold text-lg">{flightData.squawk}</div>
                </div>
              )}
              {flightData.cruiseAlt && (
                <div>
                  <div className="text-xs text-aviation-text-secondary uppercase">Altitude</div>
                  <div className="text-aviation-text font-bold text-lg">{flightData.cruiseAlt}</div>
                </div>
              )}
              {depAtis && (
                <div>
                  <div className="text-xs text-aviation-text-secondary uppercase">DEP ATIS</div>
                  <div className="text-violet-400 font-bold text-lg">{depAtis.code}</div>
                </div>
              )}
              {(flightData.depQnh || depAtis?.qnh) && (
                <div>
                  <div className="text-xs text-aviation-text-secondary uppercase">DEP QNH</div>
                  <div className="text-amber-400 font-bold text-lg">{flightData.depQnh || depAtis?.qnh}</div>
                </div>
              )}
              {flightData.depRunway && (
                <div>
                  <div className="text-xs text-aviation-text-secondary uppercase">DEP RWY</div>
                  <div className="text-emerald-400 font-bold text-lg">{flightData.depRunway}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Field Sections */}
      {FIELD_SECTIONS.map((section) => (
        <div 
          key={section.id} 
          className={`card ${section.borderColor ? `border-l-4 ${section.borderColor}` : ''}`}
        >
          <h3 className={`text-lg font-medium mb-4 ${section.color || 'text-aviation-text'}`}>
            {section.title}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.fields.map((field) => (
              <div 
                key={field.key} 
                className={field.wide ? 'md:col-span-2 lg:col-span-3' : ''}
              >
                <label 
                  htmlFor={field.key}
                  className="block text-sm font-medium text-aviation-text-secondary mb-1"
                >
                  {field.label}
                </label>
                
                {field.multiline ? (
                  <textarea
                    id={field.key}
                    value={flightData[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value, field.uppercase)}
                    placeholder={field.placeholder}
                    className="input-field resize-none h-24"
                    spellCheck="false"
                  />
                ) : (
                  <input
                    type="text"
                    id={field.key}
                    value={flightData[field.key] || ''}
                    onChange={(e) => {
                      let value = e.target.value
                      if (field.type === 'squawk') {
                        value = validateSquawk(value)
                      }
                      handleChange(field.key, value, field.uppercase)
                    }}
                    placeholder={field.placeholder}
                    className="input-field font-mono"
                    spellCheck="false"
                    autoComplete="off"
                  />
                )}
              </div>
            ))}
          </div>

          {/* ATIS Display for Departure/Arrival sections */}
          {section.id === 'departure' && (
            <AtisDisplay 
              atis={depAtis} 
              loading={atisLoading.dep} 
              error={atisError.dep}
              type="dep"
              airport={flightData.depAirport}
            />
          )}
          {section.id === 'arrival' && (
            <AtisDisplay 
              atis={arrAtis} 
              loading={atisLoading.arr} 
              error={atisError.arr}
              type="arr"
              airport={flightData.arrAirport}
            />
          )}
        </div>
      ))}

      {/* Tips */}
      <div className="text-xs text-aviation-text-secondary">
        <p>All data is saved automatically. ATIS information is fetched from VATSIM when you enter an airport code.</p>
      </div>
    </div>
  )
}

export default FlightData
