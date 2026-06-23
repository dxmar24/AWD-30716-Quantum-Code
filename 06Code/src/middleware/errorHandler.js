const { ApiResponse } = require('../utils/ApiResponse');
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  return ApiResponse.error(res, message, status, err.details || null);
}
module.exports = { errorHandler };
