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
