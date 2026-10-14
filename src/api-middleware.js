import { formatError } from './pagination-utils.js'
import { createRateLimiter as _createRateLimiter } from './security.js'

/**
 * Validate pagination query parameters
 */
export const paginationValidator = (req, res, next) => {
  const { page, limit } = req.query
  
  if (page && isNaN(parseInt(page))) {
    return res.status(400).json(formatError('Invalid page parameter', 400, {
      field: 'page',
      value: page,
      expected: 'positive integer'
    }))
  }
  
  if (limit && isNaN(parseInt(limit))) {
    return res.status(400).json(formatError('Invalid limit parameter', 400, {
      field: 'limit',
      value: limit,
      expected: 'positive integer'
    }))
  }
  
  next()
}

/**
 * Validate search query parameter
 */
export const searchValidator = (req, res, next) => {
  const { q } = req.query
  
  if (typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json(formatError(
      'Search query is required',
      400,
      { parameter: 'q', example: '?q=song+name' }
    ))
  }
  
  if (q.length > 100) {
    return res.status(400).json(formatError(
      'Search query is too long',
      400,
      { maxLength: 100, provided: q.length }
    ))
  }
  
  next()
}

/**
 * Validate resource ID parameter
 */
export const idValidator = (req, res, next) => {
  const { id } = req.params
  
  if (!id || id.trim() === '' || id.length > 128) {
    return res.status(400).json(formatError('Resource ID is invalid', 400))
  }
  
  next()
}

/**
 * Global error handler
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500
  if (statusCode >= 500) console.error('Error:', err)
  if (res.headersSent) return next(err)
  
  // Never leak internals (stack traces, library messages) on 5xx
  const message = statusCode >= 500
    ? 'Internal server error'
    : statusCode === 413 ? 'Payload too large'
    : err.type === 'entity.parse.failed' ? 'Invalid JSON body'
    : err.expose ? err.message : 'Bad request'
  
  res.status(statusCode).json(formatError(message, statusCode))
}

/**
 * Not found handler
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json(formatError(
    'Resource not found',
    404,
    { path: req.path, method: req.method }
  ))
}

/**
 * Request logging middleware
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`)
  })
  
  next()
}

/**
 * Rate limiting middleware (fixed window, bounded memory).
 * Kept for backwards compatibility; implementation lives in lib/security.js
 */
export const createRateLimiter = (windowMs = 60000, maxRequests = 100) =>
  _createRateLimiter({ windowMs, max: maxRequests })

/**
 * CORS middleware
 */
export const corsMiddleware = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  
  next()
}

/**
 * Cache control headers
 */
export const cacheControl = (maxAge = 300) => {
  return (req, res, next) => {
    res.header('Cache-Control', `private, max-age=${maxAge}`)
    next()
  }
}
