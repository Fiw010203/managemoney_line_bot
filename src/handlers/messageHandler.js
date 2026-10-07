const { parseExpenseMessage } = require('../services/geminiService');
const {
  appendTransaction,
  clearAllTransactions,
  deleteLatestTransaction,
  getTransactions,
  hasTransactions,
} = require('../services/transactionService');
const {
  CLEAR_ALL_CONFIRM_KEYWORD,
  GENERAL_RESPONSES,
  generateClearAllConfirmReply,
  generateClearAllSuccessReply,
  generateConfirmQuickReply,
  generateDeleteLatestSuccessReply,
  generateFlexSummary,
  generateFlexTransactionList,
  generateMissingFieldReply,
  generateTransactionFlex,
  isAnalysisRequest,
  isClearAllRequest,
  isDeleteLatestRequest,
  isGreeting,
  isHelpRequest,
  isTransactionListRequest,
  parseSummaryPeriod,
  parseTransactionListPeriod,
} = require('../messages');
const { shouldAutoSaveTransaction } = require('../utils/transactionRules');
const { clearPending, getPending, setPending } = require('../state/pendingConfirmations');

const CONFIRM_YES = ['ใช่', 'yes', 'ใช่ครับ', 'ใช่ค่ะ', 'ตกลง', 'ok', 'โอเค', 'ได้', 'บันทึก', 'ถูก', 'ถูกต้อง', '✅', '👍'];
const CONFIRM_NO = ['ไม่', 'no', 'ไม่ใช่', 'ไม่ถูก', 'ผิด', 'ยกเลิก', 'cancel', '❌', '👎'];

async function handleTextMessage(userId, userMessage) {
  const pendingReply = await handlePendingConfirmation(userId, userMessage);
  if (pendingReply) return pendingReply;

  if (isGreeting(userMessage)) {
    return GENERAL_RESPONSES.greeting;
  }

  if (isHelpRequest(userMessage)) {
    return GENERAL_RESPONSES.help;
  }

  if (isDeleteLatestRequest(userMessage)) {
    if (!userId) return GENERAL_RESPONSES.error;
    const result = await deleteLatestTransaction(userId);
    if (result.success) {
      return generateDeleteLatestSuccessReply(result.data);
    }
    if (result.reason === 'NOT_FOUND') {
      return 'ยังไม่มีรายการบันทึกไว้ให้ลบครับ 📭';
    }
    if (result.reason === 'POLICY_ERROR') {
      return '⚠️ ไม่สามารถลบข้อมูลได้ กรุณาเปิดสิทธิ์ DELETE Policy ใน Supabase SQL Editor ก่อนครับ';
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

  if (isTransactionListRequest(userMessage)) {
    if (!userId) return GENERAL_RESPONSES.error;
    return buildTransactionListReply(userId, userMessage);
  }

  if (isAnalysisRequest(userMessage)) {
    return buildSummaryReply(userId, userMessage);
  }

  if (userMessage.length < 2) {
    return GENERAL_RESPONSES.help;
  }

  try {
    console.log(`📩 [${userId || 'unknown'}] "${userMessage}"`);
    const parsed = await parseExpenseMessage(userMessage);
    console.log('🤖 Gemini:', JSON.stringify(parsed));

    if (parsed.missing_fields && parsed.missing_fields.length > 0) {
      return generateMissingFieldReply(parsed.missing_fields, parsed);
    }

    const transactionData = toTransactionData(parsed);
    if (shouldAutoSaveTransaction(parsed, userMessage)) {
      return saveAndBuildReply(transactionData, userId);
    }

    if (userId) {
      setPending(userId, transactionData);
    }

    return generateConfirmQuickReply(transactionData);
  } catch (error) {
    console.error('❌ Error handling message:', error);
    return GENERAL_RESPONSES.error;
  }
}

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
      if (result.reason === 'POLICY_ERROR') {
        return '⚠️ ไม่สามารถล้างข้อมูลได้ กรุณาเปิดสิทธิ์ DELETE Policy ใน Supabase SQL Editor ก่อนครับ';
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

async function buildSummaryReply(userId, userMessage) {
  try {
    const { dateFrom, dateTo, label } = parseSummaryPeriod(userMessage);
    console.log(`📊 วิเคราะห์ ${label}: ${dateFrom} → ${dateTo}`);

    const rows = await getTransactions(userId, dateFrom, dateTo);
    if (rows === null) return GENERAL_RESPONSES.error;

    return generateFlexSummary(rows, label) || GENERAL_RESPONSES.noData;
  } catch (error) {
    console.error('❌ Analysis error:', error);
    return GENERAL_RESPONSES.error;
  }
}

async function buildTransactionListReply(userId, userMessage) {
  try {
    const { dateFrom, dateTo, label } = parseTransactionListPeriod(userMessage);
    console.log(`📋 ดูรายการ ${label}: ${dateFrom || 'all'} → ${dateTo || 'all'}`);

    const rows = await getTransactions(userId, dateFrom, dateTo, { ascending: false });
    if (rows === null) return GENERAL_RESPONSES.error;

    if (rows.length === 0) {
      return label === 'ทั้งหมด'
        ? 'ยังไม่มีรายการบันทึกไว้เลยครับ 📭\nลองพิมพ์บันทึกได้เลย เช่น "กินข้าว 60" หรือ "เงินเดือน 25000"'
        : `ยังไม่มีรายการบันทึกไว้สำหรับ${label}ครับ 📭\nลองพิมพ์ "ดูรายการ" เพื่อดูประวัติทั้งหมดได้ครับ`;
    }

    return generateFlexTransactionList(rows, label);
  } catch (error) {
    console.error('❌ Transaction list error:', error);
    return GENERAL_RESPONSES.error;
  }
}

async function saveAndBuildReply(transactionData, userId) {
  const result = await appendTransaction(transactionData, userId);
  if (result.success) {
    return generateTransactionFlex(transactionData);
  }

  console.error('❌ บันทึกไม่สำเร็จ:', result.error);
  return GENERAL_RESPONSES.error;
}

function toTransactionData(parsed) {
  return {
    item: parsed.item,
    amount: parsed.amount,
    category: parsed.category,
    type: parsed.type,
    date: parsed.date,
  };
}

module.exports = {
  handleTextMessage,
};
