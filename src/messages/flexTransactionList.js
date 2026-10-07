const { formatAmount } = require('./textReplies');

const CATEGORY_EMOJI = {
  อาหาร: '🍽️',
  เดินทาง: '🚗',
  ที่พัก: '🏠',
  ค่าน้ำค่าไฟ: '💡',
  ช้อปปิ้ง: '🛍️',
  สุขภาพ: '❤️',
  การศึกษา: '📚',
  บันเทิง: '🎬',
  เงินเดือน: '💼',
  โบนัส: '🎊',
  งานเสริม: '💪',
  ขายของ: '📦',
  ของขวัญ: '🎁',
  อื่นๆ: '📌',
};

function sumAmount(rows) {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function makeText(text, options = {}) {
  return {
    type: 'text',
    text: String(text),
    size: options.size || 'sm',
    color: options.color || '#334155',
    weight: options.weight,
    align: options.align,
    flex: options.flex,
    margin: options.margin,
    wrap: options.wrap,
    maxLines: options.maxLines,
    gravity: options.gravity,
  };
}

function makeMetricCard(label, value, color, backgroundColor) {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor,
    cornerRadius: '12px',
    paddingAll: '10px',
    flex: 1,
    contents: [
      makeText(label, { size: 'xs', color, weight: 'bold' }),
      makeText(value, { size: 'md', color, weight: 'bold', maxLines: 1 }),
    ],
  };
}

function formatThaiDateHeader(dateStr) {
  if (!dateStr) return '📅 ไม่ระบุวันที่';

  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;

  const yesterday = new Date(now);
  yesterday.setUTCDate(now.getUTCDate() - 1);
  const yesterdayStr = `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth() + 1)}-${pad(yesterday.getUTCDate())}`;

  const [year, month, day] = String(dateStr).split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const formatted = !Number.isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Bangkok',
      })
    : dateStr;

  if (dateStr === todayStr) {
    return `📅 วันนี้ • ${formatted}`;
  }
  if (dateStr === yesterdayStr) {
    return `📅 เมื่อวาน • ${formatted}`;
  }
  return `📅 ${formatted}`;
}

function groupByDate(rows) {
  const groups = {};
  for (const row of rows) {
    const d = row.date || 'unknown';
    if (!groups[d]) {
      groups[d] = [];
    }
    groups[d].push(row);
  }
  return groups;
}

function makeTransactionItemRow(row) {
  const isIncome = row.type === 'รายรับ';
  const color = isIncome ? '#059669' : '#DC2626';
  const sign = isIncome ? '+' : '-';
  const emoji = CATEGORY_EMOJI[row.category] || (isIncome ? '💰' : '📌');

  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'md',
    margin: 'sm',
    alignItems: 'center',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: isIncome ? '#ECFDF5' : '#FEF2F2',
        cornerRadius: '10px',
        paddingAll: '6px',
        width: '32px',
        height: '32px',
        justifyContent: 'center',
        alignItems: 'center',
        contents: [
          makeText(emoji, { size: 'sm', align: 'center', gravity: 'center' }),
        ],
      },
      {
        type: 'box',
        layout: 'vertical',
        flex: 4,
        contents: [
          makeText(row.item, { size: 'sm', weight: 'bold', color: '#0F172A', maxLines: 1 }),
          makeText(row.category, { size: 'xxs', color: '#64748B', maxLines: 1 }),
        ],
      },
      {
        type: 'box',
        layout: 'vertical',
        flex: 3,
        contents: [
          makeText(`${sign}${formatAmount(row.amount)} ฿`, {
            size: 'sm',
            weight: 'bold',
            color,
            align: 'end',
            maxLines: 1,
          }),
          makeText(row.type, {
            size: 'xxs',
            color: isIncome ? '#059669' : '#DC2626',
            align: 'end',
          }),
        ],
      },
    ],
  };
}

const MAX_DISPLAY_ITEMS = 20;

