const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

module.exports = {
  async hash(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  },

  async compare(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
};
