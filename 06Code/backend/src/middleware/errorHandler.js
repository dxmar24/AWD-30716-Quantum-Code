const { ApiResponse } = require('../utils/ApiResponse');
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  if (status === 500) {
    const logRecord = {
      event:'request_failed',
      requestId:req.id || null,
      method:req.method,
      path:req.path,
      status,
      errorName:typeof err.name === 'string' ? err.name : 'Error',
      errorCode:typeof err.code === 'string' && /^[A-Z0-9_.-]{1,64}$/i.test(err.code) ? err.code : null,
    };
    console.error(JSON.stringify(logRecord)); // eslint-disable-line no-console
  }
  const details = status === 500 ? { requestId:req.id || null } : (err.details || null);
  return ApiResponse.error(res, message, status, details);
}
module.exports = { errorHandler };
