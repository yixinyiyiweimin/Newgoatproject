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

async function sendCredentials(toEmail, tempPassword) {
  await transporter.sendMail({
    from: config.smtp.from,
    to: toEmail,
    subject: 'Goat Farm System - Your Account Credentials',
    text: `Your account has been created.\n\nEmail: ${toEmail}\nTemporary Password: ${tempPassword}\n\nPlease login and change your password immediately.`,
    html: `<p>Your account has been created.</p><p><strong>Email:</strong> ${toEmail}<br/><strong>Temporary Password:</strong> ${tempPassword}</p><p>Please login and change your password immediately.</p>`,
  });
}

module.exports = { sendOTP, sendCredentials };