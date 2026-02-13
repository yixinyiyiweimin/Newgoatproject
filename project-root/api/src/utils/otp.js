const crypto = require('crypto');
const bcrypt = require('bcryptjs');

module.exports = {
  // Generate a 6-digit OTP
  generate() {
    return crypto.randomInt(100000, 999999).toString();
  },

  // Hash OTP for storage
  async hash(otp) {
    return bcrypt.hash(otp, 10);
  },

  // Compare plain OTP with stored hash
  async compare(plainOtp, hashedOtp) {
    return bcrypt.compare(plainOtp, hashedOtp);
  }
};
