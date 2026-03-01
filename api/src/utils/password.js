const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

module.exports = {
  async hashPassword(plainText) {
    return await bcrypt.hash(plainText, SALT_ROUNDS);
  },

  async comparePassword(plainText, hash) {
    return await bcrypt.compare(plainText, hash);
  },
};
