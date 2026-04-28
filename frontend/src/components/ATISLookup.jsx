import React, { useState, useCallback } from 'react'
import { fetchAtis, fetchRealWorldAtis, isValidIcaoCode } from '../utils/vatsimApi'

function ATISLookup() {
  const [airportCode, setAirportCode] = useState('')
  const [atisSource, setAtisSource] = useState('vatsim') // 'vatsim' or 'realworld'
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [atisData, setAtisData] = useState(null)

  const handleLookup = useCallback(async (e) => {
    e.preventDefault()
    
    const code = airportCode.trim().toUpperCase()
    
    if (!code) {
      setError('Please enter an airport ICAO code')
      return
    }
    
    if (!isValidIcaoCode(code)) {
      setError('Invalid ICAO code format. Must be 2-4 letters (e.g., EGLL, KJFK)')
      return
    }
    
    setIsLoading(true)
    setError(null)
    setAtisData(null)
    
    try {
      if (atisSource === 'vatsim') {
        const result = await fetchAtis({ airport: code })
        
        if (result.success) {
          if (result.atis && result.atis.length > 0) {
            setAtisData({
              source: 'vatsim',
              airport: code,
              data: result.atis
            })
          } else {
            setError(`No VATSIM ATIS found for ${code}`)
          }
        } else {
          setError(result.error || 'Failed to fetch VATSIM ATIS')
        }
      } else {
        // Real-world ATIS
        const result = await fetchRealWorldAtis(code)
        
        if (result.success) {
          setAtisData({
            source: 'realworld',
            airport: code,
            data: result.data
          })
        } else {
          setError(result.error || 'Failed to fetch real-world ATIS')
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching ATIS')
    } finally {
      setIsLoading(false)
    }
  }, [airportCode, atisSource])

  const formatMetarData = (metarData) => {
    if (!metarData) return null
    
    const parts = []
    
    // Wind
    if (metarData.wind && typeof metarData.wind === 'object') {
      const wind = metarData.wind
      const dir = wind.dirFrom !== undefined && wind.dirFrom !== null ? wind.dirFrom : null
      const speed = wind.speedKts !== undefined && wind.speedKts !== null ? wind.speedKts : null
      
      if (dir !== null && speed !== null) {
        const dirStr = dir === 'VRB' || dir === 0 ? 'Variable' : `${dir}°`
        const gust = wind.gustKts ? `, gusting ${wind.gustKts}` : ''
        parts.push(`Wind: ${dirStr} at ${speed} knots${gust}`)
      }
    }
    
    // Visibility
    if (metarData.visibility && typeof metarData.visibility === 'object') {
      const vis = metarData.visibility
      if (vis.distanceSm !== undefined && vis.distanceSm !== null) {
        parts.push(`Visibility: ${vis.distanceSm} statute miles`)
      } else if (vis.distanceKm !== undefined && vis.distanceKm !== null) {
        parts.push(`Visibility: ${vis.distanceKm} km`)
      }
    }
    
    // Weather
    if (metarData.weather && metarData.weather.trim()) {
      parts.push(`Weather: ${metarData.weather}`)
    }
    
    // Clouds
    if (metarData.clouds && Array.isArray(metarData.clouds) && metarData.clouds.length > 0) {
      const cloudStr = metarData.clouds.map(c => {
        if (typeof c === 'object') {
          const cover = c.cover || c.code || ''
          const base = (c.baseFtAgl !== undefined && c.baseFtAgl !== null) ? `${c.baseFtAgl}ft` : ''
          return `${cover} ${base}`.trim()
        }
        return String(c)
      }).filter(Boolean).join(', ')
      if (cloudStr) {
        parts.push(`Clouds: ${cloudStr}`)
      }
    }
    
    // Temperature
    if (metarData.temperature && typeof metarData.temperature === 'object') {
      const temp = metarData.temperature.value !== undefined ? metarData.temperature.value : null
      if (temp !== null) {
        const dewpoint = (metarData.dewpoint && metarData.dewpoint.value !== undefined) 
          ? metarData.dewpoint.value 
          : null
        if (dewpoint !== null) {
          parts.push(`Temperature: ${temp}°C / Dewpoint: ${dewpoint}°C`)
        } else {
          parts.push(`Temperature: ${temp}°C`)
        }
      }
    }
    
    // Altimeter
    if (metarData.altimeter && typeof metarData.altimeter === 'object') {
      const alt = metarData.altimeter.value !== undefined ? metarData.altimeter.value : null
      if (alt !== null) {
        // Convert inHg to hPa
        const qnh = Math.round(alt * 33.8639)
        parts.push(`Altimeter: ${alt} inHg (QNH: ${qnh} hPa)`)
      }
    }
    
    return parts.length > 0 ? parts : null
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-xl font-medium">ATIS Lookup</h2>
        <p className="text-sm text-aviation-text-secondary">
          Retrieve ATIS information for airports from VATSIM or real-world sources
        </p>
      </div>

      {/* Lookup Form */}
      <div className="card">
        <h3 className="text-lg font-medium mb-4">Airport ATIS Lookup</h3>
        <form onSubmit={handleLookup} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                Airport ICAO Code *
              </label>
              <input
                type="text"
                value={airportCode}
                onChange={(e) => setAirportCode(e.target.value.toUpperCase())}
                placeholder="e.g. EGLL, KJFK"
                className="input-field font-mono"
                maxLength={4}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                ATIS Source
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="atisSource"
                    value="vatsim"
                    checked={atisSource === 'vatsim'}
                    onChange={(e) => setAtisSource(e.target.value)}
                    className="text-aviation-accent"
                  />
                  <span className="text-sm">VATSIM</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="atisSource"
                    value="realworld"
                    checked={atisSource === 'realworld'}
                    onChange={(e) => setAtisSource(e.target.value)}
                    className="text-aviation-accent"
                  />
                  <span className="text-sm">Real-World</span>
                </label>
              </div>
              <p className="text-xs text-aviation-text-secondary mt-1">
                Real-World uses METAR data from Aviation Weather Center
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Fetching...' : 'Lookup ATIS'}
            </button>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="card bg-red-950/40 border-red-800/50 text-red-300">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* ATIS Results */}
      {atisData && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">
              ATIS Information for {atisData.airport}
            </h3>
            <span className="text-xs text-aviation-text-secondary bg-aviation-surface-light px-2 py-1 rounded">
              {atisData.source === 'vatsim' ? 'VATSIM' : 'Real-World'}
            </span>
          </div>

          {atisData.source === 'vatsim' && (
            <div className="space-y-4">
              {atisData.data.map((atis, idx) => (
                <div
                  key={idx}
                  className="bg-aviation-surface border border-aviation-border/70 rounded-md p-4 shadow-sm"
                >
                  <div className="flex items-center gap-4 mb-3">
                    <div>
                      <span className="text-sm text-aviation-text-secondary">Callsign:</span>
                      <span className="ml-2 font-mono font-semibold text-aviation-text">
                        {atis.callsign}
                      </span>
                    </div>
                    {atis.frequency && (
                      <div>
                        <span className="text-sm text-aviation-text-secondary">Frequency:</span>
                        <span className="ml-2 font-mono text-aviation-text">
                          {atis.frequency}
                        </span>
                      </div>
                    )}
                    {atis.atis_code && (
                      <div>
                        <span className="text-sm text-aviation-text-secondary">ATIS Code:</span>
                        <span className="ml-2 font-mono font-semibold text-aviation-accent text-lg">
                          {atis.atis_code}
                        </span>
                      </div>
                    )}
                  </div>
                  {atis.text_atis && atis.text_atis.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-aviation-text-secondary mb-2">ATIS Text:</p>
                      <div className="font-mono text-sm text-aviation-text whitespace-pre-wrap bg-aviation-surface-light p-3 rounded">
                        {atis.text_atis.join('\n')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {atisData.source === 'realworld' && (
            <div className="space-y-4">
              {atisData.data.metar ? (
                <div className="bg-aviation-surface-light border border-aviation-border rounded-md p-4">
                  <div className="mb-4">
                    <p className="text-sm font-medium text-aviation-text-secondary mb-2">Raw METAR:</p>
                    <div className="font-mono text-sm text-aviation-text whitespace-pre-wrap bg-aviation-surface-light p-3 rounded border border-aviation-border/60">
                      {atisData.data.metar}
                    </div>
                  </div>
                  
                  {atisData.data.observation_time && (
                    <p className="text-xs text-aviation-text-secondary mb-3">
                      Observation Time: {new Date(atisData.data.observation_time).toLocaleString()}
                    </p>
                  )}
                  
                  {formatMetarData(atisData.data) && (
                    <div className="mt-4 pt-4 border-t border-aviation-border">
                      <p className="text-sm font-medium text-aviation-text-secondary mb-3">Decoded Information:</p>
                      <div className="space-y-2">
                        {formatMetarData(atisData.data).map((line, idx) => (
                          <p key={idx} className="text-sm text-aviation-text">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-aviation-text-secondary">
                  <p>No METAR data available for this airport</p>
                  <p className="text-xs mt-2">The airport may not have active weather reporting, or the ICAO code may be incorrect.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ATISLookup
