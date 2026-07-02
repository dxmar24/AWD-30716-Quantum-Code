const { ApiResponse } = require('../utils/ApiResponse');
const { env } = require('../config/env');
class AuthController { constructor(authService) { this.authService = authService; }
  config = (req, res) => ApiResponse.success(res, { googleClientId: env.googleClientId }, 'Auth configuration');
  sendLoginResponse(res, token, user) {
    res.cookie('alc_session', token, { httpOnly:true, secure:process.env.NODE_ENV === 'production', sameSite:'strict', maxAge: env.sessionTtlMinutes * 60 * 1000 });
    return ApiResponse.success(res, { sessionToken:token, tokenType:'Bearer', expiresInMinutes:env.sessionTtlMinutes, user:{ id:user.id, email:user.email, name:user.name, role:user.role } }, 'Login successful');
  }
  login = async (req, res, next) => { try { const { token, user } = await this.authService.loginWithGoogle(req.body.idToken); return this.sendLoginResponse(res, token, user); } catch (e) { return next(e); } };
  passwordLogin = async (req, res, next) => { try { const { token, user } = await this.authService.loginWithPassword(req.body.email, req.body.password); return this.sendLoginResponse(res, token, user); } catch (e) { return next(e); } };
  me = (req, res) => ApiResponse.success(res, { user:req.sessionUser });
  logout = async (req, res) => { const token = req.cookies?.alc_session || req.headers.authorization?.replace('Bearer ', ''); if (token) await this.authService.logout(token); res.clearCookie('alc_session', { httpOnly:true, secure:process.env.NODE_ENV === 'production', sameSite:'strict' }); return ApiResponse.success(res, null, 'Logout successful'); };
}
module.exports = { AuthController };
