const { AsyncLocalStorage } = require('async_hooks');

const requestStorage = new AsyncLocalStorage();

function bounded(value, maxLength) {
  return typeof value === 'string' && value ? value.slice(0, maxLength) : null;
}

function buildRequestAuditContext(req) {
  return Object.freeze({
    requestId:bounded(req?.id || req?.headers?.['x-request-id'], 128),
    ip:bounded(req?.ip, 64),
    userAgent:bounded(req?.get?.('user-agent'), 512),
    method:bounded(req?.method, 16),
    path:bounded(req?.originalUrl?.split('?')[0], 512),
  });
}

function runWithRequestAuditContext(req, work) {
  return requestStorage.run(buildRequestAuditContext(req), work);
}

function currentRequestAuditContext() {
  return requestStorage.getStore() || null;
}

function withRequestAuditContext(metadata = {}) {
  const request = currentRequestAuditContext();
  return request ? { ...metadata, request } : metadata;
}

module.exports = {
  buildRequestAuditContext,
  currentRequestAuditContext,
  runWithRequestAuditContext,
  withRequestAuditContext,
};
