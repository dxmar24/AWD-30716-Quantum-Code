const { withRequestAuditContext } = require('../utils/requestAuditContext');

const SENSITIVE_KEY = /(password|secret|token|authorization|cookie|credential|hash)/i;
const MAX_STRING_LENGTH = 2000;
const MAX_DEPTH = 6;

function sanitizeAuditValue(value, key = '', depth = 0, seen = new WeakSet()) {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) return '[IMAGE_DATA_REDACTED]';
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeAuditValue(item, key, depth + 1, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([nestedKey, nestedValue]) => [
      nestedKey,
      sanitizeAuditValue(nestedValue, nestedKey, depth + 1, seen),
    ]),
  );
}

class AuditService {
  constructor(db) {
    this.db = db;
  }

  async log(actorUserId, action, entity, entityId, metadata = {}) {
    return this.db.auditLogs.create({
      actorUserId:actorUserId || null,
      action:String(action || 'UNKNOWN').slice(0, 120),
      entity:String(entity || 'unknown').slice(0, 120),
      entityId:entityId || null,
      metadata:sanitizeAuditValue(withRequestAuditContext(metadata)),
    });
  }

  async logRequest(actorUserId, action, entity, entityId, req, metadata = {}) {
    return this.log(actorUserId, action, entity, entityId, {
      ...metadata,
      request:{
        requestId:req?.id || req?.headers?.['x-request-id'] || null,
        ip:req?.ip || null,
        userAgent:req?.get?.('user-agent') || null,
        method:req?.method || null,
        path:req?.originalUrl?.split('?')[0] || null,
      },
    });
  }
}

module.exports = { AuditService, sanitizeAuditValue };
