const assert = require('node:assert/strict');
const { test } = require('node:test');
const anonymizeComment = require('../utils/anonymizeComment');

test('redacts registered identities without matching them inside other words', function () {
  const result = anonymizeComment(
    'AARAV KUMAR aarav.kumar@example.test 65a1b2c3d4e5f67890123456 annual review',
    [{
      name: 'Aarav Kumar',
      email: 'aarav.kumar@example.test',
      _id: '65a1b2c3d4e5f67890123456'
    }]
  );

  assert.doesNotMatch(result, /Aarav Kumar|aarav\.kumar@example\.test|65a1b2c3d4e5f67890123456/i);
  assert.match(result, /annual review/);
});

test('redacts contact details, account handles, links, and common student IDs', function () {
  const result = anonymizeComment(
    'Call +1 (555) 010-1234, email other@example.test, @student_handle, '
      + 'https://example.test/profile, or use STU-20260001.',
    []
  );

  assert.doesNotMatch(result, /\+1 \(555\) 010-1234|other@example\.test|@student_handle|https:\/\/example\.test\/profile|STU-20260001/i);
  assert.match(result, /\[redacted contact\]/);
  assert.match(result, /\[redacted account\]/);
  assert.match(result, /\[redacted link\]/);
  assert.match(result, /\[redacted ID\]/);
});
