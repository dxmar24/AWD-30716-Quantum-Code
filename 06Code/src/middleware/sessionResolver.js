function sessionResolver(authService) { return async (req, res, next) => { try { const token = req.cookies?.alc_session || req.headers.authorization?.replace('Bearer ', ''); req.sessionUser = token ? await authService.resolveSession(token) : null; next(); } catch (error) { next(error); } }; }
module.exports = { sessionResolver };
