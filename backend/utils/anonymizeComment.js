function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceIdentity(comment, identity) {
  const parts = String(identity).trim().split(/\s+/).map(escapeRegExp);
  if (!parts.join('')) return comment;
  const pattern = new RegExp(
    '(^|[^\\p{L}\\p{N}])' + parts.join('\\s+') + '(?=$|[^\\p{L}\\p{N}])',
    'giu'
  );
  return comment.replace(pattern, '$1[redacted]');
}

function anonymizeComment(comment, students) {
  let result = String(comment || '');
  const identities = students.flatMap(function (student) {
    const nameParts = String(student.name || '').trim().split(/\s+/).filter(function (part) {
      return part.length >= 4;
    });
    return [student.name, ...nameParts, student.email, student._id, student.studentId]
      .filter(Boolean);
  }).sort(function (first, second) {
    return String(second).length - String(first).length;
  });

  identities.forEach(function (identity) {
    result = replaceIdentity(result, identity);
  });

  return result
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[redacted link]')
    .replace(/(^|[^\p{L}\p{N}])@[A-Z0-9_][A-Z0-9._-]{1,30}\b/giu, '$1[redacted account]')
    .replace(/\b(?:SRU|STU|STUDENT)[-_]?[A-Z0-9]{4,}(?:[-_][A-Z0-9]+)*\b/gi, '[redacted ID]')
    .replace(/(^|[^\d])(\+?\d(?:[\s().-]*\d){6,}\d)(?=$|[^\d])/g, '$1[redacted contact]')
    .replace(/\b[A-Z][a-z]+(?:[-'][A-Za-z]+)?(?:\s+[A-Z][a-z]+(?:[-'][A-Za-z]+)?){1,2}\b/g, '[redacted name]');
}

module.exports = anonymizeComment;
