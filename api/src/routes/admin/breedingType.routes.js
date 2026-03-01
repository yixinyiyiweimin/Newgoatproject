const express = require('express');
const router = express.Router();
const Joi = require('joi');
const checkPermission = require('../../middleware/permission');
const service = require('../../services/breedingType.service');

const createSchema = Joi.object({
  name: Joi.string().max(100).trim().required(),
});

const updateSchema = Joi.object({
  name: Joi.string().max(100).trim(),
}).min(1);

// GET /api/admin/breeding-types
router.get('/', checkPermission('breeding_type', 'view'), async (req, res, next) => {
  try {
    const items = await service.list(req.query.search);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/breeding-types/archived
router.get('/archived', checkPermission('breeding_type', 'view'), async (req, res, next) => {
  try {
    const items = await service.listArchived(req.query.search);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/breeding-types
router.post('/', checkPermission('breeding_type', 'create'), async (req, res, next) => {
  try {
    const { error } = createSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const created = await service.create(req.body, req.user.user_account_id);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/breeding-types/:id
router.patch('/:id', checkPermission('breeding_type', 'update'), async (req, res, next) => {
  try {
    const { error } = updateSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const updated = await service.update(req.params.id, req.body, req.user.user_account_id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/breeding-types/:id
router.delete('/:id', checkPermission('breeding_type', 'delete'), async (req, res, next) => {
  try {
    const result = await service.delete(req.params.id, req.user.user_account_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
