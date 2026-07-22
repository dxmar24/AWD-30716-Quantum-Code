const { ApiResponse } = require('../utils/ApiResponse');
const { AppError } = require('../exceptions/AppError');
const { sanitizeAuditValue } = require('../services/AuditService');

function parseDate(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(`Invalid ${field}`, 422);
  return date;
}

class AuditController {
  constructor(db) {
    this.db = db;
  }

  index = async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const from = parseDate(req.query.from, 'audit start date');
    const to = parseDate(req.query.to, 'audit end date');
    if (from && to && from > to) throw new AppError('Audit start date must be before end date', 422);

    const filtered = (await this.db.auditLogs.all())
      .filter((row) => !req.query.action || row.action === req.query.action)
      .filter((row) => !req.query.entity || row.entity === req.query.entity)
      .filter((row) => !req.query.actorUserId || row.actorUserId === req.query.actorUserId)
      .filter((row) => {
        const createdAt = new Date(row.createdAt || 0);
        return (!from || createdAt >= from) && (!to || createdAt <= to);
      })
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
    const users = await this.db.users.all();
    const usersById = new Map(users.map((user) => [user.id, user]));
    const page = filtered.slice(offset, offset + limit).map((row) => {
      const actor = usersById.get(row.actorUserId);
      return {
        ...row,
        actorId:row.actorUserId || null,
        actorName:actor?.name || null,
        actorEmail:actor?.email || null,
        entityType:row.entity,
        metadata:sanitizeAuditValue(row.metadata || {}),
      };
    });

    res.set('X-Total-Count', String(filtered.length));
    res.set('X-Result-Limit', String(limit));
    res.set('X-Result-Offset', String(offset));
    return ApiResponse.success(res, page, 'Audit logs');
  };
}

module.exports = { AuditController };
