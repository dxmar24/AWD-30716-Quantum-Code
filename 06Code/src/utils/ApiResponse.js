class ApiResponse {
  static success(res, data = null, message = 'OK', status = 200) { return res.status(status).json({ success: true, message, data }); }
  static error(res, message, status = 500, details = null) { return res.status(status).json({ success: false, message, details }); }
}
module.exports = { ApiResponse };
