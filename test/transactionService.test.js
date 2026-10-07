const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deleteLatestTransaction,
  clearAllTransactions,
  hasTransactions,
  getTransactions,
  supabase,
} = require('../src/services/transactionService');

test('deleteLatestTransaction: returns NO_USER_ID when userId is empty', async () => {
  const result = await deleteLatestTransaction(null);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'NO_USER_ID');
});

test('deleteLatestTransaction: returns NOT_FOUND when no transaction found', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await deleteLatestTransaction('U1234');
    assert.deepEqual(result, { success: false, reason: 'NOT_FOUND' });
  } finally {
    supabase.from = originalFrom;
  }
});

test('deleteLatestTransaction: deletes scoped by id and line_user_id when found', async () => {
  const originalFrom = supabase.from;
  const deleteFilters = [];
  try {
    const fakeRow = {
      id: 42,
      item: 'Coffee',
      amount: 60,
      category: 'Food',
      type: 'EXPENSE',
      date: '2026-10-05',
    };

    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: fakeRow, error: null }),
            }),
          }),
        }),
      }),
      delete: () => {
        const query = {
          eq: (col, val) => {
            deleteFilters.push([col, val]);
            return query;
          },
          select: async () => ({ data: [fakeRow], error: null }),
        };
        return query;
      },
    });

    const result = await deleteLatestTransaction('U1234');
    assert.equal(result.success, true);
    assert.deepEqual(result.data, fakeRow);
    assert.deepEqual(deleteFilters, [
      ['id', 42],
      ['line_user_id', 'U1234'],
    ]);
  } finally {
    supabase.from = originalFrom;
  }
});

test('deleteLatestTransaction: returns ERROR on delete error', async () => {
  const originalFrom = supabase.from;
  try {
    const fakeRow = { id: 42, item: 'Coffee', amount: 60 };
    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: fakeRow, error: null }),
            }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: async () => ({ data: null, error: { message: 'Database delete failed' } }),
          }),
        }),
      }),
    });

    const result = await deleteLatestTransaction('U1234');
    assert.equal(result.success, false);
    assert.equal(result.reason, 'ERROR');
    assert.equal(result.error, 'Database delete failed');
  } finally {
    supabase.from = originalFrom;
  }
});

test('deleteLatestTransaction: returns POLICY_ERROR when 0 rows deleted', async () => {
  const originalFrom = supabase.from;
  try {
    const fakeRow = { id: 42, item: 'Coffee', amount: 60 };
    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: fakeRow, error: null }),
            }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    });

    const result = await deleteLatestTransaction('U1234');
    assert.equal(result.success, false);
    assert.equal(result.reason, 'POLICY_ERROR');
  } finally {
    supabase.from = originalFrom;
  }
});

test('clearAllTransactions: returns NO_USER_ID when userId is empty', async () => {
  const result = await clearAllTransactions(null);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'NO_USER_ID');
});

test('clearAllTransactions: successfully deletes all transactions for lineUserId', async () => {
  const originalFrom = supabase.from;
  const deleteFilters = [];
  try {
    supabase.from = () => ({
      delete: () => ({
        eq: (col, val) => {
          deleteFilters.push([col, val]);
          return {
            select: async () => ({ data: [{ id: 1 }, { id: 2 }], error: null }),
          };
        },
      }),
    });

    const result = await clearAllTransactions('U1234');
    assert.deepEqual(result, { success: true, count: 2 });
    assert.deepEqual(deleteFilters, [['line_user_id', 'U1234']]);
  } finally {
    supabase.from = originalFrom;
  }
});

test('clearAllTransactions: returns reason ERROR on Supabase error', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      delete: () => ({
        eq: () => ({
          select: async () => ({ data: null, error: { message: 'Network error' } }),
        }),
      }),
    });

    const result = await clearAllTransactions('U1234');
    assert.equal(result.success, false);
    assert.equal(result.reason, 'ERROR');
    assert.equal(result.error, 'Network error');
  } finally {
    supabase.from = originalFrom;
  }
});

test('clearAllTransactions: returns reason POLICY_ERROR when 0 rows deleted', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      delete: () => ({
        eq: () => ({
          select: async () => ({ data: [], error: null }),
        }),
      }),
    });

    const result = await clearAllTransactions('U1234');
    assert.equal(result.success, false);
    assert.equal(result.reason, 'POLICY_ERROR');
  } finally {
    supabase.from = originalFrom;
  }
});

test('hasTransactions: returns false when userId is empty', async () => {
  const result = await hasTransactions(null);
  assert.equal(result, false);
});

test('hasTransactions: returns true when records exist', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          limit: async () => ({ data: [{ id: 1 }], error: null }),
        }),
      }),
    });

    const result = await hasTransactions('U1234');
    assert.equal(result, true);
  } finally {
    supabase.from = originalFrom;
  }
});

test('getTransactions: fetches all records when no date filters provided', async () => {
  const originalFrom = supabase.from;
  const calls = [];
  try {
    supabase.from = () => {
      const q = {
        select: (cols) => { calls.push(['select', cols]); return q; },
        eq: (col, val) => { calls.push(['eq', col, val]); return q; },
        order: (col, opts) => { calls.push(['order', col, opts]); return q; },
        limit: (n) => { calls.push(['limit', n]); return q; },
      };
      q.then = (resolve) => resolve({ data: [{ id: 1, item: 'test' }], error: null });
      return q;
    };

    const result = await getTransactions('U1234');
    assert.deepEqual(result, [{ id: 1, item: 'test' }]);
    assert.ok(calls.some(([method, col, val]) => method === 'eq' && col === 'line_user_id' && val === 'U1234'));
  } finally {
    supabase.from = originalFrom;
  }
});

test('getTransactions: applies gte and lte when dateFrom and dateTo provided', async () => {
  const originalFrom = supabase.from;
  const calls = [];
  try {
    supabase.from = () => {
      const q = {
        select: (cols) => { calls.push(['select', cols]); return q; },
        eq: (col, val) => { calls.push(['eq', col, val]); return q; },
        gte: (col, val) => { calls.push(['gte', col, val]); return q; },
        lte: (col, val) => { calls.push(['lte', col, val]); return q; },
        order: (col, opts) => { calls.push(['order', col, opts]); return q; },
      };
      q.then = (resolve) => resolve({ data: [], error: null });
      return q;
    };

    const result = await getTransactions('U1234', '2026-10-01', '2026-10-07');
    assert.deepEqual(result, []);
    assert.ok(calls.some(([method, col, val]) => method === 'gte' && col === 'date' && val === '2026-10-01'));
    assert.ok(calls.some(([method, col, val]) => method === 'lte' && col === 'date' && val === '2026-10-07'));
  } finally {
    supabase.from = originalFrom;
  }
});

test('getTransactions: returns null on query error', async () => {
  const originalFrom = supabase.from;
  try {
    supabase.from = () => {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
      };
      q.then = (resolve) => resolve({ data: null, error: { message: 'Database error' } });
      return q;
    };

    const result = await getTransactions('U1234');
    assert.equal(result, null);
  } finally {
    supabase.from = originalFrom;
  }
});

