// Auth routes: /api/auth/*
// Per BLL.md MODULE 1: AUTHENTICATION
const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const result = await authService.login(identifier, password, ipAddress);
    res.status(result.status).json(result.data);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.status(result.status).json(result.data);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, otp, new_password } = req.body;
    const result = await authService.resetPassword(email, otp, new_password);
    res.status(result.status).json(result.data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
