const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { AppError } = require('../exceptions/AppError');
const { env } = require('../config/env');
const { hashPassword, verifyPassword } = require('../utils/passwordHasher');
const { withRequestAuditContext } = require('../utils/requestAuditContext');
class AuthService {
  constructor(db, googleClient = new OAuth2Client(env.googleClientId), auditService = null) { this.db = db; this.googleClient = googleClient; this.audit = auditService; }
  async auditEvent(actorUserId, action, entityId = null, metadata = {}) {
    if (this.audit) await this.audit.log(actorUserId, action, 'authentication', entityId, metadata);
  }
  hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
  publicUser(user) {
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
  async findAuthUserByEmail(email, db = this.db) {
    if (typeof db.users.findAuthByEmail === 'function') return db.users.findAuthByEmail(email);
    return db.users.findBy('email', email);
  }
  safeCompare(left, right) {
    const leftBuffer = Buffer.from(String(left || ''), 'utf8');
    const rightBuffer = Buffer.from(String(right || ''), 'utf8');
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }
  async createSession(user, db = this.db) {
    if (!user || user.active === false) throw new AppError('Account is not available', 401);
    const ttlMs = env.sessionTtlMinutes * 60 * 1000;
    const token = jwt.sign(
      { sid:crypto.randomUUID(), userId:user.id },
      env.sessionSecret,
      {
        algorithm:'HS256',
        audience:env.jwtAudience,
        expiresIn:`${env.sessionTtlMinutes}m`,
        issuer:env.jwtIssuer,
        subject:user.id,
      },
    );
    await db.sessions.create({ tokenHash: this.hashToken(token), userId: user.id, revoked:false, expiresAt: new Date(Date.now()+ttlMs).toISOString() });
    return token;
  }
  async verifyGoogleIdToken(idToken) {
    if (env.nodeEnv === 'test' && env.allowMockGoogleTokens) {
      const decoded = jwt.decode(idToken) || {};
      if (!decoded.sub || !decoded.email) throw new AppError('Invalid Google ID token', 401);
      if (decoded.aud && decoded.aud !== env.googleClientId) throw new AppError('Invalid Google audience', 401);
      if (decoded.email_verified === false) throw new AppError('Google email is not verified', 401, { code:'GOOGLE_EMAIL_NOT_VERIFIED' });
      return { googleSub: decoded.sub, email: decoded.email, name: decoded.name || decoded.email };
    }
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: env.googleClientId });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload?.email) throw new AppError('Invalid Google ID token', 401);
      if (payload.email_verified === false) throw new AppError('Google email is not verified', 401, { code:'GOOGLE_EMAIL_NOT_VERIFIED' });
      return { googleSub: payload.sub, email: payload.email, name: payload.name || payload.email };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid Google ID token', 401);
    }
  }
  async loginWithGoogle(idToken) {
    const profile = await this.verifyGoogleIdToken(idToken);
    const email = String(profile.email || '').trim().toLowerCase();
    let user = await this.db.users.findBy('googleSub', profile.googleSub);
    if (user) {
      if (String(user.email || '').trim().toLowerCase() !== email) {
        throw new AppError('Google email does not match the academy account', 409, { code:'GOOGLE_EMAIL_MISMATCH' });
      }
    } else {
      user = await this.db.users.findBy('email', email);
      if (!user) throw new AppError('Google account is not registered in the academy', 401, { code:'ACCOUNT_NOT_REGISTERED' });
      if (user.active === false) throw new AppError('Invalid email or password', 401);
      if (user.googleSub && user.googleSub !== profile.googleSub) throw new AppError('Google account is linked to a different profile', 409, { code:'GOOGLE_ACCOUNT_MISMATCH' });
      user = await this.db.users.update(user.id, { googleSub:profile.googleSub });
    }
    if (user.active === false) throw new AppError('Invalid email or password', 401);
    const token = await this.createSession(user);
    await this.auditEvent(user.id, 'AUTH_LOGIN_GOOGLE', user.id);
    return { token, user:this.publicUser(user) };
  }
  async loginWithPassword(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const authUser = await this.findAuthUserByEmail(normalizedEmail);
    if (authUser?.passwordHash && verifyPassword(password, authUser.passwordHash)) {
      if (authUser.active === false) throw new AppError('Invalid email or password', 401);
      const user = this.publicUser(await this.db.users.findById(authUser.id) || authUser);
      const token = await this.createSession(user);
      await this.auditEvent(user.id, 'AUTH_LOGIN_PASSWORD', user.id);
      return { token, user };
    }

    if (env.nodeEnv === 'test' && env.postmanLoginEnabled) {
      const expectedEmail = String(env.postmanLoginEmail || '').trim().toLowerCase();
      if (normalizedEmail === expectedEmail && this.safeCompare(password, env.postmanLoginPassword)) {
        const user = await this.db.users.findBy('email', normalizedEmail);
        if (!user || user.active === false) throw new AppError('Invalid email or password', 401);
        const token = await this.createSession(user);
        await this.auditEvent(user.id, 'AUTH_LOGIN_TEST_HELPER', user.id);
        return { token, user:this.publicUser(user) };
      }
    }

    throw new AppError('Invalid email or password', 401);
  }
  async changePassword(sessionUser, currentPassword, newPassword) {
    const authUser = await this.findAuthUserByEmail(sessionUser?.email);
    if (!authUser || authUser.active === false || !authUser.passwordHash) throw new AppError('Invalid email or password', 401);
    if (!verifyPassword(currentPassword, authUser.passwordHash)) throw new AppError('Current password is incorrect', 401);
    if (verifyPassword(newPassword, authUser.passwordHash)) throw new AppError('New password must be different from the current password', 422);

    const work = async (db) => {
      const current = await this.findAuthUserByEmail(sessionUser.email, db);
      if (!current || !verifyPassword(currentPassword, current.passwordHash)) throw new AppError('Current password is incorrect', 401);
      const sessions = await db.sessions.all();
      await Promise.all(sessions.filter((session) => session.userId === current.id && !session.revoked).map((session) => db.sessions.update(session.id, { revoked:true })));
      const updated = await db.users.update(current.id, {
        passwordHash:hashPassword(newPassword),
        mustChangePassword:false,
        passwordChangedAt:new Date().toISOString(),
      });
      const user = this.publicUser(updated);
      const token = await this.createSession(user, db);
      await db.auditLogs.create({
        actorUserId:user.id,
        action:'AUTH_PASSWORD_CHANGED',
        entity:'authentication',
        entityId:user.id,
        metadata:withRequestAuditContext({ allPreviousSessionsRevoked:true }),
      });
      return { user, token };
    };
    return this.db.transaction ? this.db.transaction(work) : work(this.db);
  }
  async revokeSessionsForUser(userId, db = this.db) {
    const sessions = await db.sessions.all();
    await Promise.all(
      sessions
        .filter((session) => session.userId === userId && !session.revoked)
        .map((session) => db.sessions.update(session.id, { revoked:true })),
    );
  }
  async resolveSession(token) {
    let claims;
    try {
      claims = jwt.verify(token, env.sessionSecret, {
        algorithms:['HS256'],
        audience:env.jwtAudience,
        issuer:env.jwtIssuer,
      });
    } catch {
      return null;
    }
    if (
      !claims
      || typeof claims.sid !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.sid)
      || typeof claims.userId !== 'string'
      || claims.sub !== claims.userId
      || !Number.isInteger(claims.iat)
      || !Number.isInteger(claims.exp)
    ) return null;
    const session = await this.db.sessions.findBy('tokenHash', this.hashToken(token));
    if (
      !session
      || session.revoked
      || session.userId !== claims.userId
      || Number.isNaN(Date.parse(session.expiresAt))
      || Date.parse(session.expiresAt) <= Date.now()
    ) return null;
    const user = await this.db.users.findById(session.userId);
    if (!user || user.active === false) {
      try { await this.db.sessions.update(session.id, { revoked:true }); } catch { /* Access still fails closed. */ }
      return null;
    }
    return this.publicUser(user);
  }
  async logout(token) {
    const session = await this.db.sessions.findBy('tokenHash', this.hashToken(token));
    if (session) {
      await this.db.sessions.update(session.id, { revoked:true });
      await this.auditEvent(session.userId, 'AUTH_LOGOUT', session.userId, { sessionId:session.id });
    }
  }
}
module.exports = { AuthService };
