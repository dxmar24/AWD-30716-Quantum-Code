const { ApiResponse } = require('../utils/ApiResponse');

function httpsOnly(enabled) {
  return (req, res, next) => {
    if (!enabled || req.secure) return next();
    res.setHeader('Cache-Control', 'no-store');
    return ApiResponse.error(
      res,
      'HTTPS is required',
      426,
      { code:'HTTPS_REQUIRED', requestId:req.id },
    );
  };
}

module.exports = { httpsOnly };
