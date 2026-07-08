const { ApiResponse } = require('../utils/ApiResponse');
const { actorCacheScope, setMemoryCacheHeaders } = require('../services/CacheService');

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
  constructor(repository, entityName, accessPolicy = null, cacheService = null) {
    this.repository = repository;
    this.entityName = entityName;
    this.accessPolicy = accessPolicy;
    this.cacheService = cacheService;
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
    if (this.accessPolicy) await this.accessPolicy.assertCanCreate(req.sessionUser, this.entityName, req.body);
    const row = await this.repository.create(req.body);
    if (this.cacheService) this.cacheService.invalidateTags(mutationTags[this.entityName] || [this.entityName]);
    return ApiResponse.success(res, row, `${this.entityName} created`, 201);
  };

  update = async (req, res) => {
    const existing = await this.repository.findById(req.params.id);
    if (!existing) return ApiResponse.error(res, `${this.entityName} not found`, 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(req.sessionUser, this.entityName, existing, req.body);
    const row = await this.repository.update(req.params.id, req.body);
    if (this.cacheService && row) this.cacheService.invalidateTags(mutationTags[this.entityName] || [this.entityName]);
    return row ? ApiResponse.success(res, row, `${this.entityName} updated`) : ApiResponse.error(res, `${this.entityName} not found`, 404);
  };
}

module.exports = { CrudController };
