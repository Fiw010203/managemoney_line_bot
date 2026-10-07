const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isDeleteLatestRequest,
  isClearAllRequest,
  isTransactionListRequest,
  isAnalysisRequest,
  parseTransactionListPeriod,
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

test('isTransactionListRequest matches valid keywords', () => {
  assert.equal(isTransactionListRequest('ดูรายการ'), true);
  assert.equal(isTransactionListRequest('ดูรายการทั้งหมด'), true);
  assert.equal(isTransactionListRequest('รายการทั้งหมด'), true);
  assert.equal(isTransactionListRequest('รายการ'), true);
  assert.equal(isTransactionListRequest('ประวัติ'), true);
  assert.equal(isTransactionListRequest('ดูประวัติ'), true);
  assert.equal(isTransactionListRequest('ประวัติรายการ'), true);
  assert.equal(isTransactionListRequest('ดูรายการ วันนี้'), true);
  assert.equal(isTransactionListRequest('ดูรายการ เดือนนี้'), true);
  assert.equal(isTransactionListRequest('รายการวันนี้'), true);
  assert.equal(isTransactionListRequest('list'), true);
  assert.equal(isTransactionListRequest('transactions'), true);

  // Negative cases
  assert.equal(isTransactionListRequest('ลบรายการล่าสุด'), false);
  assert.equal(isTransactionListRequest('ล้างข้อมูล'), false);
  assert.equal(isTransactionListRequest('กินข้าว 80'), false);
  assert.equal(isTransactionListRequest('สรุป'), false);
});

test('isAnalysisRequest does not match ดูรายการ', () => {
  assert.equal(isAnalysisRequest('ดูรายการ'), false);
  assert.equal(isAnalysisRequest('สรุป'), true);
  assert.equal(isAnalysisRequest('วิเคราะห์'), true);
  assert.equal(isAnalysisRequest('รายงาน'), true);
});

test('parseTransactionListPeriod parses dates and defaults to ทั้งหมด', () => {
  const allPeriod = parseTransactionListPeriod('ดูรายการ');
  assert.equal(allPeriod.label, 'ทั้งหมด');
  assert.equal(allPeriod.dateFrom, null);
  assert.equal(allPeriod.dateTo, null);

  const todayPeriod = parseTransactionListPeriod('ดูรายการ วันนี้');
  assert.equal(todayPeriod.label, 'วันนี้');
  assert.notEqual(todayPeriod.dateFrom, null);
  assert.equal(todayPeriod.dateFrom, todayPeriod.dateTo);

  const monthPeriod = parseTransactionListPeriod('ดูรายการ เดือนนี้');
  assert.equal(monthPeriod.label, 'เดือนนี้');
  assert.notEqual(monthPeriod.dateFrom, null);
  assert.notEqual(monthPeriod.dateTo, null);
});
