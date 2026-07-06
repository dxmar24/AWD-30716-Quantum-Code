const { ApiResponse } = require('../utils/ApiResponse');

class CrudController {
  constructor(repository, entityName, accessPolicy = null) {
    this.repository = repository;
    this.entityName = entityName;
    this.accessPolicy = accessPolicy;
  }

  index = async (req, res) => {
    const rows = await this.repository.all();
    const data = this.accessPolicy ? await this.accessPolicy.filterList(req.sessionUser, this.entityName, rows) : rows;
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
    return ApiResponse.success(res, await this.repository.create(req.body), `${this.entityName} created`, 201);
  };

  update = async (req, res) => {
    const existing = await this.repository.findById(req.params.id);
    if (!existing) return ApiResponse.error(res, `${this.entityName} not found`, 404);
    if (this.accessPolicy) await this.accessPolicy.assertCanUpdate(req.sessionUser, this.entityName, existing, req.body);
    const row = await this.repository.update(req.params.id, req.body);
    return row ? ApiResponse.success(res, row, `${this.entityName} updated`) : ApiResponse.error(res, `${this.entityName} not found`, 404);
  };
}

module.exports = { CrudController };
