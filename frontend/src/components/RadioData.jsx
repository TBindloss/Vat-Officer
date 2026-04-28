import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useLocalStorage, STORAGE_KEYS } from '../hooks/useLocalStorage'
import { fetchControllers, isValidIcaoCode, formatFrequency, getFacilityTypeColor } from '../utils/vatsimApi'

/**
 * Default settings for radio data
 */
const DEFAULT_SETTINGS = {
  airportFilter: '',
  autoRefresh: true,
  refreshInterval: 60 // seconds
}

function RadioData() {
  const [settings, setSettings] = useLocalStorage(STORAGE_KEYS.RADIO_SETTINGS, DEFAULT_SETTINGS)
  const [controllers, setControllers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [searchInput, setSearchInput] = useState(settings.airportFilter || '')
  
  const refreshTimerRef = useRef(null)

  // Fetch controllers data
  const loadControllers = useCallback(async (airport = null) => {
    setIsLoading(true)
    setError(null)

    const filterAirport = airport !== null ? airport : settings.airportFilter

    const result = await fetchControllers({ airport: filterAirport })

    if (result.success) {
      setControllers(result.controllers)
      setLastUpdated(new Date())
    } else {
      setError(result.error)
      setControllers([])
    }

    setIsLoading(false)
  }, [settings.airportFilter])

  // Initial load and auto-refresh setup
  useEffect(() => {
    loadControllers()

    // Setup auto-refresh
    if (settings.autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        loadControllers()
      }, settings.refreshInterval * 1000)
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [settings.autoRefresh, settings.refreshInterval, loadControllers])

  // Handle search
  const handleSearch = useCallback(() => {
    const sanitized = searchInput.trim().toUpperCase()
    
    if (sanitized && !isValidIcaoCode(sanitized)) {
      setError('Invalid ICAO code format (2-4 letters)')
      return
    }

    setSettings(prev => ({
      ...prev,
      airportFilter: sanitized
    }))
    
    loadControllers(sanitized)
  }, [searchInput, setSettings, loadControllers])

  // Handle search input keypress
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }, [handleSearch])

  // Clear filter
  const handleClearFilter = useCallback(() => {
    setSearchInput('')
    setSettings(prev => ({
      ...prev,
      airportFilter: ''
    }))
    loadControllers('')
  }, [setSettings, loadControllers])

  // Toggle auto-refresh
  const handleToggleAutoRefresh = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      autoRefresh: !prev.autoRefresh
    }))
  }, [setSettings])

  // Format last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never'
    return lastUpdated.toLocaleTimeString()
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-xl font-medium">Radio Data</h2>
        <p className="text-sm text-aviation-text-secondary">
          Active VATSIM controllers and frequencies
        </p>
      </div>

      {/* Search and Controls */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Airport Search */}
          <div className="flex-1">
            <label 
              htmlFor="airport-search"
              className="block text-sm font-medium text-aviation-text-secondary mb-1"
            >
              Filter by Airport (ICAO)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="airport-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="e.g. EGLL"
                className="input-field font-mono flex-1"
                maxLength={4}
                autoComplete="off"
              />
              <button
                onClick={handleSearch}
                className="btn-primary"
                disabled={isLoading}
              >
                Search
              </button>
              {settings.airportFilter && (
                <button
                  onClick={handleClearFilter}
                  className="btn-secondary"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Refresh Controls */}
          <div className="flex items-end gap-2">
            <button
              onClick={() => loadControllers()}
              className="btn-secondary flex items-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="animate-spin">↻</span>
              ) : (
                <span>↻</span>
              )}
              Refresh
            </button>
            <button
              onClick={handleToggleAutoRefresh}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                settings.autoRefresh 
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50' 
                  : 'bg-aviation-surface-light border border-aviation-border text-aviation-text-secondary hover:bg-aviation-border'
              }`}
              title={settings.autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              Auto {settings.autoRefresh ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex items-center justify-between text-xs text-aviation-text-secondary">
          <div>
            {settings.airportFilter && (
              <span className="mr-4">
                Filtering: <span className="text-aviation-accent font-mono">{settings.airportFilter}</span>
              </span>
            )}
            <span>{controllers.length} controller{controllers.length !== 1 ? 's' : ''} online</span>
          </div>
          <div>
            Last updated: {formatLastUpdated()}
            {settings.autoRefresh && (
              <span className="ml-2 text-emerald-400">
                (auto-refresh every {settings.refreshInterval}s)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card bg-red-950/40 border-red-800/50 text-red-300">
          <p className="font-medium">Unable to fetch data</p>
          <p className="text-sm mt-1">{error}</p>
          <p className="text-xs mt-2 text-red-400">
            This may be temporary. Try refreshing or check your connection.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && controllers.length === 0 && (
        <div className="card text-center py-8">
          <div className="animate-spin text-4xl mb-4">↻</div>
          <p className="text-aviation-text-secondary">Loading controller data...</p>
        </div>
      )}

      {/* Controllers Table */}
      {!isLoading && controllers.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-aviation-surface-light">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-aviation-text-secondary uppercase tracking-wider">
                    Callsign
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-aviation-text-secondary uppercase tracking-wider">
                    Facility
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-aviation-text-secondary uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-aviation-text-secondary uppercase tracking-wider">
                    Controller
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aviation-border">
                {controllers.map((controller, idx) => (
                  <tr 
                    key={`${controller.callsign}-${idx}`}
                    className="hover:bg-aviation-surface-light transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-aviation-text">
                      {controller.callsign}
                    </td>
                    <td className={`px-4 py-3 font-medium ${getFacilityTypeColor(controller.facility_type)}`}>
                      {controller.facility_type}
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-400 font-medium">
                      {formatFrequency(controller.frequency)}
                    </td>
                    <td className="px-4 py-3 text-aviation-text-secondary">
                      {controller.name || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && controllers.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-lg text-aviation-text">No controllers found</p>
          <p className="text-sm text-aviation-text-secondary mt-2">
            {settings.airportFilter 
              ? `No active controllers for ${settings.airportFilter}`
              : 'Try searching for a specific airport ICAO code'
            }
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-xs text-aviation-text-secondary bg-aviation-surface-light rounded-md p-3 border border-aviation-border/40">
        <p className="font-medium mb-1">Advisory Information Only</p>
        <p>
          This data is provided for reference only and may not reflect real-time VATSIM network status. 
          Always verify frequencies through official VATSIM sources before making contact.
        </p>
      </div>
    </div>
  )
}

export default RadioData
