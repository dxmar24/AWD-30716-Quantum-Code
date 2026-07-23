const { ApiResponse } = require('../utils/ApiResponse');

class FinancialController {
  constructor(financialService) {
    this.financialService = financialService;
  }

  index = async (req, res) => ApiResponse.success(
    res,
    await this.financialService.list(req.sessionUser),
    'Student payments list',
  );

  show = async (req, res) => ApiResponse.success(
    res,
    await this.financialService.show(req.sessionUser, req.params.id),
    'Student payment',
  );

  create = async (req, res) => ApiResponse.success(
    res,
    await this.financialService.create(req.sessionUser, req.body),
    'Student charge created',
    201,
  );

  update = async (req, res) => ApiResponse.success(
    res,
    await this.financialService.update(req.sessionUser, req.params.id, req.body),
    'Student charge updated',
  );

  reverse = async (req, res) => ApiResponse.success(
    res,
    await this.financialService.reverse(req.sessionUser, req.params.id, req.body.reason),
    'Student payment reversed',
    201,
  );
}

module.exports = { FinancialController };
