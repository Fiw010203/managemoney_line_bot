const test = require('node:test');
const assert = require('node:assert/strict');
const { setPending, getPending, clearPending } = require('../src/state/pendingConfirmations');

test('pendingConfirmations: stores and retrieves default TRANSACTION type', () => {
  const userId = 'user_test_1';
  clearPending(userId);

  setPending(userId, { item: 'ข้าวผัด', amount: 50 });
  const pending = getPending(userId);

  assert.notEqual(pending, null);
  assert.equal(pending.type, 'TRANSACTION');
  assert.equal(pending.data.item, 'ข้าวผัด');

  clearPending(userId);
  assert.equal(getPending(userId), null);
});

test('pendingConfirmations: stores and retrieves custom CLEAR_ALL type', () => {
  const userId = 'user_test_2';
  clearPending(userId);

  setPending(userId, null, 'CLEAR_ALL');
  const pending = getPending(userId);

  assert.notEqual(pending, null);
  assert.equal(pending.type, 'CLEAR_ALL');

  clearPending(userId);
});
