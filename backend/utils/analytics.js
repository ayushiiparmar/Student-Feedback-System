const { ratingKeys } = require('./validation');

function roundRating(value) {
  return value === null ? null : Number(value.toFixed(2));
}

function average(values) {
  return values.length
    ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length
    : null;
}

function scoresFor(feedback) {
  return feedback.flatMap(function (entry) {
    return ratingKeys.map(function (key) { return Number(entry.ratings[key]); });
  });
}

function summarizeRatings(feedback) {
  const categoryAverages = {};
  ratingKeys.forEach(function (key) {
    categoryAverages[key] = roundRating(average(feedback.map(function (entry) {
      return Number(entry.ratings[key]);
    })));
  });

  return {
    responseCount: feedback.length,
    averageRating: roundRating(average(scoresFor(feedback))),
    categoryAverages
  };
}

function ratingDistribution(feedback) {
  const countsByParameter = {};
  ratingKeys.forEach(function (key) {
    countsByParameter[key] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  });

  feedback.forEach(function (entry) {
    ratingKeys.forEach(function (key) {
      const rating = Number(entry.ratings[key]);
      if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
        countsByParameter[key][rating] += 1;
      }
    });
  });

  const overallCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  Object.values(countsByParameter).forEach(function (parameterCounts) {
    Object.keys(overallCounts).forEach(function (rating) {
      overallCounts[rating] += parameterCounts[rating];
    });
  });
  const totalRatings = feedback.length * ratingKeys.length;

  return {
    totalRatings,
    overall: Object.keys(overallCounts).map(function (rating) {
      return {
        rating: Number(rating),
        count: overallCounts[rating],
        percentage: totalRatings
          ? Number((overallCounts[rating] / totalRatings * 100).toFixed(2))
          : 0
      };
    }),
    byParameter: countsByParameter
  };
}

module.exports = { average, ratingDistribution, roundRating, scoresFor, summarizeRatings };
