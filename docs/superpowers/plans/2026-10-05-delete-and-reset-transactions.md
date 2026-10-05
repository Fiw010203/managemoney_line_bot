# Delete Latest & Reset All Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement transaction deletion features in ManageMoney LINE bot: "ลบรายการล่าสุด" (delete mistyped last item) and "เคลียร์ข้อมูล / เริ่มใหม่" (safe wipe all records for the user with confirmation prompt).

**Architecture:** 
1. `pendingConfirmations.js` tracks typed pending actions (`TRANSACTION` vs `CLEAR_ALL`).
2. `textReplies.js` exports matchers (`isDeleteLatestRequest`, `isClearAllRequest`) and responses (quick reply confirmation, delete receipt).
3. `transactionService.js` performs `deleteLatestTransaction`, `clearAllTransactions`, and `hasTransactions` via Supabase.
4. `messageHandler.js` handles confirmation interception and command dispatching before forwarding to Gemini AI.

**Tech Stack:** Node.js (CommonJS, v24), Supabase JS Client (`@supabase/supabase-js`), Node test runner (`node --test`).

---

### Task 1: Update Pending Confirmations State Management

**Files:**
- Modify: `src/state/pendingConfirmations.js`
- Test: `test/pendingConfirmations.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/pendingConfirmations.test.js`:
```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pendingConfirmations.test.js`
Expected: FAIL (because current `getPending` returns just `entry.transactionData` rather than an object containing `type`).

- [ ] **Step 3: Update `src/state/pendingConfirmations.js`**

```javascript
const CONFIRM_TTL_MS = 5 * 60 * 1000;
const pendingConfirmations = new Map();

function getPending(userId) {
  const entry = pendingConfirmations.get(userId);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    pendingConfirmations.delete(userId);
    return null;
  }

  return {
    type: entry.type || 'TRANSACTION',
    data: entry.data,
  };
}

function setPending(userId, data, type = 'TRANSACTION') {
  pendingConfirmations.set(userId, {
    data,
    type,
    expiresAt: Date.now() + CONFIRM_TTL_MS,
  });
}

function clearPending(userId) {
  pendingConfirmations.delete(userId);
}

module.exports = {
  clearPending,
  getPending,
  setPending,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/pendingConfirmations.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/pendingConfirmations.js test/pendingConfirmations.test.js
git commit -m "feat(state): support typed pending confirmations (TRANSACTION and CLEAR_ALL)"
```

---

### Task 2: Implement Intent Matchers and Text/Quick-Reply Helpers

**Files:**
- Modify: `src/messages/textReplies.js`
- Test: `test/textReplies.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/textReplies.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isDeleteLatestRequest,
  isClearAllRequest,
  generateDeleteLatestSuccessReply,
  generateClearAllConfirmReply,
  generateClearAllSuccessReply,
  CLEAR_ALL_CONFIRM_KEYWORD,
} = require('../src/messages/textReplies');

test('isDeleteLatestRequest matches valid keywords', () => {
  assert.equal(isDeleteLatestRequest('ลบล่าสุด'), true);
  assert.equal(isDeleteLatestRequest('ลบอันล่าสุด'), true);
  assert.equal(isDeleteLatestRequest('ยกเลิกล่าสุด'), true);
  assert.equal(isDeleteLatestRequest('ลบรายการล่าสุด'), true);
  assert.equal(isDeleteLatestRequest(' ลบเมื่อกี้ '), true);
  assert.equal(isDeleteLatestRequest('กินข้าว 80'), false);
});

test('isClearAllRequest matches valid keywords', () => {
  assert.equal(isClearAllRequest('เคลียร์ข้อมูล'), true);
  assert.equal(isClearAllRequest('ล้างข้อมูล'), true);
  assert.equal(isClearAllRequest('เริ่มใหม่'), true);
  assert.equal(isClearAllRequest('ลบประวัติทั้งหมด'), true);
  assert.equal(isClearAllRequest('รีเซ็ตข้อมูล'), true);
  assert.equal(isClearAllRequest('เคลียร์ใหม่'), true);
  assert.equal(isClearAllRequest('สรุป'), false);
});

test('generateDeleteLatestSuccessReply formats receipt correctly', () => {
  const reply = generateDeleteLatestSuccessReply({
    item: 'ข้าวมันไก่',
    amount: 60,
    type: 'รายจ่าย',
    date: '2026-10-05',
  });
  assert.match(reply, /ลบรายการล่าสุดเรียบร้อยครับ/);
  assert.match(reply, /ข้าวมันไก่/);
  assert.match(reply, /60/);
  assert.match(reply, /2026-10-05/);
});

test('generateClearAllConfirmReply returns quickReply payload', () => {
  const reply = generateClearAllConfirmReply();
  assert.equal(reply.type, 'text');
  assert.match(reply.text, /ต้องการล้างประวัติ/);
  assert.equal(reply.quickReply.items.length, 2);
  assert.equal(reply.quickReply.items[0].action.text, CLEAR_ALL_CONFIRM_KEYWORD);
});

test('generateClearAllSuccessReply returns reset message', () => {
  const reply = generateClearAllSuccessReply();
  assert.match(reply, /ล้างประวัติทั้งหมดเรียบร้อยแล้ว/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/textReplies.test.js`
