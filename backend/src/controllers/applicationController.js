const { v4: uuidv4 } = require('uuid');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const db = require('../db');

// POST /api/applications
const submitApplication = async (req, res, next) => {
  try {
    const { grantId, projectTitle, projectDescription, requestedAmount, organizationName, contactEmail } = req.body;
    const userId = req.user._id || req.user.id;

    // Check grant exists and is open
    const grant = await db.grants.findOne({ _id: grantId });
    if (!grant) return sendError(res, 'Grant not found', 404);
    if (grant.status !== 'OPEN') return sendError(res, 'Grant is not open for applications', 400);

    // Check deadline
    if (new Date(grant.deadline) < new Date()) {
      return sendError(res, 'Grant deadline has passed', 400);
    }

    // Check duplicate application
    const existing = await db.applications.findOne({ grantId, applicantId: userId });
    if (existing) return sendError(res, 'You have already applied for this grant', 409);

    const now = new Date().toISOString();
    const application = await db.applications.insert({
      _id: uuidv4(),
      grantId,
      applicantId: userId,
      status: 'PENDING',
      projectTitle,
      projectDescription,
      requestedAmount: parseFloat(requestedAmount),
      organizationName,
      contactEmail,
      documents: [],
      reviewNotes: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Notify applicant
    await db.notifications.insert({
      _id: uuidv4(),
      userId,
      title: 'Application Submitted',
      message: `Your application for "${grant.title}" has been submitted successfully.`,
      type: 'SUCCESS',
      isRead: false,
      createdAt: now,
    });

    return sendSuccess(res, application, 'Application submitted successfully', 201);
  } catch (err) {
    next(err);
  }
};

// GET /api/applications - list (filtered by role)
const getApplications = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, grantId } = req.query;
    const userId = req.user._id || req.user.id;
    const query = {};

    if (status) query.status = status;
    if (grantId) query.grantId = grantId;

    // Applicants only see their own
    if (req.user.role === 'APPLICANT') {
      query.applicantId = userId;
    }

    const all = await db.applications.find(query).sort({ createdAt: -1 });
    const total = all.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = all.slice(skip, skip + parseInt(limit));

    // Enrich with grant and user info
    const enriched = await Promise.all(
      paginated.map(async (app) => {
        const grant = await db.grants.findOne({ _id: app.grantId });
        const applicant = await db.users.findOne({ _id: app.applicantId });
        return {
          ...app,
          grantTitle: grant ? grant.title : 'Unknown',
          applicantName: applicant ? applicant.name : 'Unknown',
          applicantEmail: applicant ? applicant.email : 'Unknown',
        };
      })
    );

    return sendPaginated(res, enriched, total, page, limit, 'Applications fetched');
  } catch (err) {
    next(err);
  }
};

// GET /api/applications/:id
const getApplicationById = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const application = await db.applications.findOne({ _id: req.params.id });
    if (!application) return sendError(res, 'Application not found', 404);

    // Applicants can only see their own
    if (req.user.role === 'APPLICANT' && application.applicantId !== userId) {
      return sendError(res, 'Access denied', 403);
    }

    const grant = await db.grants.findOne({ _id: application.grantId });
    const applicant = await db.users.findOne({ _id: application.applicantId });
    const reviewer = application.reviewedBy
      ? await db.users.findOne({ _id: application.reviewedBy })
      : null;

    return sendSuccess(res, {
      ...application,
      grant,
      applicantName: applicant ? applicant.name : 'Unknown',
      applicantEmail: applicant ? applicant.email : 'Unknown',
      reviewerName: reviewer ? reviewer.name : null,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/applications/:id/review - GRANT_MANAGER / ADMIN only
const reviewApplication = async (req, res, next) => {
  try {
    const { status, reviewNotes } = req.body;
    const userId = req.user._id || req.user.id;

    if (!['APPROVED', 'REJECTED', 'UNDER_REVIEW'].includes(status)) {
      return sendError(res, 'Invalid status', 400);
    }

    const application = await db.applications.findOne({ _id: req.params.id });
    if (!application) return sendError(res, 'Application not found', 404);

    const now = new Date().toISOString();
    await db.applications.update(
      { _id: req.params.id },
      {
        $set: {
          status,
          reviewNotes: reviewNotes || null,
          reviewedBy: userId,
          reviewedAt: now,
          updatedAt: now,
        },
      }
    );

    const grant = await db.grants.findOne({ _id: application.grantId });

    // Notify applicant
    const statusMessages = {
      APPROVED: `Congratulations! Your application for "${grant?.title}" has been approved.`,
      REJECTED: `Your application for "${grant?.title}" has been rejected. ${reviewNotes ? 'Notes: ' + reviewNotes : ''}`,
      UNDER_REVIEW: `Your application for "${grant?.title}" is now under review.`,
    };

    await db.notifications.insert({
      _id: uuidv4(),
      userId: application.applicantId,
      title: `Application ${status.replace('_', ' ')}`,
      message: statusMessages[status],
      type: status === 'APPROVED' ? 'SUCCESS' : status === 'REJECTED' ? 'ERROR' : 'INFO',
      isRead: false,
      createdAt: now,
    });

    const updated = await db.applications.findOne({ _id: req.params.id });
    return sendSuccess(res, updated, 'Application reviewed successfully');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/applications/:id - applicant can withdraw pending
const withdrawApplication = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const application = await db.applications.findOne({ _id: req.params.id });
    if (!application) return sendError(res, 'Application not found', 404);

    if (req.user.role === 'APPLICANT') {
      if (application.applicantId !== userId) return sendError(res, 'Access denied', 403);
      if (application.status !== 'PENDING') return sendError(res, 'Only pending applications can be withdrawn', 400);
    }

    await db.applications.remove({ _id: req.params.id });
    return sendSuccess(res, null, 'Application withdrawn successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { submitApplication, getApplications, getApplicationById, reviewApplication, withdrawApplication };
