import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook for persisting state to localStorage.
 * Automatically syncs state with browser storage.
 * 
 * @param {string} key - The localStorage key
 * @param {any} initialValue - Default value if key doesn't exist
 * @returns {[any, Function, Function]} - [value, setValue, clearValue]
 */
export function useLocalStorage(key, initialValue) {
  // Get initial value from localStorage or use default
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Update localStorage when value changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  // Memoized setter function
  const setValue = useCallback((value) => {
    setStoredValue((prevValue) => {
      const valueToStore = value instanceof Function ? value(prevValue) : value
      return valueToStore
    })
  }, [])

  // Clear the stored value
  const clearValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  return [storedValue, setValue, clearValue]
}

/**
 * Generate a simple hash for a string (for checklist identification).
 * Uses djb2 algorithm - fast and produces decent distribution.
 * 
 * @param {string} str - String to hash
 * @returns {string} - Hex string hash
 */
export function generateHash(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16)
}

/**
 * Storage keys used throughout the application.
 */
export const STORAGE_KEYS = {
  CHECKLISTS: 'vscpl_checklists',
  CHECKLIST_STATES: 'vscpl_checklist_states',
  FLIGHT_DATA: 'vscpl_flight_data',
  RADIO_SETTINGS: 'vscpl_radio_settings',
  NOTE_CONTENT: 'vscpl_note_content',
  ACARS_SETTINGS: 'vscpl_acars_settings'
}

export default useLocalStorage