function generateFlexTransactionList(rows, label = 'ทั้งหมด') {
  if (!rows || rows.length === 0) return null;

  const incomeRows = rows.filter((r) => r.type === 'รายรับ');
  const expenseRows = rows.filter((r) => r.type === 'รายจ่าย');
  const totalIncome = sumAmount(incomeRows);
  const totalExpense = sumAmount(expenseRows);
  const net = totalIncome - totalExpense;
  const netColor = net >= 0 ? '#059669' : '#DC2626';
  const netSign = net >= 0 ? '+' : '-';

  const displayRows = rows.slice(0, MAX_DISPLAY_ITEMS);
  const groups = groupByDate(displayRows);

  const transactionListContents = [];
  const dates = Object.keys(groups);

  dates.forEach((dateStr, index) => {
    transactionListContents.push({
      type: 'box',
      layout: 'vertical',
      margin: index === 0 ? 'sm' : 'md',
      paddingTop: '4px',
      paddingBottom: '2px',
      contents: [
        makeText(formatThaiDateHeader(dateStr), {
          size: 'xs',
          weight: 'bold',
          color: '#475569',
        }),
      ],
    });

    groups[dateStr].forEach((row) => {
      transactionListContents.push(makeTransactionItemRow(row));
    });

    if (index < dates.length - 1) {
      transactionListContents.push({
        type: 'separator',
        margin: 'md',
        color: '#F1F5F9',
      });
    }
  });

  const subtitle = label === 'ทั้งหมด' ? 'ประวัติรายรับ-รายจ่ายทั้งหมด' : `ช่วงเวลา: ${label}`;

  const bubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '18px',
      backgroundColor: '#0F172A',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          alignItems: 'center',
          contents: [
            makeText('📋 รายการรายรับ-รายจ่าย', {
              size: 'md',
              color: '#FFFFFF',
              weight: 'bold',
              flex: 1,
            }),
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#334155',
              cornerRadius: '16px',
              paddingStart: '8px',
              paddingEnd: '8px',
              paddingTop: '3px',
              paddingBottom: '3px',
              contents: [
                makeText(`${rows.length} รายการ`, {
                  size: 'xxs',
                  color: '#F8FAFC',
                  weight: 'bold',
                }),
              ],
            },
          ],
        },
        makeText(subtitle, {
          size: 'xs',
          color: '#94A3B8',
          margin: 'xs',
        }),
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'sm',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            makeMetricCard('รายรับ', `+${formatAmount(totalIncome)} ฿`, '#047857', '#ECFDF5'),
            makeMetricCard('รายจ่าย', `-${formatAmount(totalExpense)} ฿`, '#B91C1C', '#FEF2F2'),
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          backgroundColor: net >= 0 ? '#F0FDF4' : '#FFF1F2',
          cornerRadius: '12px',
          paddingAll: '10px',
          paddingStart: '14px',
          paddingEnd: '14px',
          margin: 'sm',
          alignItems: 'center',
          contents: [
            makeText('คงเหลือสุทธิ', { flex: 2, size: 'xs', color: netColor, weight: 'bold' }),
            makeText(`${netSign}${formatAmount(Math.abs(net))} ฿`, {
              flex: 3,
              size: 'sm',
              color: netColor,
              weight: 'bold',
              align: 'end',
            }),
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'lg',
          contents: [
            makeText('รายการบันทึก', { size: 'xs', color: '#64748B', weight: 'bold', flex: 1 }),
            makeText('ล่าสุดอยู่บน', { size: 'xxs', color: '#94A3B8', align: 'end' }),
          ],
        },
        ...transactionListContents,
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '14px',
      spacing: 'sm',
      backgroundColor: '#F8FAFC',
      contents: [
        ...(rows.length > MAX_DISPLAY_ITEMS
          ? [
              makeText(`แสดง ${MAX_DISPLAY_ITEMS} รายการล่าสุด (จากทั้งหมด ${rows.length} รายการ)`, {
                size: 'xs',
                color: '#64748B',
                align: 'center',
              }),
              makeText('พิมพ์ "ดูรายการ วันนี้" หรือ "ดูรายการ เดือนนี้" เพื่อกรองดูช่วงเวลา', {
                size: 'xxs',
                color: '#94A3B8',
                align: 'center',
                margin: 'xs',
              }),
            ]
          : []),
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          margin: rows.length > MAX_DISPLAY_ITEMS ? 'sm' : 'none',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'message',
                label: '📊 สรุปภาพรวม',
                text: 'สรุป',
              },
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'message',
                label: '🗑️ ลบล่าสุด',
                text: 'ลบล่าสุด',
              },
            },
          ],
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `📋 รายการรายรับ-รายจ่าย (${label}): ${rows.length} รายการ (รับ ${formatAmount(totalIncome)} จ่าย ${formatAmount(totalExpense)})`,
    contents: bubble,
    quickReply: {
      items: [
        {
          type: 'action',
          action: { type: 'message', label: '📋 ทั้งหมด', text: 'ดูรายการ' },
        },
        {
          type: 'action',
          action: { type: 'message', label: '📅 วันนี้', text: 'ดูรายการ วันนี้' },
        },
        {
          type: 'action',
          action: { type: 'message', label: '🗓️ เดือนนี้', text: 'ดูรายการ เดือนนี้' },
        },
        {
          type: 'action',
          action: { type: 'message', label: '📊 สรุป', text: 'สรุป' },
        },
      ],
    },
  };
}

module.exports = {
  generateFlexTransactionList,
  formatThaiDateHeader,
  makeTransactionItemRow,
  MAX_DISPLAY_ITEMS,
};
