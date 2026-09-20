import { useState, useEffect, useCallback } from 'react'
import { getFromStorage, setToStorage, removeFromStorage } from '@/lib/utils'

type SetValue<T> = T | ((val: T) => T)

/**
 * Custom hook for managing localStorage with React state
 * Provides automatic synchronization between localStorage and component state
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: SetValue<T>) => void, () => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    return getFromStorage(key, initialValue)
  })

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = useCallback((value: SetValue<T>) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value
      
      // Save state
      setStoredValue(valueToStore)
      
      // Save to local storage
      setToStorage(key, valueToStore)
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  // Function to remove the value from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      removeFromStorage(key)
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  // Listen for changes to localStorage from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue))
        } catch {
          setStoredValue(initialValue)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}

/**
 * Hook for managing user preferences in localStorage
 */
export function useUserPreferences() {
  const [preferences, setPreferences, clearPreferences] = useLocalStorage('user-preferences', {
    theme: 'light',
    language: 'en',
    notifications: true,
    mapView: 'hybrid',
    issueFilters: {},
    dashboardLayout: 'grid',
  })

  const updatePreference = useCallback((key: string, value: unknown) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }))
  }, [setPreferences])

  return {
    preferences,
    updatePreference,
    clearPreferences,
  }
}

/**
 * Hook for managing form draft data
 */
export function useFormDraft<T extends Record<string, unknown>>(
  formId: string,
  initialData: T
) {
  const [draft, setDraft, clearDraft] = useLocalStorage(`form-draft-${formId}`, initialData)

  const updateDraft = useCallback((updates: Partial<T>) => {
    setDraft(prev => ({
      ...prev,
      ...updates
    }))
  }, [setDraft])

  const hasDraft = useCallback(() => {
    return Object.keys(draft).some(key => 
      draft[key] !== initialData[key] && 
      draft[key] !== '' && 
      draft[key] !== null && 
      draft[key] !== undefined
    )
  }, [draft, initialData])

  return {
    draft,
    updateDraft,
    clearDraft,
    hasDraft,
  }
}