const { AppError } = require('../exceptions/AppError');
function validate(schema, source = 'body') { return (req, res, next) => { const result = schema.safeParse(req[source]); if (!result.success) return next(new AppError('Validation failed', 422, result.error.flatten())); req[source] = result.data; return next(); }; }
module.exports = { validate };
