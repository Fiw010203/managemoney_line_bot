const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateFlexTransactionList,
  formatThaiDateHeader,
  MAX_DISPLAY_ITEMS,
} = require('../src/messages/flexTransactionList');

test('generateFlexTransactionList: returns null for empty or invalid rows', () => {
  assert.equal(generateFlexTransactionList([]), null);
  assert.equal(generateFlexTransactionList(null), null);
});

test('generateFlexTransactionList: builds valid flex payload with metrics and items', () => {
  const rows = [
    {
      id: 1,
      item: 'เงินเดือน',
      amount: 30000,
      category: 'เงินเดือน',
      type: 'รายรับ',
      date: '2026-10-07',
    },
    {
      id: 2,
      item: 'ข้าวมันไก่',
      amount: 60,
      category: 'อาหาร',
      type: 'รายจ่าย',
      date: '2026-10-07',
    },
    {
      id: 3,
      item: 'ค่ารถไฟฟ้า',
      amount: 45,
      category: 'เดินทาง',
      type: 'รายจ่าย',
      date: '2026-10-06',
    },
  ];

  const flex = generateFlexTransactionList(rows, 'ทั้งหมด');
  assert.equal(flex.type, 'flex');
  assert.match(flex.altText, /3 รายการ/);
  assert.match(flex.altText, /30,000/);
  assert.match(flex.altText, /105/);

  const bubble = flex.contents;
  assert.equal(bubble.type, 'bubble');
  assert.equal(bubble.size, 'mega');
  assert.equal(bubble.header.type, 'box');
  assert.equal(bubble.body.type, 'box');
  assert.equal(bubble.footer.type, 'box');

  // Check quickReply
  assert.ok(flex.quickReply);
  assert.ok(flex.quickReply.items.length >= 3);
});

test('generateFlexTransactionList: handles more than MAX_DISPLAY_ITEMS', () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    item: `รายการ ${i + 1}`,
    amount: 100,
    category: 'อาหาร',
    type: 'รายจ่าย',
    date: '2026-10-05',
  }));

  const flex = generateFlexTransactionList(rows, 'ทั้งหมด');
  assert.equal(flex.type, 'flex');
  assert.match(flex.altText, /25 รายการ/);

  // Footer should mention displaying MAX_DISPLAY_ITEMS
  const footerTexts = JSON.stringify(flex.contents.footer);
  assert.match(footerTexts, new RegExp(`${MAX_DISPLAY_ITEMS} รายการล่าสุด`));
});

test('formatThaiDateHeader formats dates correctly', () => {
  const header = formatThaiDateHeader('2026-10-07');
  assert.match(header, /📅/);
  assert.match(formatThaiDateHeader(null), /ไม่ระบุวันที่/);
});
