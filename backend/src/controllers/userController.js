const bcrypt = require('bcryptjs');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const db = require('../db');

// GET /api/users (admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const query = {};

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }

    const all = await db.users.find(query).sort({ createdAt: -1 });
    const total = all.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = all.slice(skip, skip + parseInt(limit)).map(({ password, ...u }) => u);

    return sendPaginated(res, paginated, total, page, limit, 'Users fetched');
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id
const getUserById = async (req, res, next) => {
  try {
    const user = await db.users.findOne({ _id: req.params.id });
    if (!user) return sendError(res, 'User not found', 404);
    const { password, ...safeUser } = user;
    return sendSuccess(res, safeUser);
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/:id/role (admin only)
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['ADMIN', 'GRANT_MANAGER', 'APPLICANT'].includes(role)) {
      return sendError(res, 'Invalid role', 400);
    }

    const user = await db.users.findOne({ _id: req.params.id });
    if (!user) return sendError(res, 'User not found', 404);

    await db.users.update({ _id: req.params.id }, { $set: { role, updatedAt: new Date().toISOString() } });
    return sendSuccess(res, null, 'User role updated');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/:id/toggle-active (admin only)
const toggleUserActive = async (req, res, next) => {
  try {
    const user = await db.users.findOne({ _id: req.params.id });
    if (!user) return sendError(res, 'User not found', 404);

    await db.users.update(
      { _id: req.params.id },
      { $set: { isActive: !user.isActive, updatedAt: new Date().toISOString() } }
    );
    return sendSuccess(res, null, `User ${user.isActive ? 'deactivated' : 'activated'}`);
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/profile (self)
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { name, avatar } = req.body;

    const updates = { updatedAt: new Date().toISOString() };
    if (name) updates.name = name;
    if (avatar !== undefined) updates.avatar = avatar;

    await db.users.update({ _id: userId }, { $set: updates });
    const updated = await db.users.findOne({ _id: userId });
    const { password, ...safeUser } = updated;
    return sendSuccess(res, safeUser, 'Profile updated');
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/password
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await db.users.findOne({ _id: userId });
    if (user.provider !== 'local') {
      return sendError(res, 'Password change not available for OAuth accounts', 400);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return sendError(res, 'Current password is incorrect', 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.users.update({ _id: userId }, { $set: { password: hashed, updatedAt: new Date().toISOString() } });

    return sendSuccess(res, null, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllUsers, getUserById, updateUserRole, toggleUserActive, updateProfile, changePassword };