Expected: FAIL (functions not defined in `src/messages/textReplies.js`).

- [ ] **Step 3: Update `src/messages/textReplies.js`**

Add the new constants and helper functions to `src/messages/textReplies.js` and export them:

```javascript
const CLEAR_ALL_CONFIRM_KEYWORD = 'ยืนยันล้างข้อมูลทั้งหมด';

const DELETE_LATEST_KEYWORDS = ['ลบล่าสุด', 'ลบอันล่าสุด', 'ยกเลิกล่าสุด', 'ลบรายการล่าสุด', 'ลบเมื่อกี้'];
const CLEAR_ALL_KEYWORDS = ['เคลียร์ข้อมูล', 'ล้างข้อมูล', 'เริ่มใหม่', 'ลบประวัติทั้งหมด', 'รีเซ็ตข้อมูล', 'เคลียร์ใหม่'];

function isDeleteLatestRequest(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.trim().toLowerCase();
  return DELETE_LATEST_KEYWORDS.includes(normalized);
}

function isClearAllRequest(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.trim().toLowerCase();
  return CLEAR_ALL_KEYWORDS.includes(normalized);
}

function generateDeleteLatestSuccessReply(tx) {
  return [
    '🗑️ ลบรายการล่าสุดเรียบร้อยครับ:',
    `• ${tx.item} ${formatAmount(tx.amount)} บาท (${tx.type})`,
    `• วันที่: ${tx.date}`,
  ].join('\n');
}

function generateClearAllConfirmReply() {
  return {
    type: 'text',
    text: [
      '⚠️ ต้องการล้างประวัติรายรับ-รายจ่ายทั้งหมดจริงหรือไม่?',
      '(ข้อมูลทั้งหมดของคุณจะถูกลบถาวรและไม่สามารถกู้คืนได้ครับ)',
    ].join('\n'),
    quickReply: {
      items: [
        {
          type: 'action',
          action: { type: 'message', label: 'ยืนยันล้างข้อมูล ⚠️', text: CLEAR_ALL_CONFIRM_KEYWORD },
        },
        {
          type: 'action',
          action: { type: 'message', label: 'ยกเลิก ❌', text: 'ยกเลิก' },
        },
      ],
    },
  };
}

function generateClearAllSuccessReply() {
  return '✨ ล้างประวัติทั้งหมดเรียบร้อยแล้วครับ เริ่มต้นบันทึกใหม่ได้เลย!';
}
```

Update `module.exports` in `src/messages/textReplies.js` to include:
- `CLEAR_ALL_CONFIRM_KEYWORD`
- `isDeleteLatestRequest`
- `isClearAllRequest`
- `generateDeleteLatestSuccessReply`
- `generateClearAllConfirmReply`
- `generateClearAllSuccessReply`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/textReplies.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/messages/textReplies.js test/textReplies.test.js
git commit -m "feat(messages): add delete and clear intent matchers and replies"
```

---

### Task 3: Add Deletion Operations to `transactionService.js`

**Files:**
- Modify: `src/services/transactionService.js`
- Test: `test/transactionService.test.js`

- [ ] **Step 1: Write the failing test with Supabase mocks**

Create `test/transactionService.test.js`:
```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/transactionService.test.js`
Expected: FAIL (functions not defined).

- [ ] **Step 3: Implement functions in `src/services/transactionService.js`**

Add the following functions:
```javascript
async function deleteLatestTransaction(lineUserId) {
  try {
    if (!lineUserId) {
      return { success: false, reason: 'NO_USER_ID', error: 'Missing line_user_id' };
    }

    const { data: latest, error: selectError } = await supabase
      .from(TABLE)
      .select('id, item, amount, category, type, date')
      .eq('line_user_id', lineUserId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error('❌ Supabase Find Latest Error:', selectError.message);
      return { success: false, reason: 'ERROR', error: selectError.message };
    }

    if (!latest) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', latest.id);

    if (deleteError) {
      console.error('❌ Supabase Delete Error:', deleteError.message);
      return { success: false, reason: 'ERROR', error: deleteError.message };
    }

    console.log(`🗑️ ลบรายการ: ${latest.id} | ${latest.item} | ${latest.amount}`);
    return { success: true, data: latest };
  } catch (error) {
    console.error('❌ Supabase Delete Exception:', error.message);
    return { success: false, reason: 'ERROR', error: error.message };
  }
}

