const express = require('express');
const router = express.Router();
const Joi = require('joi');
const authService = require('../services/auth.service');

// Input validation schemas
const loginSchema = Joi.object({
  identifier: Joi.string().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  new_password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/)
    .required()
    .messages({
      'string.pattern.base':
        'Password must contain uppercase, lowercase, number, and special character',
    }),
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    // Validate input
    const { error } = loginSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const { identifier, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Call service
    const result = await authService.login(identifier, password, ipAddress);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { error } = forgotPasswordSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const { email } = req.body;
    const result = await authService.forgotPassword(email);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { error } = resetPasswordSchema.validate(req.body);
    if (error) throw { status: 400, message: error.details[0].message };

    const { email, otp, new_password } = req.body;
    const result = await authService.resetPassword(email, otp, new_password);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
