class AuditService { constructor(db) { this.db = db; } async log(actorUserId, action, entity, entityId, metadata = {}) { return this.db.auditLogs.create({ actorUserId, action, entity, entityId, metadata }); } }
module.exports = { AuditService };
