const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { getJwtSecret } = require('../utils/jwt');

async function requireAuth(request, response, next) {
  const authorization = request.get('authorization') || '';
  const tokenMatch = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!tokenMatch) return next(new ApiError(401, 'A valid Bearer token is required.'));

  let payload;
  try {
    payload = jwt.verify(tokenMatch[1], getJwtSecret());
  } catch (error) {
    return next(new ApiError(401, 'Token is invalid or expired.'));
  }

  if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string') {
    return next(new ApiError(401, 'Token is invalid or expired.'));
  }

  const user = await User.findById(payload.sub)
    .select('_id name email role department semester createdAt updatedAt')
    .lean();
  if (!user) return next(new ApiError(401, 'Token user no longer exists.'));

  request.user = user;
  next();
}

module.exports = requireAuth;
