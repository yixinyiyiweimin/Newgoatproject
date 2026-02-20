const bcrypt = require('bcryptjs');

module.exports = {
  generateOTP() {
    // Generate 6-digit random number (100000 to 999999)
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  async hashOTP(otp) {
    // Hash OTP before storing in database
    return await bcrypt.hash(otp, 10); // Lower salt rounds for OTP (faster)
  },

  async compareOTP(plainOTP, hashedOTP) {
    return await bcrypt.compare(plainOTP, hashedOTP);
  },
};
