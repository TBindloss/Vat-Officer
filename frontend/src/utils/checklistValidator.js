/**
 * Checklist JSON Validator
 * Performs lenient validation with sensible defaults for missing/invalid fields.
 */

/**
 * Validate and normalize a checklist JSON object.
 * Uses lenient validation - fills in defaults for missing fields.
 * 
 * @param {object} data - Raw JSON data from uploaded file
 * @returns {{ valid: boolean, checklist: object|null, warnings: string[], errors: string[] }}
 */
export function validateChecklist(data) {
  const warnings = []
  const errors = []

  // Must be an object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('Checklist must be a JSON object')
    return { valid: false, checklist: null, warnings, errors }
  }

  // Build normalized checklist with defaults
  const checklist = {
    title: '',
    description: '',
    categories: []
  }

  // Title (optional, default to "Untitled Checklist")
  if (data.title && typeof data.title === 'string') {
    checklist.title = sanitizeString(data.title, 100)
  } else {
    checklist.title = 'Untitled Checklist'
    if (data.title !== undefined) {
      warnings.push('Invalid title - using "Untitled Checklist"')
    }
  }

  // Description (optional, default to empty string)
  if (data.description && typeof data.description === 'string') {
    checklist.description = sanitizeString(data.description, 500)
  } else {
    checklist.description = ''
    if (data.description !== undefined && data.description !== '') {
      warnings.push('Invalid description - using empty string')
    }
  }

  // Categories (required, must be array)
  if (!data.categories || !Array.isArray(data.categories)) {
    errors.push('Checklist must have a "categories" array')
    return { valid: false, checklist: null, warnings, errors }
  }

  if (data.categories.length === 0) {
    errors.push('Checklist must have at least one category')
    return { valid: false, checklist: null, warnings, errors }
  }

  // Process each category
  for (let i = 0; i < data.categories.length; i++) {
    const category = data.categories[i]
    
    if (!category || typeof category !== 'object') {
      warnings.push(`Category ${i + 1} is invalid - skipping`)
      continue
    }

    const normalizedCategory = {
      name: '',
      context: '',
      items: []
    }

    // Category name (required)
    if (category.name && typeof category.name === 'string') {
      normalizedCategory.name = sanitizeString(category.name, 100)
    } else {
      normalizedCategory.name = `Category ${i + 1}`
      warnings.push(`Category ${i + 1} missing name - using default`)
    }

    // Category context (optional)
    if (category.context && typeof category.context === 'string') {
      normalizedCategory.context = sanitizeString(category.context, 200)
    }

    // Category items (required, must be array)
    if (!category.items || !Array.isArray(category.items)) {
      warnings.push(`Category "${normalizedCategory.name}" has no items - skipping`)
      continue
    }

    // Process items
    for (let j = 0; j < category.items.length; j++) {
      const item = category.items[j]
      
      if (typeof item === 'string' && item.trim()) {
        normalizedCategory.items.push(sanitizeString(item, 300))
      } else if (typeof item === 'object' && item !== null) {
        // Support object format: { text: "...", note: "..." }
        if (item.text && typeof item.text === 'string') {
          const normalizedItem = {
            text: sanitizeString(item.text, 300),
            note: item.note && typeof item.note === 'string' 
              ? sanitizeString(item.note, 200) 
              : ''
          }
          normalizedCategory.items.push(normalizedItem)
        } else {
          warnings.push(`Item ${j + 1} in "${normalizedCategory.name}" is invalid - skipping`)
        }
      } else {
        warnings.push(`Item ${j + 1} in "${normalizedCategory.name}" is invalid - skipping`)
      }
    }

    // Only add category if it has items
    if (normalizedCategory.items.length > 0) {
      checklist.categories.push(normalizedCategory)
    } else {
      warnings.push(`Category "${normalizedCategory.name}" has no valid items - skipping`)
    }
  }

  // Final validation
  if (checklist.categories.length === 0) {
    errors.push('No valid categories with items found')
    return { valid: false, checklist: null, warnings, errors }
  }

  return { valid: true, checklist, warnings, errors }
}

/**
 * Sanitize a string by trimming and limiting length.
 * Also removes potentially dangerous characters.
 * 
 * @param {string} str - String to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return ''
  
  // Trim whitespace
  let sanitized = str.trim()
  
  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  
  return sanitized
}

/**
 * Parse a JSON file and validate as checklist.
 * 
 * @param {File} file - File object from input
 * @returns {Promise<{ valid: boolean, checklist: object|null, warnings: string[], errors: string[] }>}
 */
export async function parseChecklistFile(file) {
  const errors = []
  const warnings = []

  // Validate file type
  if (!file.name.endsWith('.json')) {
    errors.push('File must be a .json file')
    return { valid: false, checklist: null, warnings, errors }
  }

  // Validate file size (max 1MB)
  const MAX_SIZE = 1024 * 1024 // 1MB
  if (file.size > MAX_SIZE) {
    errors.push('File size exceeds 1MB limit')
    return { valid: false, checklist: null, warnings, errors }
  }

  try {
    const text = await file.text()
    const data = JSON.parse(text)
    return validateChecklist(data)
  } catch (parseError) {
    if (parseError instanceof SyntaxError) {
      errors.push(`Invalid JSON: ${parseError.message}`)
    } else {
      errors.push(`Error reading file: ${parseError.message}`)
    }
    return { valid: false, checklist: null, warnings, errors }
  }
}

/**
 * Get the total number of items in a checklist.
 * 
 * @param {object} checklist - Validated checklist object
 * @returns {number} - Total item count
 */
export function getChecklistItemCount(checklist) {
  if (!checklist || !checklist.categories) return 0
  return checklist.categories.reduce((total, cat) => total + cat.items.length, 0)
}

/**
 * Get item text from an item (handles both string and object formats).
 * 
 * @param {string|object} item - Checklist item
 * @returns {string} - Item text
 */
export function getItemText(item) {
  if (typeof item === 'string') return item
  if (typeof item === 'object' && item !== null) return item.text || ''
  return ''
}

/**
 * Get item note from an item (only for object format).
 * 
 * @param {string|object} item - Checklist item
 * @returns {string} - Item note or empty string
 */
export function getItemNote(item) {
  if (typeof item === 'object' && item !== null) return item.note || ''
  return ''
}

export default validateChecklist
