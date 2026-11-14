const ApiError = require('../utils/ApiError');

function authorizeRole() {
  const allowedRoles = Array.from(arguments);
  return function (request, response, next) {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return next(new ApiError(403, 'You do not have permission to access this resource.'));
    }
    next();
  };
}

module.exports = authorizeRole;
