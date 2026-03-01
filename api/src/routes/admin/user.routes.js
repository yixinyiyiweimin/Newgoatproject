const express = require('express');
const router = express.Router();
const Joi = require('joi');
const checkPermission = require('../../middleware/permission');
const userService = require('../../services/user.service');

const createSchema = Joi.object({
  user_type: Joi.string().valid('Individual', 'Company').required(),
  full_name: Joi.string().max(255).when('user_type', {
    is: 'Individual',
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null),
  }),
  ic_or_passport: Joi.string().max(50).required(),
  address: Joi.string().allow('', null),
  phone_number: Joi.string().max(20).allow('', null),
  email: Joi.string().email().required(),
  premise_id: Joi.number().integer().optional(),
  company_name: Joi.string().max(255).when('user_type', {
    is: 'Company',
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null),
  }),
  company_registration_no: Joi.string().max(100).when('user_type', {
    is: 'Company',
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null),
  }),
  person_in_charge: Joi.string().max(255).allow('', null),
  role_id: Joi.number().integer().optional(),
});

const updateSchema = Joi.object({
  full_name: Joi.string().max(255),
  address: Joi.string().allow('', null),
  phone_number: Joi.string().max(20).allow('', null),
  email: Joi.string().email(),
  premise_id: Joi.number().integer(),
  company_name: Joi.string().max(255).allow('', null),
  company_registration_no: Joi.string().max(100).allow('', null),
  person_in_charge: Joi.string().max(255).allow('', null),
}).min(1);

// GET /api/admin/users
router.get('/', checkPermission('user_registration', 'view'), async (req, res, next) => {
  try {
    const users = await userService.list(req.query.q);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:id
router.get('/:id', checkPermission('user_registration', 'view'), async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users
router.post('/', checkPermission('user_registration', 'create'), async (req, res, next) => {
  try {
    const { error } = createSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const result = await userService.create(req.body, req.user.user_account_id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id
router.patch('/:id', checkPermission('user_registration', 'update'), async (req, res, next) => {
  try {
    const { error } = updateSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const result = await userService.update(req.params.id, req.body, req.user.user_account_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id
router.delete('/:id', checkPermission('user_registration', 'delete'), async (req, res, next) => {
  try {
    const result = await userService.softDelete(req.params.id, req.user.user_account_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/resend
router.post('/:id/resend', checkPermission('user_registration', 'update'), async (req, res, next) => {
  try {
    const result = await userService.resendCredentials(req.params.id, req.user.user_account_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
