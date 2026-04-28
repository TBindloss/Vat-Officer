import React from 'react'

/**
 * Individual checklist item component with aviation-style appearance.
 */
function ChecklistItem({ text, note, isChecked, isNext, onToggle }) {
  return (
    <div
      className={`flex items-start py-2 px-3 rounded cursor-pointer transition-all ${
        isNext && !isChecked ? 'highlight-next' : ''
      } ${isChecked ? 'opacity-60' : ''}`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={isChecked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      {/* Checkbox */}
      <div className={`flex-shrink-0 w-5 h-5 mt-0.5 mr-3 border-2 rounded transition-colors ${
        isChecked 
          ? 'bg-aviation-success border-aviation-success' 
          : 'border-aviation-border hover:border-aviation-text-secondary'
      }`}>
        {isChecked && (
          <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Item Content */}
      <div className="flex-1">
        <span className={`checklist-item ${isChecked ? 'item-completed' : ''}`}>
          {text}
        </span>
        {note && (
          <span className="block text-xs text-aviation-text-secondary mt-0.5 italic">
            {note}
          </span>
        )}
      </div>

      {/* Next indicator */}
      {isNext && !isChecked && (
        <div className="flex-shrink-0 ml-2">
          <span className="text-xs text-aviation-highlight-border font-medium">NEXT</span>
        </div>
      )}
    </div>
  )
}

export default ChecklistItem
