const jwt = require('jsonwebtoken');
const { AppError } = require('../exceptions/AppError');
const { env } = require('../config/env');
const { Roles } = require('../models/constants');
class AuthService {
  constructor(db) { this.db = db; }
  verifyGoogleIdToken(idToken) { const decoded = jwt.decode(idToken) || {}; if (!decoded.sub || !decoded.email) throw new AppError('Invalid Google ID token', 401); if (decoded.aud && decoded.aud !== env.googleClientId) throw new AppError('Invalid Google audience', 401); return { googleSub: decoded.sub, email: decoded.email, name: decoded.name || decoded.email }; }
  loginWithGoogle(idToken) { const profile = this.verifyGoogleIdToken(idToken); let user = this.db.users.findBy('googleSub', profile.googleSub) || this.db.users.findBy('email', profile.email); if (!user) user = this.db.users.create({ email: profile.email, name: profile.name, googleSub: profile.googleSub, role: Roles.STUDENT }); else this.db.users.update(user.id, { googleSub: profile.googleSub, name: profile.name }); const token = jwt.sign({ sid: crypto.randomUUID(), userId: user.id }, env.sessionSecret, { expiresIn: '2h' }); this.db.sessions.create({ token, userId: user.id, revoked:false, expiresAt: new Date(Date.now()+7200000).toISOString() }); return { token, user }; }
  resolveSession(token) { try { jwt.verify(token, env.sessionSecret); } catch { return null; } const session = this.db.sessions.findBy('token', token); if (!session || session.revoked || new Date(session.expiresAt) < new Date()) return null; return this.db.users.findById(session.userId); }
  logout(token) { const session = this.db.sessions.findBy('token', token); if (session) this.db.sessions.update(session.id, { revoked:true }); }
}
const crypto = require('crypto');
module.exports = { AuthService };
