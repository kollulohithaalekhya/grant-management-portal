const applicationService = require('../services/applicationService');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// POST /api/applications
const submitApplication = async (req, res, next) => {
  try {
    const application = await applicationService.submit(req.user, req.body);
    return sendSuccess(res, application, 'Application submitted successfully', 201);
  } catch (err) {
    return next(err);
  }
};

// GET /api/applications
const getApplications = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const { total, applications } = await applicationService.list(req.user, {
      page,
      limit,
      status: req.query.status,
      grantId: req.query.grantId,
    });
    return sendPaginated(res, applications, total, page, limit, 'Applications fetched');
  } catch (err) {
    return next(err);
  }
};

// GET /api/applications/:id
const getApplicationById = async (req, res, next) => {
  try {
    return sendSuccess(res, await applicationService.getById(req.user, req.params.id));
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/applications/:id/review
const reviewApplication = async (req, res, next) => {
  try {
    const application = await applicationService.review(req.user, req.params.id, req.body);
    return sendSuccess(res, application, 'Application reviewed successfully');
  } catch (err) {
    return next(err);
  }
};

// DELETE /api/applications/:id
const withdrawApplication = async (req, res, next) => {
  try {
    await applicationService.withdraw(req.user, req.params.id);
    return sendSuccess(res, null, 'Application withdrawn successfully');
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  submitApplication,
  getApplications,
  getApplicationById,
  reviewApplication,
  withdrawApplication,
};
