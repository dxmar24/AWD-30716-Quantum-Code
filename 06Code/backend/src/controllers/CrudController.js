const { ApiResponse } = require('../utils/ApiResponse');
const { actorCacheScope, setMemoryCacheHeaders } = require('../services/CacheService');
const { sanitizeAuditValue } = require('../services/AuditService');

const repositoryKeys = {
  branches:'branches',
  students:'students',
  teachers:'teachers',
  'dance-categories':'danceCategories',
  'dance-styles':'danceStyles',
  'class-groups':'classGroups',
  'class-sessions':'classSessions',
  'academy-events':'academyEvents',
};

const cacheConfig = {
  branches:{ ttlSeconds:300, tags:['branches'] },
  'dance-categories':{ ttlSeconds:600, tags:['dance-categories'] },
  'dance-styles':{ ttlSeconds:600, tags:['dance-styles'] },
  'academy-events':{ ttlSeconds:60, tags:['academy-events'] },
};

const mutationTags = {
  branches:['branches', 'reports'],
  students:['students', 'reports'],
  teachers:['teachers', 'reports'],
  'dance-categories':['dance-categories'],
  'dance-styles':['dance-styles'],
  'class-groups':['class-groups', 'reports'],
  'class-sessions':['class-sessions', 'attendance', 'reports'],
  'academy-events':['academy-events', 'reports'],
  'student-payments':['student-payments', 'reports'],
};

class CrudController {
  constructor(repository, entityName, accessPolicy = null, cacheService = null, auditService = null, dbContext = null) {
    this.repository = repository;
    this.entityName = entityName;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
    this.auditService = auditService;
    this.dbContext = dbContext;
  }

  requestMetadata(req, metadata) {
    return sanitizeAuditValue({
      ...metadata,
      request:{
        requestId:req.id || req.headers?.['x-request-id'] || null,
        ip:req.ip || null,
        userAgent:req.get?.('user-agent') || null,
        method:req.method || null,
        path:req.originalUrl?.split('?')[0] || null,
      },
    });
  }

  policyFor(db) {
    return db && this.accessPolicy ? new this.accessPolicy.constructor(db) : this.accessPolicy;
  }

  repositoryFor(db) {
    return db?.[repositoryKeys[this.entityName]] || this.repository;
  }

  async mutate(work) {
    return this.dbContext?.transaction ? this.dbContext.transaction(work) : work(null);
  }

  index = async (req, res) => {
    const config = cacheConfig[this.entityName];
    const loader = async () => {
      const rows = await this.repository.all();
      return this.accessPolicy ? this.accessPolicy.filterList(req.sessionUser, this.entityName, rows) : rows;
    };

    if (this.cacheService && config) {
      const key = `crud:${this.entityName}:index:${actorCacheScope(req.sessionUser)}`;
      const result = await this.cacheService.remember(key, config.ttlSeconds, config.tags, loader);
      setMemoryCacheHeaders(res, result, key);
      return ApiResponse.success(res, result.value, `${this.entityName} list`);
    }

    res.set('X-Memory-Cache', 'BYPASS');
    const data = await loader();
    return ApiResponse.success(res, data, `${this.entityName} list`);
  };

  show = async (req, res) => {
    const row = await this.repository.findById(req.params.id);
    if (!row) return ApiResponse.error(res, `${this.entityName} not found`, 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanRead(req.sessionUser, this.entityName, row);
    return ApiResponse.success(res, row);
  };

  create = async (req, res) => {
    const row = await this.mutate(async (db) => {
      const policy = this.policyFor(db);
      if (policy) await policy.assertCanCreate(req.sessionUser, this.entityName, req.body);
      const created = await this.repositoryFor(db).create(req.body);
      if (db?.auditLogs) {
        await db.auditLogs.create({
          actorUserId:req.sessionUser?.id || null,
          action:'ENTITY_CREATED',
          entity:this.entityName,
          entityId:created.id,
          metadata:this.requestMetadata(req, { after:created }),
        });
      } else if (this.auditService) {
        await this.auditService.logRequest(req.sessionUser?.id, 'ENTITY_CREATED', this.entityName, created.id, req, { after:created });
      }
      return created;
    });
    if (this.cacheService) this.cacheService.invalidateTags(mutationTags[this.entityName] || [this.entityName]);
    return ApiResponse.success(res, row, `${this.entityName} created`, 201);
  };

  update = async (req, res) => {
    const row = await this.mutate(async (db) => {
      const repository = this.repositoryFor(db);
      const existing = await repository.findById(req.params.id);
      if (!existing) return null;
      const policy = this.policyFor(db);
      if (policy) await policy.assertCanUpdate(req.sessionUser, this.entityName, existing, req.body);
      const updated = await repository.update(req.params.id, req.body);
      if (updated && db?.auditLogs) {
        await db.auditLogs.create({
          actorUserId:req.sessionUser?.id || null,
          action:'ENTITY_UPDATED',
          entity:this.entityName,
          entityId:updated.id,
          metadata:this.requestMetadata(req, { before:existing, after:updated }),
        });
      } else if (updated && this.auditService) {
        await this.auditService.logRequest(req.sessionUser?.id, 'ENTITY_UPDATED', this.entityName, updated.id, req, { before:existing, after:updated });
      }
      return updated;
    });
    if (this.cacheService && row) this.cacheService.invalidateTags(mutationTags[this.entityName] || [this.entityName]);
    return row ? ApiResponse.success(res, row, `${this.entityName} updated`) : ApiResponse.error(res, `${this.entityName} not found`, 404);
  };
}

module.exports = { CrudController };
