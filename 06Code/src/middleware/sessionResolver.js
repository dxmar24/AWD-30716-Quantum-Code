function sessionResolver(authService) { return (req, res, next) => { const token = req.cookies?.alc_session || req.headers.authorization?.replace('Bearer ', ''); req.sessionUser = token ? authService.resolveSession(token) : null; next(); }; }
module.exports = { sessionResolver };
