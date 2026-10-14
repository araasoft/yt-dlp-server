// Pagination configuration and utilities
export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1
}

/**
 * Paginate array data with metadata
 * @param {Array} data - Full dataset to paginate
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} Paginated data with pagination metadata
 */
export const paginateArray = (data = [], page = 1, limit = 20) => {
  const pageNum = Math.max(1, parseInt(page) || PAGINATION_DEFAULTS.DEFAULT_PAGE)
  const limitNum = Math.min(
    PAGINATION_DEFAULTS.MAX_LIMIT,
    Math.max(PAGINATION_DEFAULTS.MIN_LIMIT, parseInt(limit) || PAGINATION_DEFAULTS.DEFAULT_LIMIT)
  )
  
  const total = data.length
  const totalPages = Math.ceil(total / limitNum)
  const startIdx = (pageNum - 1) * limitNum
  const endIdx = startIdx + limitNum
  
  return {
    data: data.slice(startIdx, endIdx),
    pagination: {
      currentPage: pageNum,
      pageSize: limitNum,
      totalItems: total,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPreviousPage: pageNum > 1,
      startIndex: Math.min(startIdx + 1, total),
      endIndex: Math.min(endIdx, total)
    }
  }
}

/**
 * Cache wrapper for expensive operations
 * @param {Function} fn - Async function to cache
 * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
 * @returns {Function} Cached function
 */
export const createCache = (ttl = 5 * 60 * 1000) => {
  const cache = new Map()
  
  return async (key, fn) => {
    if (cache.has(key)) {
      const { data, timestamp } = cache.get(key)
      if (Date.now() - timestamp < ttl) {
        return data
      }
    }
    
    const data = await fn()
    cache.set(key, { data, timestamp: Date.now() })
    return data
  }
}

/**
 * Validate pagination parameters
 * @param {Object} query - Request query object
 * @returns {Object} Validated parameters
 */
export const validatePaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || PAGINATION_DEFAULTS.DEFAULT_PAGE)
  const limit = Math.min(
    PAGINATION_DEFAULTS.MAX_LIMIT,
    Math.max(PAGINATION_DEFAULTS.MIN_LIMIT, parseInt(query.limit) || PAGINATION_DEFAULTS.DEFAULT_LIMIT)
  )
  
  return { page, limit }
}

/**
 * Format API response with consistent structure
 * @param {Array|Object} data - Response data
 * @param {Object} pagination - Pagination metadata (optional)
 * @param {Object} meta - Additional metadata (optional)
 * @returns {Object} Formatted response
 */
export const formatResponse = (data, pagination = null, meta = {}) => {
  const response = {
    status: 'success',
    data
  }
  
  if (pagination) {
    response.pagination = pagination
  }
  
  if (Object.keys(meta).length > 0) {
    response.meta = meta
  }
  return response
}

/**
 * Format error response
 * @param {string} message - Error message
 * @param {number} code - HTTP status code
 * @param {Object} details - Additional error details
 * @returns {Object} Formatted error response
 */
export const formatError = (message, code = 500, details = {}) => {
  return {
    status: 'error',
    code,
    message,
    ...(Object.keys(details).length > 0 && { details })
  }
}

/**
 * Sort array of objects by field
 * @param {Array} data - Array to sort
 * @param {string} field - Field to sort by
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} Sorted array
 */
export const sortBy = (data, field, order = 'asc') => {
  const sorted = [...data].sort((a, b) => {
    const aVal = a[field]
    const bVal = b[field]
    
    if (typeof aVal === 'string') {
      return order === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }
    
    return order === 'asc' ? aVal - bVal : bVal - aVal
  })
  
  return sorted
}

/**
 * Filter array by multiple criteria
 * @param {Array} data - Array to filter
 * @param {Object} filters - Filter object { field: value }
 * @returns {Array} Filtered array
 */
export const filterBy = (data, filters) => {
  return data.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (value === undefined || value === null) return true
      return item[key] === value || 
             (typeof item[key] === 'string' && item[key].toLowerCase().includes(String(value).toLowerCase()))
    })
  })
}


export const cacheControl = (maxAge = 300) => {
  return (req, res, next) => {
    res.header('Cache-Control', `private, max-age=${maxAge}`)
    next()
  }
}