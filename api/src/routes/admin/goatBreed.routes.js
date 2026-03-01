const express = require('express');
const router = express.Router();
const Joi = require('joi');
const checkPermission = require('../../middleware/permission');
const service = require('../../services/goatBreed.service');

const createSchema = Joi.object({
  name: Joi.string().max(100).trim().required(),
});

const updateSchema = Joi.object({
  name: Joi.string().max(100).trim(),
}).min(1);

// GET /api/admin/goat-breeds
router.get('/', checkPermission('goat_breed', 'view'), async (req, res, next) => {
  try {
    const items = await service.list(req.query.search);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/goat-breeds/archived
router.get('/archived', checkPermission('goat_breed', 'view'), async (req, res, next) => {
  try {
    const items = await service.listArchived(req.query.search);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/goat-breeds
router.post('/', checkPermission('goat_breed', 'create'), async (req, res, next) => {
  try {
    const { error } = createSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const created = await service.create(req.body, req.user.user_account_id);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/goat-breeds/:id
router.patch('/:id', checkPermission('goat_breed', 'update'), async (req, res, next) => {
  try {
    const { error } = updateSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const updated = await service.update(req.params.id, req.body, req.user.user_account_id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/goat-breeds/:id
router.delete('/:id', checkPermission('goat_breed', 'delete'), async (req, res, next) => {
  try {
    const result = await service.delete(req.params.id, req.user.user_account_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
