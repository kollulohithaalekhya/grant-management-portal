const { v4: uuidv4 } = require('uuid');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const db = require('../db');

// GET /api/grants
const getAllGrants = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, category, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      // NeDB regex search
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
      ];
    }

    // Applicants only see OPEN grants
    if (req.user.role === 'APPLICANT') {
      query.status = 'OPEN';
    }

    const all = await db.grants.find(query).sort({ createdAt: -1 });
    const total = all.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = all.slice(skip, skip + parseInt(limit));

    // Enrich with creator info
    const enriched = await Promise.all(
      paginated.map(async (grant) => {
        const creator = await db.users.findOne({ _id: grant.createdBy });
        return {
          ...grant,
          createdByName: creator ? creator.name : 'Unknown',
        };
      })
    );

    return sendPaginated(res, enriched, total, page, limit, 'Grants fetched');
  } catch (err) {
    next(err);
  }
};

// GET /api/grants/:id
const getGrantById = async (req, res, next) => {
  try {
    const grant = await db.grants.findOne({ _id: req.params.id });
    if (!grant) return sendError(res, 'Grant not found', 404);

    const creator = await db.users.findOne({ _id: grant.createdBy });
    const applicationCount = await db.applications.count({ grantId: grant._id });

    return sendSuccess(res, {
      ...grant,
      createdByName: creator ? creator.name : 'Unknown',
      applicationCount,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/grants
const createGrant = async (req, res, next) => {
  try {
    const { title, description, amount, deadline, category, eligibility } = req.body;
    const now = new Date().toISOString();

    const grant = await db.grants.insert({
      _id: uuidv4(),
      title,
      description,
      amount: parseFloat(amount),
      deadline,
      category,
      eligibility,
      status: 'OPEN',
      createdBy: req.user._id || req.user.id,
      createdAt: now,
      updatedAt: now,
    });

    return sendSuccess(res, grant, 'Grant created successfully', 201);
  } catch (err) {
    next(err);
  }
};

// PUT /api/grants/:id
const updateGrant = async (req, res, next) => {
  try {
    const grant = await db.grants.findOne({ _id: req.params.id });
    if (!grant) return sendError(res, 'Grant not found', 404);

    const userId = req.user._id || req.user.id;

    // Only admin or creator can update
    if (req.user.role !== 'ADMIN' && grant.createdBy !== userId) {
      return sendError(res, 'Not authorized to update this grant', 403);
    }

    const { title, description, amount, deadline, category, eligibility, status } = req.body;
    const updated = {
      ...(title && { title }),
      ...(description && { description }),
      ...(amount && { amount: parseFloat(amount) }),
      ...(deadline && { deadline }),
      ...(category && { category }),
      ...(eligibility && { eligibility }),
      ...(status && { status }),
      updatedAt: new Date().toISOString(),
    };

    await db.grants.update({ _id: req.params.id }, { $set: updated });
    const refreshed = await db.grants.findOne({ _id: req.params.id });

    return sendSuccess(res, refreshed, 'Grant updated successfully');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/grants/:id
const deleteGrant = async (req, res, next) => {
  try {
    const grant = await db.grants.findOne({ _id: req.params.id });
    if (!grant) return sendError(res, 'Grant not found', 404);

    // Delete associated applications
    await db.applications.remove({ grantId: req.params.id }, { multi: true });
    await db.grants.remove({ _id: req.params.id });

    return sendSuccess(res, null, 'Grant deleted successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/grants/stats (admin/manager)
const getGrantStats = async (req, res, next) => {
  try {
    const totalGrants = await db.grants.count({});
    const openGrants = await db.grants.count({ status: 'OPEN' });
    const closedGrants = await db.grants.count({ status: 'CLOSED' });
    const totalApplications = await db.applications.count({});
    const pendingApplications = await db.applications.count({ status: 'PENDING' });
    const approvedApplications = await db.applications.count({ status: 'APPROVED' });
    const rejectedApplications = await db.applications.count({ status: 'REJECTED' });
    const totalUsers = await db.users.count({});

    const allGrants = await db.grants.find({});
    const totalFunding = allGrants.reduce((sum, g) => sum + (g.amount || 0), 0);

    return sendSuccess(res, {
      totalGrants,
      openGrants,
      closedGrants,
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      totalUsers,
      totalFunding,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllGrants, getGrantById, createGrant, updateGrant, deleteGrant, getGrantStats };
