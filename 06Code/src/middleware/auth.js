const { AppError } = require('../exceptions/AppError');
function requireAuth(req, res, next) { if (!req.sessionUser) return next(new AppError('Authentication required', 401)); return next(); }
function allowRoles(...roles) { return (req, res, next) => { if (!req.sessionUser) return next(new AppError('Authentication required', 401)); if (!roles.includes(req.sessionUser.role)) return next(new AppError('Insufficient permissions', 403)); return next(); }; }
module.exports = { requireAuth, allowRoles };
