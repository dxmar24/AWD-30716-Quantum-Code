const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { AppError } = require('../exceptions/AppError');
const { env } = require('../config/env');
const { Roles } = require('../models/constants');
class AuthService {
  constructor(db, googleClient = new OAuth2Client(env.googleClientId)) { this.db = db; this.googleClient = googleClient; }
  hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
  safeCompare(left, right) {
    const leftBuffer = Buffer.from(String(left || ''), 'utf8');
    const rightBuffer = Buffer.from(String(right || ''), 'utf8');
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }
  async createSession(user) {
    const ttlMs = env.sessionTtlMinutes * 60 * 1000;
    const token = jwt.sign({ sid: crypto.randomUUID(), userId: user.id }, env.sessionSecret, { expiresIn: `${env.sessionTtlMinutes}m` });
    await this.db.sessions.create({ tokenHash: this.hashToken(token), userId: user.id, revoked:false, expiresAt: new Date(Date.now()+ttlMs).toISOString() });
    return token;
  }
  async verifyGoogleIdToken(idToken) {
    if (env.allowMockGoogleTokens) {
      const decoded = jwt.decode(idToken) || {};
      if (!decoded.sub || !decoded.email) throw new AppError('Invalid Google ID token', 401);
      if (decoded.aud && decoded.aud !== env.googleClientId) throw new AppError('Invalid Google audience', 401);
      return { googleSub: decoded.sub, email: decoded.email, name: decoded.name || decoded.email };
    }
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: env.googleClientId });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload?.email) throw new AppError('Invalid Google ID token', 401);
      return { googleSub: payload.sub, email: payload.email, name: payload.name || payload.email };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid Google ID token', 401);
    }
  }
  async loginWithGoogle(idToken) {
    const profile = await this.verifyGoogleIdToken(idToken);
    let user = await this.db.users.findBy('googleSub', profile.googleSub) || await this.db.users.findBy('email', profile.email);
    if (!user) user = await this.db.users.create({ email: profile.email, name: profile.name, googleSub: profile.googleSub, role: Roles.STUDENT });
    else user = await this.db.users.update(user.id, { googleSub: profile.googleSub, name: profile.name });
    const token = await this.createSession(user);
    return { token, user };
  }
  async loginWithPassword(email, password) {
    if (!env.postmanLoginEnabled) throw new AppError('Postman password login is disabled', 403);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const expectedEmail = String(env.postmanLoginEmail || '').trim().toLowerCase();
    if (normalizedEmail !== expectedEmail || !this.safeCompare(password, env.postmanLoginPassword)) {
      throw new AppError('Invalid email or password', 401);
    }
    const user = await this.db.users.findBy('email', normalizedEmail);
    if (!user || user.active === false) throw new AppError('Invalid email or password', 401);
    const token = await this.createSession(user);
    return { token, user };
  }
  async resolveSession(token) {
    try { jwt.verify(token, env.sessionSecret); } catch { return null; }
    const session = await this.db.sessions.findBy('tokenHash', this.hashToken(token));
    if (!session || session.revoked || new Date(session.expiresAt) < new Date()) return null;
    return this.db.users.findById(session.userId);
  }
  async logout(token) {
    const session = await this.db.sessions.findBy('tokenHash', this.hashToken(token));
    if (session) await this.db.sessions.update(session.id, { revoked:true });
  }
}
module.exports = { AuthService };
