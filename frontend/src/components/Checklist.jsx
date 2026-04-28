import React, { useState, useCallback, useMemo } from 'react'
import { useLocalStorage, generateHash, STORAGE_KEYS } from '../hooks/useLocalStorage'
import { parseChecklistFile, getItemText, getItemNote, getChecklistItemCount } from '../utils/checklistValidator'
import ChecklistItem from './ChecklistItem'

// Sample checklist template for download
const SAMPLE_TEMPLATE = {
  "title": "Example Checklist",
  "description": "A template showing the checklist format",
  "categories": [
    {
      "name": "Before Start",
      "context": "Overhead Panel",
      "items": [
        "Parking brake SET",
        "Battery switches ON",
        "External power CONNECTED"
      ]
    },
    {
      "name": "Engine Start",
      "context": "Center Pedestal",
      "items": [
        "Fuel pumps ON",
        "Engine start switch START",
        "Engine instruments CHECK"
      ]
    }
  ]
}

function Checklist() {
  const [checklists, setChecklists] = useLocalStorage(STORAGE_KEYS.CHECKLISTS, [])
  const [checklistStates, setChecklistStates] = useLocalStorage(STORAGE_KEYS.CHECKLIST_STATES, {})
  const [activeChecklistId, setActiveChecklistId] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [uploadWarnings, setUploadWarnings] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [showUploadArea, setShowUploadArea] = useState(false)

  // Get the active checklist
  const activeChecklist = useMemo(() => {
    if (!activeChecklistId) return null
    return checklists.find(c => c.id === activeChecklistId) || null
  }, [checklists, activeChecklistId])

  // Get checked state for active checklist
  const checkedItems = useMemo(() => {
    if (!activeChecklistId) return {}
    return checklistStates[activeChecklistId] || {}
  }, [checklistStates, activeChecklistId])

  // Calculate progress for a checklist
  const getProgress = useCallback((checklistId) => {
    const checklist = checklists.find(c => c.id === checklistId)
    if (!checklist) return { checked: 0, total: 0, percentage: 0 }
    
    const state = checklistStates[checklistId] || {}
    const total = getChecklistItemCount(checklist)
    const checked = Object.values(state).filter(Boolean).length
    const percentage = total > 0 ? Math.round((checked / total) * 100) : 0
    
    return { checked, total, percentage }
  }, [checklists, checklistStates])

  // Download template
  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([JSON.stringify(SAMPLE_TEMPLATE, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'checklist-template.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  // Handle file upload
  const handleFileUpload = useCallback(async (file) => {
    setUploadError(null)
    setUploadWarnings([])

    const result = await parseChecklistFile(file)

    if (!result.valid) {
      setUploadError(result.errors.join('. '))
      return
    }

    if (result.warnings.length > 0) {
      setUploadWarnings(result.warnings)
    }

    // Generate unique ID based on content
    const checklistJson = JSON.stringify(result.checklist)
    const id = generateHash(checklistJson)

    // Check if checklist already exists
    const existingIndex = checklists.findIndex(c => c.id === id)
    if (existingIndex >= 0) {
      // Replace existing
      setChecklists(prev => {
        const updated = [...prev]
        updated[existingIndex] = { ...result.checklist, id }
        return updated
      })
    } else {
      // Add new
      setChecklists(prev => [...prev, { ...result.checklist, id }])
    }

    setActiveChecklistId(id)
    setShowUploadArea(false)
  }, [checklists, setChecklists])

  // Handle file input change
  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
    // Reset input
    e.target.value = ''
  }, [handleFileUpload])

  // Handle drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  // Toggle item checked state
  const handleItemToggle = useCallback((categoryIndex, itemIndex) => {
    if (!activeChecklistId) return

    const key = `${categoryIndex}-${itemIndex}`
    const wasChecked = checkedItems[key] || false
    const isNowChecked = !wasChecked
    
    setChecklistStates(prev => ({
      ...prev,
      [activeChecklistId]: {
        ...(prev[activeChecklistId] || {}),
        [key]: isNowChecked
      }
    }))
  }, [activeChecklistId, checkedItems, setChecklistStates])

  // Reset checklist progress
  const handleResetChecklist = useCallback(() => {
    if (!activeChecklistId) return
    
    setChecklistStates(prev => ({
      ...prev,
      [activeChecklistId]: {}
    }))
  }, [activeChecklistId, setChecklistStates])

  // Delete a checklist
  const handleDeleteChecklist = useCallback((checklistId) => {
    setChecklists(prev => prev.filter(c => c.id !== checklistId))
    setChecklistStates(prev => {
      const updated = { ...prev }
      delete updated[checklistId]
      return updated
    })
    if (activeChecklistId === checklistId) {
      setActiveChecklistId(null)
    }
  }, [activeChecklistId, setChecklists, setChecklistStates])

  // Find next unchecked item index
  const findNextUnchecked = useCallback(() => {
    if (!activeChecklist) return null
    
    for (let catIdx = 0; catIdx < activeChecklist.categories.length; catIdx++) {
      const category = activeChecklist.categories[catIdx]
      for (let itemIdx = 0; itemIdx < category.items.length; itemIdx++) {
        const key = `${catIdx}-${itemIdx}`
        if (!checkedItems[key]) {
          return { categoryIndex: catIdx, itemIndex: itemIdx }
        }
      }
    }
    return null
  }, [activeChecklist, checkedItems])

  const nextUnchecked = findNextUnchecked()
  const hasChecklists = checklists.length > 0

  return (
    <div className="space-y-6 pb-16">
      {/* Header with compact controls when checklists exist */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium">Checklists</h2>
          <p className="text-sm text-aviation-text-secondary">
            Upload and track your flight checklists
          </p>
        </div>
        
        {hasChecklists && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="btn-secondary text-sm"
              title="Download a template JSON file"
            >
              Template
            </button>
            <label className="btn-primary text-sm cursor-pointer">
              Upload
              <input
                type="file"
                accept=".json"
                onChange={handleInputChange}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Empty State - Full upload area */}
      {!hasChecklists && (
        <div className="card">
          <div className="text-center mb-6">
            <p className="text-lg text-aviation-text">No checklists uploaded yet</p>
            <p className="text-sm text-aviation-text-secondary mt-2">
              Upload a JSON checklist file to get started, or download our template
            </p>
          </div>

          {/* Download Template Button */}
          <div className="flex justify-center mb-6">
            <button
              onClick={handleDownloadTemplate}
              className="btn-secondary flex items-center gap-2"
            >
              <span>↓</span>
              Download Template
            </button>
          </div>
          
          {/* Drag and Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging 
                ? 'border-aviation-accent bg-aviation-accent/10' 
                : 'border-aviation-border hover:border-aviation-text-secondary'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".json"
              onChange={handleInputChange}
              className="hidden"
              id="checklist-upload-empty"
            />
            <label 
              htmlFor="checklist-upload-empty" 
              className="cursor-pointer block"
            >
              <p className="text-aviation-text mb-1">
                Drop a JSON checklist file here
              </p>
              <p className="text-sm text-aviation-text-secondary">
                or click to browse
              </p>
            </label>
          </div>

          {/* Error Display */}
          {uploadError && (
            <div className="mt-4 p-3 bg-red-950/40 border border-red-800/50 rounded-md text-red-300 text-sm">
              {uploadError}
            </div>
          )}

          {/* Warnings Display */}
          {uploadWarnings.length > 0 && (
            <div className="mt-4 p-3 bg-amber-950/40 border border-amber-800/50 rounded-md text-amber-300 text-sm">
              <p className="font-medium mb-1">Warnings:</p>
              <ul className="list-disc list-inside">
                {uploadWarnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Expandable Upload Area when checklists exist */}
      {hasChecklists && showUploadArea && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Upload New Checklist</h3>
            <button
              onClick={() => setShowUploadArea(false)}
              className="text-aviation-text-secondary hover:text-aviation-text"
            >
              ✕
            </button>
          </div>
          
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging 
                ? 'border-aviation-accent bg-aviation-accent/10' 
                : 'border-aviation-border hover:border-aviation-text-secondary'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".json"
              onChange={handleInputChange}
              className="hidden"
              id="checklist-upload-expanded"
            />
            <label 
              htmlFor="checklist-upload-expanded" 
              className="cursor-pointer block"
            >
              <p className="text-aviation-text mb-1">
                Drop a JSON file here or click to browse
              </p>
            </label>
          </div>

          {/* Error Display */}
          {uploadError && (
            <div className="mt-4 p-3 bg-red-950/40 border border-red-800/50 rounded-md text-red-300 text-sm">
              {uploadError}
            </div>
          )}
        </div>
      )}

      {/* Checklist Selection */}
      {hasChecklists && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4">Your Checklists</h3>
          <div className="space-y-2">
            {checklists.map((checklist) => {
              const progress = getProgress(checklist.id)
              const isActive = activeChecklistId === checklist.id
              
              return (
                <div
                  key={checklist.id}
                  className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                    isActive 
                      ? 'bg-aviation-accent/10 border border-aviation-accent/50' 
                      : 'bg-aviation-surface-light hover:bg-aviation-border/50'
                  }`}
                  onClick={() => setActiveChecklistId(checklist.id)}
                >
                  <div className="flex-1">
                    <h3 className="font-medium">{checklist.title}</h3>
                    {checklist.description && (
                      <p className="text-sm text-aviation-text-secondary">{checklist.description}</p>
                    )}
                    <div className="flex items-center mt-1 text-xs text-aviation-text-secondary">
                      <span>{progress.checked}/{progress.total} items</span>
                      <span className="mx-2">•</span>
                      <span className={progress.percentage === 100 ? 'text-aviation-success' : ''}>
                        {progress.percentage}% complete
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteChecklist(checklist.id)
                    }}
                    className="ml-4 p-2 text-aviation-text-secondary hover:text-red-400 transition-colors"
                    title="Delete checklist"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Checklist Display */}
      {activeChecklist && (
        <div className="card">
          {/* Checklist Header */}
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-aviation-border">
            <div>
              <h2 className="text-xl font-medium font-mono uppercase tracking-wider">
                {activeChecklist.title}
              </h2>
              {activeChecklist.description && (
                <p className="text-sm text-aviation-text-secondary mt-1">
                  {activeChecklist.description}
                </p>
              )}
            </div>
            <button
              onClick={handleResetChecklist}
              className="btn-secondary text-sm"
            >
              Reset
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-aviation-text-secondary">Progress</span>
              <span className={getProgress(activeChecklistId).percentage === 100 ? 'text-aviation-success' : ''}>
                {getProgress(activeChecklistId).percentage}%
              </span>
            </div>
            <div className="h-2 bg-aviation-surface-light rounded-full overflow-hidden">
              <div
                className="h-full bg-aviation-accent transition-all duration-300"
                style={{ width: `${getProgress(activeChecklistId).percentage}%` }}
              />
            </div>
          </div>

          {/* Categories and Items */}
          <div className="space-y-8">
            {activeChecklist.categories.map((category, catIdx) => (
              <div key={catIdx}>
                {/* Category Header */}
                <div className="checklist-category text-aviation-accent">
                  {category.name}
                </div>
                
                {/* Category Context */}
                {category.context && (
                  <div className="checklist-context">
                    {category.context}
                  </div>
                )}
                
                {/* Items */}
                <div className="space-y-1">
                  {category.items.map((item, itemIdx) => {
                    const key = `${catIdx}-${itemIdx}`
                    const isChecked = checkedItems[key] || false
                    const isNext = nextUnchecked && 
                      nextUnchecked.categoryIndex === catIdx && 
                      nextUnchecked.itemIndex === itemIdx

                    return (
                      <ChecklistItem
                        key={key}
                        text={getItemText(item)}
                        note={getItemNote(item)}
                        isChecked={isChecked}
                        isNext={isNext}
                        onToggle={() => handleItemToggle(catIdx, itemIdx)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Completion Message */}
          {getProgress(activeChecklistId).percentage === 100 && (
            <div className="mt-6 p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-md text-center">
              <span className="text-emerald-300 font-medium">
                Checklist Complete
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Checklist
