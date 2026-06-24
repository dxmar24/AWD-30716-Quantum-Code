function privatePageGuard(req, res, next) {
  if (!req.sessionUser) return res.redirect(302, '/index.html?session=expired');
  return next();
}

module.exports = { privatePageGuard };
