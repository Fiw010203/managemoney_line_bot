const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deleteLatestTransaction,
  clearAllTransactions,
  hasTransactions,
} = require('../src/services/transactionService');

test('deleteLatestTransaction: returns NO_USER_ID when userId is empty', async () => {
  const result = await deleteLatestTransaction(null);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'NO_USER_ID');
});

test('clearAllTransactions: returns NO_USER_ID when userId is empty', async () => {
  const result = await clearAllTransactions(null);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'NO_USER_ID');
});

test('hasTransactions: returns false when userId is empty', async () => {
  const result = await hasTransactions(null);
  assert.equal(result, false);
});
