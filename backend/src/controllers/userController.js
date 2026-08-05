const userService = require('../services/userService');
const { ApiError } = require('../utils/errors');
const { ROLES } = require('../constants/roles');
const { serializeUser } = require('../lib/serializers');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// GET /api/users (admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const { total, users } = await userService.listUsers({
      page,
      limit,
      role: req.query.role,
      search: req.query.search,
    });
    return sendPaginated(res, users, total, page, limit, 'Users fetched');
  } catch (err) {
    return next(err);
  }
};

// GET /api/users/:id (admin only)
const getUserById = async (req, res, next) => {
  try {
    const user = await userService.findById(req.params.id);
    if (!user) throw ApiError.notFound('User not found');
    return sendSuccess(res, serializeUser(user));
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/users/:id/roles (admin only)
 *
 * Accepts `{ roles: [...] }` or the single-role `{ role: "ADMIN" }` shape and
 * replaces the user's assignments. Admins cannot strip their own ADMIN role,
 * which would otherwise let the last administrator lock everyone out.
 */
const updateUserRoles = async (req, res, next) => {
  try {
    const roles = Array.isArray(req.body.roles) ? req.body.roles : [req.body.role];

    if (req.params.id === req.user.id && !roles.includes(ROLES.ADMIN)) {
      throw ApiError.badRequest('You cannot remove your own ADMIN role');
    }

    const user = await userService.replaceUserRoles(req.params.id, roles);
    return sendSuccess(res, serializeUser(user), 'User roles updated');
  } catch (err) {
    return next(err);
  }
};

// PATCH /api/users/:id/toggle-active (admin only)
const toggleUserActive = async (req, res, next) => {
  try {
    const target = await userService.findById(req.params.id);
    if (!target) throw ApiError.notFound('User not found');
    if (target.id === req.user.id) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }

    const user = await userService.setActive(target.id, !target.isActive);
    return sendSuccess(
      res,
      serializeUser(user),
      `User ${user.isActive ? 'activated' : 'deactivated'}`
    );
  } catch (err) {
    return next(err);
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    return sendSuccess(res, serializeUser(user), 'Profile updated');
  } catch (err) {
    return next(err);
  }
};

// PUT /api/users/password
const changePassword = async (req, res, next) => {
  try {
    await userService.changePassword(req.user.id, req.body);
    return sendSuccess(res, null, 'Password changed successfully');
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserRoles,
  toggleUserActive,
  updateProfile,
  changePassword,
};
