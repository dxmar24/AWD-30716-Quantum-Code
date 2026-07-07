const { AppError } = require('../exceptions/AppError');
function requireAuth(req, res, next) { if (!req.sessionUser) return next(new AppError('Authentication required', 401)); return next(); }
function requirePasswordReady(req, res, next) {
  if (req.sessionUser?.mustChangePassword) {
    return next(new AppError('Password change required', 403, { code:'PASSWORD_CHANGE_REQUIRED' }));
  }
  return next();
}
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.sessionUser) return next(new AppError('Authentication required', 401));
    if (req.sessionUser.mustChangePassword) return next(new AppError('Password change required', 403, { code:'PASSWORD_CHANGE_REQUIRED' }));
    if (!roles.includes(req.sessionUser.role)) return next(new AppError('Insufficient permissions', 403));
    return next();
  };
}
module.exports = { requireAuth, requirePasswordReady, allowRoles };
