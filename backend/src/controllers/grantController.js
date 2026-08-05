const grantService = require('../services/grantService');
const applicationService = require('../services/applicationService');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// GET /api/grants
const getAllGrants = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const { total, grants } = await grantService.list(req.user, {
      page,
      limit,
      status: req.query.status,
      category: req.query.category,
      search: req.query.search,
    });
    return sendPaginated(res, grants, total, page, limit, 'Grants fetched');
  } catch (err) {
    return next(err);
  }
};

// GET /api/grants/:id
const getGrantById = async (req, res, next) => {
  try {
    return sendSuccess(res, await grantService.getById(req.params.id));
  } catch (err) {
    return next(err);
  }
};

// POST /api/grants
const createGrant = async (req, res, next) => {
  try {
    const grant = await grantService.create(req.user, req.body);
    return sendSuccess(res, grant, 'Grant created successfully', 201);
  } catch (err) {
    return next(err);
  }
};

// PUT /api/grants/:id
const updateGrant = async (req, res, next) => {
  try {
    const grant = await grantService.update(req.user, req.params.id, req.body);
    return sendSuccess(res, grant, 'Grant updated successfully');
  } catch (err) {
    return next(err);
  }
};

// DELETE /api/grants/:id
const deleteGrant = async (req, res, next) => {
  try {
    await grantService.remove(req.params.id);
    return sendSuccess(res, null, 'Grant deleted successfully');
  } catch (err) {
    return next(err);
  }
};

// GET /api/grants/stats
const getGrantStats = async (req, res, next) => {
  try {
    return sendSuccess(res, await grantService.getStats(req.user));
  } catch (err) {
    return next(err);
  }
};

// GET /api/grants/:grantId/applications — owner (or admin) only
const getGrantApplications = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const { total, applications } = await applicationService.listForGrant(
      req.user,
      req.params.grantId,
      { page, limit, status: req.query.status }
    );
    return sendPaginated(res, applications, total, page, limit, 'Applications fetched');
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getAllGrants,
  getGrantById,
  createGrant,
  updateGrant,
  deleteGrant,
  getGrantStats,
  getGrantApplications,
};
