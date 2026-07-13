const crypto = require('crypto');
const { ApiResponse } = require('../utils/ApiResponse');
const { env } = require('../config/env');
const { extractSessionToken } = require('../middleware/sessionResolver');
class AuthController { constructor(authService) { this.authService = authService; }
  config = (req, res) => ApiResponse.success(res, { googleClientId: env.googleClientId }, 'Auth configuration');
  cookieOptions(httpOnly) {
    return {
      httpOnly,
      maxAge:env.sessionTtlMinutes * 60 * 1000,
      path:'/',
      priority:'high',
      sameSite:'strict',
      secure:env.secureCookies,
    };
  }
  clearCookieOptions(httpOnly) {
    const { maxAge, ...options } = this.cookieOptions(httpOnly);
    return options;
  }
  sendSessionResponse(res, token, user, message = 'Login successful') {
    const csrfToken = crypto.randomBytes(32).toString('base64url');
    res.cookie('alc_session', token, this.cookieOptions(true));
    res.cookie('alc_csrf', csrfToken, this.cookieOptions(false));
    const data = {
      expiresInMinutes:env.sessionTtlMinutes,
      user:{ id:user.id, email:user.email, name:user.name, role:user.role, mustChangePassword:Boolean(user.mustChangePassword) },
    };
    if (env.exposeSessionToken) {
      data.sessionToken = token;
      data.tokenType = 'Bearer';
    }
    return ApiResponse.success(res, data, message);
  }
  login = async (req, res, next) => { try { const { token, user } = await this.authService.loginWithGoogle(req.body.idToken); return this.sendSessionResponse(res, token, user); } catch (e) { return next(e); } };
  passwordLogin = async (req, res, next) => { try { const { token, user } = await this.authService.loginWithPassword(req.body.email, req.body.password); return this.sendSessionResponse(res, token, user); } catch (e) { return next(e); } };
  changePassword = async (req, res, next) => { try { const { user, token } = await this.authService.changePassword(req.sessionUser, req.body.currentPassword, req.body.newPassword); return this.sendSessionResponse(res, token, user, 'Password changed'); } catch (e) { return next(e); } };
  me = (req, res) => ApiResponse.success(res, { user:req.sessionUser });
  logout = async (req, res) => { const { token } = extractSessionToken(req); if (token) await this.authService.logout(token); res.clearCookie('alc_session', this.clearCookieOptions(true)); res.clearCookie('alc_csrf', this.clearCookieOptions(false)); return ApiResponse.success(res, null, 'Logout successful'); };
}
module.exports = { AuthController };
