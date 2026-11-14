const ApiError = require('../utils/ApiError');

function notFound(request, response, next) {
  next(new ApiError(404, 'Route not found.'));
}

function errorHandler(error, request, response, next) {
  let status = error.status || error.statusCode || 500;
  let message = error.message || 'An unexpected error occurred.';
  let details;

  if (error.code === 11000) {
    status = 409;
    message = 'A record with the same unique value already exists.';
  } else if (error.name === 'ValidationError') {
    status = 400;
    message = 'Request data failed validation.';
    details = Object.values(error.errors).map(function (item) {
      return { field: item.path, message: item.message };
    });
  } else if (error.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${error.path}.`;
  } else if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body')) {
    status = 400;
    message = 'Request body contains invalid JSON.';
  }

  if (status >= 500) {
    console.error(`Unhandled API error: ${error.name || 'Error'}`);
    message = 'An internal server error occurred.';
  }

  response.status(status).json(details ? { error: message, details } : { error: message });
}

module.exports = { errorHandler, notFound };
