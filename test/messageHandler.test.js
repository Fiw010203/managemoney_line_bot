const test = require('node:test');
const assert = require('node:assert/strict');
const { handleTextMessage } = require('../src/handlers/messageHandler');
const { setPending, clearPending, getPending } = require('../src/state/pendingConfirmations');
const {
  CLEAR_ALL_CONFIRM_KEYWORD,
  GENERAL_RESPONSES,
  generateClearAllConfirmReply,
  generateClearAllSuccessReply,
} = require('../src/messages');
const { supabase } = require('../src/services/transactionService');

test('handleTextMessage: handles pending CLEAR_ALL cancellation', async () => {
  const userId = 'user_handler_test_1';
  setPending(userId, null, 'CLEAR_ALL');

  const reply = await handleTextMessage(userId, 'ยกเลิก');
  assert.equal(reply, 'ยกเลิกการล้างข้อมูลแล้วครับ');
  assert.equal(getPending(userId), null);
});

test('handleTextMessage: handles pending CLEAR_ALL invalid word as cancellation', async () => {
  const userId = 'user_handler_test_2';
  setPending(userId, null, 'CLEAR_ALL');

  const reply = await handleTextMessage(userId, 'อะไรนะ');
  assert.equal(reply, 'ยกเลิกการล้างข้อมูลแล้วครับ');
  assert.equal(getPending(userId), null);
});

test('handleTextMessage: pending CLEAR_ALL with keyword confirms and clears data', async () => {
  const userId = 'user_handler_test_3';
  setPending(userId, null, 'CLEAR_ALL');

  const originalFrom = supabase.from;
  let deletedUserId = null;
  try {
    supabase.from = () => ({
      delete: () => ({
        eq: (col, val) => {
          if (col === 'line_user_id') deletedUserId = val;
          return {
            select: async () => ({ data: [{ id: 1 }], error: null }),
          };
        },
      }),
    });

    const reply = await handleTextMessage(userId, CLEAR_ALL_CONFIRM_KEYWORD);
    assert.equal(reply, generateClearAllSuccessReply());
    assert.equal(deletedUserId, userId);
    assert.equal(getPending(userId), null);
  } finally {
    supabase.from = originalFrom;
  }
});

test('handleTextMessage: pending CLEAR_ALL returns error on clearAll failure', async () => {
  const userId = 'user_handler_test_3_err';
  setPending(userId, null, 'CLEAR_ALL');

  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      delete: () => ({
        eq: () => ({
          select: async () => ({ data: null, error: { message: 'Delete error' } }),
        }),
      }),
    });

    const reply = await handleTextMessage(userId, CLEAR_ALL_CONFIRM_KEYWORD);
    assert.equal(reply, GENERAL_RESPONSES.error);
    assert.equal(getPending(userId), null);
  } finally {
    supabase.from = originalFrom;
  }
});

test('handleTextMessage: pending CLEAR_ALL returns policy notice on POLICY_ERROR', async () => {
  const userId = 'user_handler_test_3_policy';
  setPending(userId, null, 'CLEAR_ALL');

  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      delete: () => ({
        eq: () => ({
          select: async () => ({ data: [], error: null }),
        }),
      }),
    });

    const reply = await handleTextMessage(userId, CLEAR_ALL_CONFIRM_KEYWORD);
    assert.match(reply, /DELETE Policy/);
    assert.equal(getPending(userId), null);
  } finally {
    supabase.from = originalFrom;
  }
});

test('handleTextMessage: triggers deleteLatestTransaction on isDeleteLatestRequest', async () => {
  const userId = 'user_handler_test_4';
  const originalFrom = supabase.from;
  try {
    const fakeRow = {
      id: 99,
      item: 'กะเพราหมูกรอบ',
      amount: 65,
      category: 'อาหาร',
      type: 'รายจ่าย',
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
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: async () => ({ data: [fakeRow], error: null }),
          }),
        }),
      }),
    });

    const reply = await handleTextMessage(userId, 'ลบล่าสุด');
    assert.match(reply, /ลบรายการล่าสุดเรียบร้อยครับ/);
    assert.match(reply, /กะเพราหมูกรอบ 65 บาท/);
  } finally {
    supabase.from = originalFrom;
  }
});

