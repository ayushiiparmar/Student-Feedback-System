const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-this-')) {
    throw new Error('JWT_SECRET must be set to a private value of at least 32 characters.');
  }
  return secret;
}

function createToken(userId) {
  return jwt.sign(
    { sub: String(userId) },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

module.exports = { createToken, getJwtSecret };