async function clearAllTransactions(lineUserId) {
  try {
    if (!lineUserId) {
      return { success: false, reason: 'NO_USER_ID', error: 'Missing line_user_id' };
    }

    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('line_user_id', lineUserId);

    if (error) {
      console.error('❌ Supabase Clear All Error:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`✨ ล้างข้อมูลทั้งหมดของ user: ${lineUserId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Supabase Clear All Exception:', error.message);
    return { success: false, error: error.message };
  }
}

async function hasTransactions(lineUserId) {
  try {
    if (!lineUserId) return false;
    const { data, error } = await supabase
      .from(TABLE)
      .select('id')
      .eq('line_user_id', lineUserId)
      .limit(1);

    if (error || !data) return false;
    return data.length > 0;
  } catch (error) {
    return false;
  }
}
```

Export `deleteLatestTransaction`, `clearAllTransactions`, and `hasTransactions` from `src/services/transactionService.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/transactionService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/transactionService.js test/transactionService.test.js
git commit -m "feat(services): add deleteLatestTransaction, clearAllTransactions, and hasTransactions"
```

---

### Task 4: Integrate Commands in `messageHandler.js`

**Files:**
- Modify: `src/handlers/messageHandler.js`
- Test: `test/messageHandler.test.js`

- [ ] **Step 1: Write integration tests for `messageHandler`**

Create `test/messageHandler.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { handleTextMessage } = require('../src/handlers/messageHandler');
const { setPending, clearPending, getPending } = require('../src/state/pendingConfirmations');
const { CLEAR_ALL_CONFIRM_KEYWORD } = require('../src/messages/textReplies');

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/messageHandler.test.js`
Expected: FAIL (handler does not handle `CLEAR_ALL` confirmation type).

- [ ] **Step 3: Update `src/handlers/messageHandler.js`**

1. Import new dependencies:
   ```javascript
   const {
     deleteLatestTransaction,
     clearAllTransactions,
     hasTransactions,
   } = require('../services/transactionService');
   const {
     CLEAR_ALL_CONFIRM_KEYWORD,
     isDeleteLatestRequest,
     isClearAllRequest,
     generateDeleteLatestSuccessReply,
     generateClearAllConfirmReply,
     generateClearAllSuccessReply,
   } = require('../messages');
   ```

2. Update `handlePendingConfirmation`:
   ```javascript
   async function handlePendingConfirmation(userId, userMessage) {
     if (!userId) return null;

     const pending = getPending(userId);
     if (!pending) return null;

     const normalizedMessage = userMessage.toLowerCase().trim();

     // Case 1: CLEAR_ALL confirmation
     if (pending.type === 'CLEAR_ALL') {
       clearPending(userId);
       if (normalizedMessage === CLEAR_ALL_CONFIRM_KEYWORD.toLowerCase()) {
         const result = await clearAllTransactions(userId);
         if (result.success) {
           return generateClearAllSuccessReply();
         }
         return GENERAL_RESPONSES.error;
       }
       return 'ยกเลิกการล้างข้อมูลแล้วครับ';
     }

     // Case 2: TRANSACTION confirmation
     const pendingData = pending.data;
     if (CONFIRM_YES.some((word) => normalizedMessage === word)) {
       clearPending(userId);
       return saveAndBuildReply(pendingData, userId);
     }

     if (CONFIRM_NO.some((word) => normalizedMessage === word)) {
       clearPending(userId);
       return 'ยกเลิกแล้วครับ ถ้าจะบันทึกใหม่ พิมพ์รายการมาได้เลย';
     }

     clearPending(userId);
     return null;
   }
   ```

3. Update `handleTextMessage` to check delete commands before Gemini parsing:
   ```javascript
   if (isDeleteLatestRequest(userMessage)) {
     if (!userId) return GENERAL_RESPONSES.error;
     const result = await deleteLatestTransaction(userId);
     if (result.success) {
       return generateDeleteLatestSuccessReply(result.data);
     }
     if (result.reason === 'NOT_FOUND') {
       return 'ยังไม่มีรายการบันทึกไว้ให้ลบครับ 📭';
     }
     return GENERAL_RESPONSES.error;
   }

   if (isClearAllRequest(userMessage)) {
     if (!userId) return GENERAL_RESPONSES.error;
     const hasData = await hasTransactions(userId);
     if (!hasData) {
       return 'ยังไม่มีประวัติให้ล้างครับ 📭';
     }
     setPending(userId, null, 'CLEAR_ALL');
     return generateClearAllConfirmReply();
   }
   ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/messageHandler.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/messageHandler.js test/messageHandler.test.js
git commit -m "feat(handler): integrate delete latest and clear all transactions"
```

---

### Task 5: Documentation & Full Test Suite Verification

**Files:**
- Modify: `README.md`
- Run: `node --test`

- [ ] **Step 1: Update `README.md`**

1. In Supabase SQL section (Step 5), add:
```sql
CREATE POLICY "Allow all deletes" ON transactions
  FOR DELETE USING (true);
```
2. In example table (Section 2), add:
```markdown
| ลบล่าสุด / ลบอันล่าสุด | ลบรายการล่าสุดที่เพิ่งบันทึก |
| เคลียร์ข้อมูล / เริ่มใหม่ | ล้างประวัติทั้งหมดของผู้ใช้ (มีปุ่มกดยืนยันก่อนลบ) |
```
3. In `GENERAL_RESPONSES.help` (in `src/messages/textReplies.js`), update help text to mention delete commands.

- [ ] **Step 2: Run all test suites**

Run: `node --test test/*.test.js`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add README.md src/messages/textReplies.js
git commit -m "docs: update README and help text with delete and reset commands"
```
