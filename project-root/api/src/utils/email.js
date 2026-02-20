const nodemailer = require('nodemailer');
const config = require('../config/env');

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false, // port 587 uses STARTTLS, not SSL
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

async function sendOTP(toEmail, otp) {
  await transporter.sendMail({
    from: config.smtp.from,
    to: toEmail,
    subject: 'Goat Farm System - Password Reset OTP',
    text: `Your OTP code is: ${otp}\n\nThis code expires in 10 minutes.\nIf you did not request this, ignore this email.`,
    html: `<p>Your OTP code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p><p>If you did not request this, ignore this email.</p>`,
  });
}

module.exports = { sendOTP };