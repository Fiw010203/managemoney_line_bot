/**
 * Transaction Service
 * เชื่อมต่อ อ่าน และเขียนข้อมูลธุรกรรมลง Supabase (PostgreSQL)
 */
const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);
const TABLE = config.supabase.table;

function toTransactionRow(data, lineUserId = null) {
  const { item, amount, category, type, date } = data;
  return {
    item,
    amount,
    category,
    type,
    date,
    line_user_id: lineUserId,
  };
}

async function appendTransaction(data, lineUserId = null) {
  try {
    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert([toTransactionRow(data, lineUserId)])
      .select();

    if (error) {
      console.error('❌ Supabase Insert Error:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`✅ บันทึก: ${data.item} | ${data.amount} | ${data.category} | ${data.type} | ${data.date}`);
    return { success: true, data: inserted };
  } catch (error) {
    console.error('❌ Supabase Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function getTransactions(lineUserId, dateFrom, dateTo) {
  try {
    let query = supabase
      .from(TABLE)
      .select('item, amount, category, type, date')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true });

    if (lineUserId) {
      query = query.eq('line_user_id', lineUserId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Supabase Select Error:', error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Supabase Error:', error.message);
    return null;
  }
}

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

async function testConnection() {
  try {
    const { error } = await supabase.from(TABLE).select('id').limit(1);
    if (error) {
      console.error('❌ ไม่สามารถเชื่อมต่อ Supabase:', error.message);
      return false;
    }
    console.log('✅ เชื่อมต่อ Supabase สำเร็จ');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    return false;
  }
}

module.exports = {
  appendTransaction,
  clearAllTransactions,
  deleteLatestTransaction,
  getTransactions,
  hasTransactions,
  supabase,
  testConnection,
};

