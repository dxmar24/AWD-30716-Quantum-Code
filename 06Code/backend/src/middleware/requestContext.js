const crypto = require('crypto');
const { runWithRequestAuditContext } = require('../utils/requestAuditContext');

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requestContext(req, res, next) {
  const supplied = req.get('X-Request-ID');
  req.id = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  return runWithRequestAuditContext(req, next);
}

module.exports = { requestContext };
