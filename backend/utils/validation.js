const mongoose = require('mongoose');
const ApiError = require('./ApiError');

const ratingKeys = ['clarity', 'communication', 'punctuality', 'engagement', 'subjectKnowledge'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Request body must be a JSON object.');
  }
}

function assertAllowedKeys(body, allowedKeys) {
  assertObjectBody(body);
  const unexpected = Object.keys(body).filter(function (key) {
    return !allowedKeys.includes(key);
  });
  if (unexpected.length) {
    throw new ApiError(400, `Unexpected field: ${unexpected[0]}.`);
  }
}

function requiredString(value, label, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, `${label} is required.`);
  }
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw new ApiError(400, `${label} cannot exceed ${maxLength} characters.`);
  }
  return trimmed;
}

function validateEmail(value) {
  const email = requiredString(value, 'Email', 254).toLowerCase();
  if (!emailPattern.test(email)) throw new ApiError(400, 'Enter a valid email address.');
  return email;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long.');
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    throw new ApiError(400, 'Password cannot exceed 72 UTF-8 bytes.');
  }
  return value;
}

function validateObjectId(value, label) {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `${label} must be a valid ID.`);
  }
  return value;
}

function validateRatings(ratings) {
  if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) {
    throw new ApiError(400, 'Ratings must include exactly the five required parameters.');
  }

  const keys = Object.keys(ratings);
  if (keys.length !== ratingKeys.length || ratingKeys.some(function (key) { return !Object.prototype.hasOwnProperty.call(ratings, key); })) {
    throw new ApiError(400, 'Ratings must include exactly the five required parameters.');
  }

  ratingKeys.forEach(function (key) {
    const value = ratings[key];
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new ApiError(400, `Rating "${key}" must be an integer from 1 to 5.`);
    }
  });

  return ratingKeys.reduce(function (result, key) {
    result[key] = ratings[key];
    return result;
  }, {});
}

module.exports = {
  assertAllowedKeys,
  assertObjectBody,
  ratingKeys,
  requiredString,
  validateEmail,
  validateObjectId,
  validatePassword,
  validateRatings
};
