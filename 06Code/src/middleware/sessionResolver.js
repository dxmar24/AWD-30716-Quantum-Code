function readBearerToken(authorization) {
  if (typeof authorization !== 'string') return null;
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : null;
}

function extractSessionToken(req) {
  const bearerToken = readBearerToken(req.headers.authorization);
  if (bearerToken) return { token:bearerToken, transport:'bearer' };
  const cookieToken = req.cookies?.alc_session;
  return cookieToken ? { token:cookieToken, transport:'cookie' } : { token:null, transport:null };
}

function sessionResolver(authService) {
  return async (req, res, next) => {
    try {
      const { token, transport } = extractSessionToken(req);
      req.authTransport = transport;
      req.sessionToken = token;
      req.sessionUser = token ? await authService.resolveSession(token) : null;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { extractSessionToken, readBearerToken, sessionResolver };
