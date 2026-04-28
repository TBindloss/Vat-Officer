import React, { useState, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

function DevelopmentWarning() {
  const [hasSeenWarning, setHasSeenWarning] = useLocalStorage('vscpl_dev_warning_seen', false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!hasSeenWarning) {
      setIsVisible(true)
    }
  }, [hasSeenWarning])

  const handleOkay = () => {
    setHasSeenWarning(true)
    setIsVisible(false)
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-aviation-surface border border-aviation-border rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h2 className="text-xl font-semibold text-aviation-text mb-4">
          Heads up
        </h2>
        <p className="text-aviation-text-secondary mb-6 leading-relaxed">
          This application is still in active development. Features may change, 
          and some functionality may not be fully complete. Please report any 
          issues you encounter in our{' '}
          <a 
            href="https://discord.gg/m8qZJ6BKP6" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-aviation-accent hover:underline font-medium"
          >
            Discord
          </a>.
        </p>
        <button
          onClick={handleOkay}
          className="w-full btn-primary py-2.5"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

export default DevelopmentWarning
