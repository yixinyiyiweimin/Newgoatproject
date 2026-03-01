const express = require('express');
const router = express.Router();
const Joi = require('joi');
const checkPermission = require('../../middleware/permission');
const roleService = require('../../services/role.service');

const createRoleSchema = Joi.object({
  role_name: Joi.string().max(100).trim().required(),
  permissions: Joi.array().items(
    Joi.object({
      module_name: Joi.string().required(),
      actions: Joi.array().items(Joi.string().valid('view', 'create', 'update', 'delete', 'VIEW', 'CREATE', 'UPDATE', 'DELETE')).min(1).required(),
    })
  ).required(),
});

const updateRoleSchema = Joi.object({
  role_name: Joi.string().max(100).trim(),
  permissions: Joi.array().items(
    Joi.object({
      module_name: Joi.string().required(),
      actions: Joi.array().items(Joi.string().valid('view', 'create', 'update', 'delete', 'VIEW', 'CREATE', 'UPDATE', 'DELETE')).min(1).required(),
    })
  ),
}).min(1);

// GET /api/admin/roles — list all roles
router.get('/', checkPermission('user_role', 'view'), async (req, res, next) => {
  try {
    const roles = await roleService.listRoles();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/roles/users — list users with role assignments
router.get('/users', checkPermission('user_role', 'view'), async (req, res, next) => {
  try {
    const users = await roleService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/roles/permissions — list available module/action combos
router.get('/permissions', checkPermission('user_role', 'view'), async (req, res, next) => {
  try {
    const perms = await roleService.listPermissions();
    res.json(perms);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/roles — create role
router.post('/', checkPermission('user_role', 'create'), async (req, res, next) => {
  try {
    const { error } = createRoleSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const result = await roleService.createRole(req.body, req.user.user_account_id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/roles/:id — update role
router.patch('/:id', checkPermission('user_role', 'update'), async (req, res, next) => {
  try {
    const { error } = updateRoleSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const result = await roleService.updateRole(req.params.id, req.body, req.user.user_account_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/roles/:id — delete role
router.delete('/:id', checkPermission('user_role', 'delete'), async (req, res, next) => {
  try {
    const result = await roleService.deleteRole(req.params.id, req.user.user_account_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/roles/users/:userAccountId — assign role to user
router.patch('/users/:userAccountId', checkPermission('user_role', 'update'), async (req, res, next) => {
  try {
    const { role_id } = req.body;

    // role_id = null means "unassign all roles"
    const result = await roleService.assignRole(req.params.userAccountId, role_id || null, req.user.user_account_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/roles/users/:userAccountId/status — update user status
router.patch('/users/:userAccountId/status', checkPermission('user_role', 'update'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
      throw { status: 400, message: 'status must be ACTIVE or INACTIVE' };
    }

    const result = await roleService.updateUserStatus(req.params.userAccountId, status, req.user.user_account_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
