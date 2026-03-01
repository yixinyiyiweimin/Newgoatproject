const express = require('express');
const router = express.Router();
const Joi = require('joi');
const checkPermission = require('../../middleware/permission');
const service = require('../../services/premise.service');

const createSchema = Joi.object({
  premise_code: Joi.string().max(100).trim().required(),
  state: Joi.string().max(100).allow('', null),
  district: Joi.string().max(100).allow('', null),
  address: Joi.string().allow('', null),
});

const updateSchema = Joi.object({
  premise_code: Joi.string().max(100).trim(),
  state: Joi.string().max(100).allow('', null),
  district: Joi.string().max(100).allow('', null),
  address: Joi.string().allow('', null),
}).min(1);

// GET /api/admin/premises
router.get('/', checkPermission('premise', 'view'), async (req, res, next) => {
  try {
    const items = await service.list(req.query.search);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/premises/archived
router.get('/archived', checkPermission('premise', 'view'), async (req, res, next) => {
  try {
    const items = await service.listArchived(req.query.search);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/premises/dropdown
router.get('/dropdown', checkPermission('premise', 'view'), async (req, res, next) => {
  try {
    const items = await service.listForDropdown();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/premises
router.post('/', checkPermission('premise', 'create'), async (req, res, next) => {
  try {
    const { error } = createSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const created = await service.create(req.body, req.user.user_account_id);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/premises/:id
router.patch('/:id', checkPermission('premise', 'update'), async (req, res, next) => {
  try {
    const { error } = updateSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const updated = await service.update(req.params.id, req.body, req.user.user_account_id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/premises/:id
router.delete('/:id', checkPermission('premise', 'delete'), async (req, res, next) => {
  try {
    const result = await service.softDelete(req.params.id, req.user.user_account_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