test('handleTextMessage: deleteLatestTransaction returns policy notice on POLICY_ERROR', async () => {
  const userId = 'user_handler_test_4_policy';
  const originalFrom = supabase.from;
  try {
    const fakeRow = {
      id: 99,
      item: 'กะเพราหมูกรอบ',
      amount: 65,
      category: 'อาหาร',
      type: 'รายจ่าย',
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
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    });

    const reply = await handleTextMessage(userId, 'ลบล่าสุด');
    assert.match(reply, /DELETE Policy/);
  } finally {
    supabase.from = originalFrom;
  }
});

test('handleTextMessage: deleteLatestTransaction returns not-found message when empty', async () => {
  const userId = 'user_handler_test_5';
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

    const reply = await handleTextMessage(userId, 'ลบรายการล่าสุด');
    assert.equal(reply, 'ยังไม่มีรายการบันทึกไว้ให้ลบครับ 📭');
  } finally {
    supabase.from = originalFrom;
  }
});

test('handleTextMessage: deleteLatest returns error if userId is missing', async () => {
  const reply = await handleTextMessage(null, 'ลบล่าสุด');
  assert.equal(reply, GENERAL_RESPONSES.error);
});

test('handleTextMessage: triggers generateClearAllConfirmReply on isClearAllRequest when has transactions', async () => {
  const userId = 'user_handler_test_6';
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          limit: async () => ({ data: [{ id: 1 }], error: null }),
        }),
      }),
    });

    const reply = await handleTextMessage(userId, 'ล้างข้อมูล');
    assert.deepEqual(reply, generateClearAllConfirmReply());
    const pending = getPending(userId);
    assert.notEqual(pending, null);
    assert.equal(pending.type, 'CLEAR_ALL');
  } finally {
    supabase.from = originalFrom;
    clearPending(userId);
  }
});

test('handleTextMessage: isClearAllRequest returns no data message when hasTransactions is false', async () => {
  const userId = 'user_handler_test_7';
  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      select: () => ({
        eq: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    });

    const reply = await handleTextMessage(userId, 'ล้างข้อมูล');
    assert.equal(reply, 'ยังไม่มีประวัติให้ล้างครับ 📭');
    assert.equal(getPending(userId), null);
  } finally {
    supabase.from = originalFrom;
  }
});

test('handleTextMessage: isClearAllRequest returns error when userId is missing', async () => {
  const reply = await handleTextMessage(null, 'ล้างข้อมูล');
  assert.equal(reply, GENERAL_RESPONSES.error);
});

test('handleTextMessage: handles pending TRANSACTION confirmation with yes', async () => {
  const userId = 'user_handler_test_8';
  const txData = {
    item: 'ชาเขียว',
    amount: 55,
    category: 'อาหาร',
    type: 'รายจ่าย',
    date: '2026-10-05',
  };
  setPending(userId, txData, 'TRANSACTION');

  const originalFrom = supabase.from;
  try {
    supabase.from = () => ({
      insert: () => ({
        select: async () => ({ data: [txData], error: null }),
      }),
    });

    const reply = await handleTextMessage(userId, 'ใช่');
    assert.equal(reply.type, 'flex');
    assert.match(reply.altText, /บันทึกรายจ่ายแล้ว/);
    assert.equal(getPending(userId), null);
  } finally {
    supabase.from = originalFrom;
    clearPending(userId);
  }
});

test('handleTextMessage: handles pending TRANSACTION confirmation with no', async () => {
  const userId = 'user_handler_test_9';
  const txData = {
    item: 'ชาเขียว',
    amount: 55,
    category: 'อาหาร',
    type: 'รายจ่าย',
    date: '2026-10-05',
  };
  setPending(userId, txData);

  const reply = await handleTextMessage(userId, 'ไม่ใช่');
  assert.equal(reply, 'ยกเลิกแล้วครับ ถ้าจะบันทึกใหม่ พิมพ์รายการมาได้เลย');
  assert.equal(getPending(userId), null);
});

test('handleTextMessage: pending TRANSACTION confirmation with unrelated text clears pending and processes text', async () => {
  const userId = 'user_handler_test_10';
  const txData = {
    item: 'ชาเขียว',
    amount: 55,
    category: 'อาหาร',
    type: 'รายจ่าย',
    date: '2026-10-05',
  };
  setPending(userId, txData);

  const reply = await handleTextMessage(userId, 'สวัสดี');
  assert.equal(reply, GENERAL_RESPONSES.greeting);
  assert.equal(getPending(userId), null);
});
