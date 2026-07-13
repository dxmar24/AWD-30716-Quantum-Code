const crypto = require('crypto');
const { ApiResponse } = require('../utils/ApiResponse');
const { readBearerToken } = require('./sessionResolver');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function csrfProtection({ enabled, allowedOrigins }) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    if (!enabled || SAFE_METHODS.has(req.method)) return next();
    if (readBearerToken(req.headers.authorization)) return next();
    if (!req.cookies?.alc_session) return next();

    const origin = req.get('Origin');
    if (!origin || !allowed.has(origin)) {
      return ApiResponse.error(res, 'Request origin is not allowed', 403, {
        code:'CSRF_ORIGIN_REJECTED',
        requestId:req.id,
      });
    }

    if (!safeEqual(req.cookies.alc_csrf, req.get('X-CSRF-Token'))) {
      return ApiResponse.error(res, 'CSRF token is invalid', 403, {
        code:'CSRF_TOKEN_INVALID',
        requestId:req.id,
      });
    }
    return next();
  };
}

module.exports = { csrfProtection, safeEqual };
