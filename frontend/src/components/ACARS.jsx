import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useLocalStorage, STORAGE_KEYS } from '../hooks/useLocalStorage'
import { sendACARSMessage, peekACARSMessages, pollACARSMessages, requestPDC, isValidCallsign, isValidIcaoCode } from '../utils/acarsApi'

/**
 * Default settings for ACARS
 */
const DEFAULT_SETTINGS = {
  logonCode: '',
  callsign: '',
  messageTimeWindow: 20 // minutes - only show messages from last X minutes
}

function ACARS() {
  const [settings, setSettings] = useLocalStorage(STORAGE_KEYS.ACARS_SETTINGS || 'vscpl_acars_settings', DEFAULT_SETTINGS)
  const [activeTab, setActiveTab] = useState('pdc') // 'pdc', 'message', 'inbox'
  
  // PDC form state
  const [pdcForm, setPdcForm] = useState({
    toCallsign: '',
    aircraftType: '',
    departure: '',
    destination: '',
    stand: '',
    atis: ''
  })
  
  // Message form state
  const [messageForm, setMessageForm] = useState({
    toCallsign: '',
    messageType: 'telex',
    message: ''
  })
  
  // Messages state
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [lastPolled, setLastPolled] = useState(null)
  
  const pollTimerRef = useRef(null)
  const filterTimerRef = useRef(null)

  // Filter messages to show only those within the time window
  const filterMessagesByTime = useCallback((messageList) => {
    const timeWindowMs = (settings.messageTimeWindow || 20) * 60 * 1000 // Convert minutes to milliseconds
    const cutoffTime = new Date(Date.now() - timeWindowMs)
    
    return messageList.filter(msg => {
      if (!msg.timestamp) return false
      const msgTime = new Date(msg.timestamp)
      return msgTime >= cutoffTime
    })
  }, [settings.messageTimeWindow])

  // Peek at messages (doesn't consume them, so aircraft can still receive them)
  const pollMessages = useCallback(async () => {
    if (!settings.logonCode || !settings.callsign) {
      return
    }

    try {
      setIsLoading(true)
      // Use peek instead of poll to avoid consuming messages
      // This allows the aircraft to still receive them
      const result = await peekACARSMessages({
        logonCode: settings.logonCode,
        callsign: settings.callsign
      })

      if (result.success) {
        if (result.messages && result.messages.length > 0) {
          // Add new messages to the list with current timestamp
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.raw || `${m.from}-${m.to}-${m.type}-${m.message}`))
            const newMessages = result.messages.filter(m => {
              const msgId = m.raw || `${m.from}-${m.to}-${m.type}-${m.message}`
              return !existingIds.has(msgId)
            })
            if (newMessages.length > 0) {
              // Add timestamp to new messages (use current time since Hoppie doesn't provide timestamps)
              const timestampedMessages = newMessages.map(m => ({
                ...m,
                timestamp: new Date().toISOString()
              }))
              // Merge with existing, keeping all messages, then filter by time
              const allMessages = [...timestampedMessages, ...prev]
              return filterMessagesByTime(allMessages)
            }
            // Even if no new messages, filter existing ones by time
            return filterMessagesByTime(prev)
          })
        } else {
          // Filter existing messages by time even if no new messages
          setMessages(prev => filterMessagesByTime(prev))
        }
      } else {
        // Log error but don't show it as a blocking error (polling errors are common)
        console.warn('ACARS poll warning:', result.error)
        if (result.error && !result.error.toLowerCase().includes('no messages') && !result.error.toLowerCase().includes('ok')) {
          // Only show non-standard errors
          setError(`Poll error: ${result.error}`)
          setTimeout(() => setError(null), 5000)
        }
        // Still filter existing messages by time
        setMessages(prev => filterMessagesByTime(prev))
      }
      
      setLastPolled(new Date())
    } catch (err) {
      console.error('Error polling messages:', err)
      // Filter existing messages by time even on error
      setMessages(prev => filterMessagesByTime(prev))
    } finally {
      setIsLoading(false)
    }
  }, [settings.logonCode, settings.callsign, filterMessagesByTime])

  // Auto-filter messages by time window (removes old messages)
  useEffect(() => {
    // Filter messages every minute to remove old ones
    filterTimerRef.current = setInterval(() => {
      setMessages(prev => filterMessagesByTime(prev))
    }, 60000) // Every minute

    return () => {
      if (filterTimerRef.current) {
        clearInterval(filterTimerRef.current)
      }
    }
  }, [filterMessagesByTime])

  // Auto-polling effect - always poll every 60 seconds when configured
  useEffect(() => {
    if (settings.logonCode && settings.callsign) {
      // Start polling immediately
      setIsPolling(true)
      pollMessages()
      
      // Set up interval to poll every 60 seconds
      pollTimerRef.current = setInterval(() => {
        pollMessages()
      }, 60000) // 60 seconds
      
      return () => {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current)
        }
      }
    } else {
      setIsPolling(false)
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
      }
    }
  }, [settings.logonCode, settings.callsign, pollMessages])

  // Handle PDC request
  const handlePDCRequest = useCallback(async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    if (!settings.logonCode || !settings.logonCode.trim()) {
      setError('Logon code is required. Please configure it in settings.')
      setIsLoading(false)
      return
    }

    if (!settings.callsign || !settings.callsign.trim()) {
      setError('Callsign is required. Please configure it in settings.')
      setIsLoading(false)
      return
    }

    if (!pdcForm.toCallsign || !pdcForm.aircraftType || !pdcForm.departure || !pdcForm.destination) {
      setError('Please fill in all required fields (To, Aircraft Type, Departure, Destination)')
      setIsLoading(false)
      return
    }

    try {
      const result = await requestPDC({
        logonCode: settings.logonCode,
        fromCallsign: settings.callsign,
        toCallsign: pdcForm.toCallsign,
        aircraftType: pdcForm.aircraftType,
        departure: pdcForm.departure,
        destination: pdcForm.destination,
        stand: pdcForm.stand || undefined,
        atis: pdcForm.atis || undefined
      })

      if (result.success) {
        setSuccess('PDC request sent successfully!')
        // Clear form
        setPdcForm({
          toCallsign: '',
          aircraftType: '',
          departure: '',
          destination: '',
          stand: '',
          atis: ''
        })
        // Switch to inbox to see response
        setTimeout(() => {
          setActiveTab('inbox')
          pollMessages()
        }, 1000)
      } else {
        setError(result.error || 'Failed to send PDC request')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while sending PDC request')
    } finally {
      setIsLoading(false)
    }
  }, [settings, pdcForm, pollMessages])

  // Handle message send
  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    if (!settings.logonCode || !settings.logonCode.trim()) {
      setError('Logon code is required. Please configure it in settings.')
      setIsLoading(false)
      return
    }

    if (!settings.callsign || !settings.callsign.trim()) {
      setError('Callsign is required. Please configure it in settings.')
      setIsLoading(false)
      return
    }

    if (!messageForm.toCallsign || !messageForm.message) {
      setError('Please fill in To callsign and message')
      setIsLoading(false)
      return
    }

    try {
      const result = await sendACARSMessage({
        logonCode: settings.logonCode,
        fromCallsign: settings.callsign,
        toCallsign: messageForm.toCallsign,
        messageType: messageForm.messageType,
        message: messageForm.message
      })

      if (result.success) {
        setSuccess('Message sent successfully!')
        // Clear form
        setMessageForm({
          toCallsign: '',
          messageType: 'telex',
          message: ''
        })
        // Switch to inbox to see response
        setTimeout(() => {
          setActiveTab('inbox')
          pollMessages()
        }, 1000)
      } else {
        setError(result.error || 'Failed to send message')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while sending message')
    } finally {
      setIsLoading(false)
    }
  }, [settings, messageForm, pollMessages])

  // Format last polled time
  const formatLastPolled = () => {
    if (!lastPolled) return 'Never'
    return lastPolled.toLocaleTimeString()
  }

  // Check if settings are configured
  const isConfigured = settings.logonCode && settings.callsign

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-xl font-medium">ACARS Messaging</h2>
        <p className="text-sm text-aviation-text-secondary">
          Send and receive ACARS messages via Hoppie's ACARS system
        </p>
      </div>

      {/* Settings Card */}
      <div className="card">
        <h3 className="text-lg font-medium mb-4">Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
              Hoppie Logon Code *
            </label>
            <input
              type="password"
              value={settings.logonCode}
              onChange={(e) => setSettings(prev => ({ ...prev, logonCode: e.target.value }))}
              placeholder="Your Hoppie ACARS logon code"
              className="input-field font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-aviation-text-secondary mt-1">
              Get your logon code from{' '}
              <a href="https://www.hoppie.nl/acars/" target="_blank" rel="noopener noreferrer" className="text-aviation-accent hover:underline">
                hoppie.nl/acars
              </a>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
              Aircraft Callsign *
            </label>
            <input
              type="text"
              value={settings.callsign}
              onChange={(e) => setSettings(prev => ({ ...prev, callsign: e.target.value.toUpperCase() }))}
              placeholder="e.g. BAW573"
              className="input-field font-mono"
              maxLength={10}
            />
          </div>
        </div>
        {isConfigured && (
          <div className="mt-4">
            <p className="text-xs text-aviation-text-secondary">
              Messages are automatically polled every 60 seconds when configured.
            </p>
          </div>
        )}
        {!isConfigured && (
          <div className="mt-4 p-3 bg-amber-950/40 border border-amber-800/50 rounded-md text-amber-300 text-sm">
            Please configure your logon code and callsign to use ACARS messaging.
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="card bg-red-950/40 border-red-800/50 text-red-300">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}
      {success && (
        <div className="card bg-emerald-950/40 border-emerald-800/50 text-emerald-300">
          <p className="font-medium">Success</p>
          <p className="text-sm mt-1">{success}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-aviation-border">
        <button
          onClick={() => setActiveTab('pdc')}
          className={`tab ${activeTab === 'pdc' ? 'tab-active' : ''}`}
        >
          PDC Request
        </button>
        <button
          onClick={() => setActiveTab('message')}
          className={`tab ${activeTab === 'message' ? 'tab-active' : ''}`}
        >
          Send Message
        </button>
        <button
          onClick={() => setActiveTab('inbox')}
          className={`tab ${activeTab === 'inbox' ? 'tab-active' : ''}`}
        >
          Inbox {messages.length > 0 && `(${messages.length})`}
        </button>
      </div>

      {/* PDC Request Tab */}
      {activeTab === 'pdc' && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4">Pre-Departure Clearance Request</h3>
          <form onSubmit={handlePDCRequest} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                  To (ATC Facility) *
                </label>
                <input
                  type="text"
                  value={pdcForm.toCallsign}
                  onChange={(e) => setPdcForm(prev => ({ ...prev, toCallsign: e.target.value.toUpperCase() }))}
                  placeholder="e.g. EGLL_DEL"
                  className="input-field font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                  Aircraft Type *
                </label>
                <input
                  type="text"
                  value={pdcForm.aircraftType}
                  onChange={(e) => setPdcForm(prev => ({ ...prev, aircraftType: e.target.value.toUpperCase() }))}
                  placeholder="e.g. B738, A320"
                  className="input-field font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                  Departure Airport *
                </label>
                <input
                  type="text"
                  value={pdcForm.departure}
                  onChange={(e) => setPdcForm(prev => ({ ...prev, departure: e.target.value.toUpperCase() }))}
                  placeholder="e.g. EGLL"
                  className="input-field font-mono"
                  maxLength={4}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                  Destination Airport *
                </label>
                <input
                  type="text"
                  value={pdcForm.destination}
                  onChange={(e) => setPdcForm(prev => ({ ...prev, destination: e.target.value.toUpperCase() }))}
                  placeholder="e.g. KJFK"
                  className="input-field font-mono"
                  maxLength={4}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                  Stand/Gate
                </label>
                <input
                  type="text"
                  value={pdcForm.stand}
                  onChange={(e) => setPdcForm(prev => ({ ...prev, stand: e.target.value.toUpperCase() }))}
                  placeholder="e.g. A12"
                  className="input-field font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                  ATIS Code
                </label>
                <input
                  type="text"
                  value={pdcForm.atis}
                  onChange={(e) => setPdcForm(prev => ({ ...prev, atis: e.target.value.toUpperCase() }))}
                  placeholder="e.g. A"
                  className="input-field font-mono"
                  maxLength={1}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !isConfigured}
              >
                {isLoading ? 'Sending...' : 'Send PDC Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Send Message Tab */}
      {activeTab === 'message' && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4">Send ACARS Message</h3>
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                  To (Callsign) *
                </label>
                <input
                  type="text"
                  value={messageForm.toCallsign}
                  onChange={(e) => setMessageForm(prev => ({ ...prev, toCallsign: e.target.value.toUpperCase() }))}
                  placeholder="e.g. EGLL_TWR"
                  className="input-field font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                  Message Type
                </label>
                <select
                  value={messageForm.messageType}
                  onChange={(e) => setMessageForm(prev => ({ ...prev, messageType: e.target.value }))}
                  className="input-field"
                >
                  <option value="telex">Telex</option>
                  <option value="cpdlc">CPDLC</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-aviation-text-secondary mb-1">
                Message *
              </label>
              <textarea
                value={messageForm.message}
                onChange={(e) => setMessageForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Enter your message..."
                className="input-field font-mono"
                rows={6}
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !isConfigured}
              >
                {isLoading ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inbox Tab */}
      {activeTab === 'inbox' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Inbox</h3>
            <div className="flex items-center gap-4">
              {isPolling && (
                <span className="text-sm text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  Auto-polling every 60 seconds
                </span>
              )}
              {!isConfigured && (
                <span className="text-sm text-aviation-text-secondary">
                  Configure settings to start polling
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4 mb-4 text-xs text-aviation-text-secondary">
            {lastPolled && (
              <span>Last polled: {formatLastPolled()}</span>
            )}
            {isConfigured && (
              <span>Callsign: <span className="font-mono text-aviation-text">{settings.callsign}</span></span>
            )}
            <span>
              Showing messages from last {settings.messageTimeWindow || 20} minutes
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg text-aviation-text">No messages</p>
              <p className="text-sm text-aviation-text-secondary mt-2">
                {isConfigured 
                  ? 'Messages are automatically polled every 60 seconds. Make sure you\'ve sent a message first.'
                  : 'Configure your settings to receive messages'
                }
              </p>
              {isConfigured && (
                <p className="text-xs text-aviation-text-secondary mt-4">
                  Tip: Send a PDC request or message first. Messages will appear automatically within 60 seconds.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <div
                  key={`${msg.raw || msg.from}-${idx}`}
                  className="bg-aviation-surface border border-aviation-border/70 rounded-md p-4 hover:border-aviation-accent/50 transition-colors shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-aviation-text">{msg.from}</span>
                        <span className="text-aviation-text-secondary">→</span>
                        <span className="font-mono font-semibold text-aviation-text">{msg.to}</span>
                      </div>
                      {msg.timestamp && (
                        <p className="text-xs text-aviation-text-secondary mt-1">
                          Received: {new Date(msg.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-aviation-text-secondary bg-aviation-surface-light px-2 py-1 rounded ml-2">
                      {msg.type || 'telex'}
                    </span>
                  </div>
                  <div className="font-mono text-sm text-aviation-text whitespace-pre-wrap bg-aviation-surface-light p-3 rounded mt-2">
                    {msg.message || '(No message content)'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

export default ACARS
