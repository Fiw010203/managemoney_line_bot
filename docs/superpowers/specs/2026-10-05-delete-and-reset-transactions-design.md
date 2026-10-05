# Design Specification: Delete Latest & Reset All Transactions

## Overview
เพิ่มความสามารถในการจัดการประวัติธุรกรรมสำหรับผู้ใช้ LINE Bot:
1. **ลบรายการล่าสุด (Delete Latest Transaction)**: ลบรายการล่าสุดที่เพิ่งบันทึกผิด
2. **เคลียร์ประวัติทั้งหมด (Reset / Clear All Transactions)**: ลบข้อมูลธุรกรรมทั้งหมดของผู้ใช้นั้นเพื่อเริ่มนับหนึ่งใหม่ พร้อมระบบยืนยันความปลอดภัย (Confirmation Gate)

## Scope & User Commands

### 1. ลบรายการล่าสุด (Delete Latest)
- **คำสั่งที่รองรับ:** `ลบล่าสุด`, `ลบอันล่าสุด`, `ยกเลิกล่าสุด`, `ลบรายการล่าสุด`, `ลบเมื่อกี้`
- **พฤติกรรมของระบบ:**
  1. ดึงรายการล่าสุดของผู้ใช้จากตาราง `transactions` โดยค้นหาตาม `line_user_id` เรียงตาม `id DESC LIMIT 1`
  2. หากไม่พบรายการ ตอบกลับ: `"ยังไม่มีรายการบันทึกไว้ให้ลบครับ 📭"`
  3. หากพบรายการ:
     - ลบรายการออกจากฐานข้อมูลด้วย `id`
     - ส่งข้อความตอบกลับยืนยัน:
       ```text
       🗑️ ลบรายการล่าสุดเรียบร้อยครับ:
       • [ชื่อรายการ] [จำนวนเงิน] บาท ([ประเภท])
       • วันที่: [YYYY-MM-DD]
       ```

### 2. เคลียร์ประวัติทั้งหมด (Clear All / Reset)
- **คำสั่งที่รองรับ:** `เคลียร์ข้อมูล`, `ล้างข้อมูล`, `เริ่มใหม่`, `ลบประวัติทั้งหมด`, `รีเซ็ตข้อมูล`, `เคลียร์ใหม่`
- **พฤติกรรมของระบบ:**
  1. ตรวจสอบว่าผู้ใช้มีรายการในระบบหรือไม่ หากไม่มีตอบกลับ: `"ยังไม่มีประวัติให้ล้างครับ 📭"`
  2. หากมีข้อมูล ให้ตั้งสถานะ `pendingConfirmation` ของผู้ใช้เป็น `{ type: 'CLEAR_ALL' }`
  3. ส่งข้อความเตือนความปลอดภัยพร้อม Quick Reply:
     - ข้อความ:
       ```text
       ⚠️ ต้องการล้างประวัติรายรับ-รายจ่ายทั้งหมดจริงหรือไม่?
       (ข้อมูลทั้งหมดของคุณจะถูกลบถาวรและไม่สามารถกู้คืนได้ครับ)
       ```
     - Quick Reply Items:
       1. Action: Message, Label: `ยืนยันล้างข้อมูล ⚠️`, Text: `ยืนยันล้างข้อมูลทั้งหมด`
       2. Action: Message, Label: `ยกเลิก ❌`, Text: `ยกเลิก`
  4. เมื่อผู้ใช้ตอบกลับ:
     - หากตอบ `ยืนยันล้างข้อมูลทั้งหมด`:
       - ลบรายการทั้งหมดในฐานข้อมูลที่มี `line_user_id` ตรงกับผู้ใช้
       - เคลียร์สถานะ pending
       - ตอบกลับ: `"✨ ล้างประวัติทั้งหมดเรียบร้อยแล้วครับ เริ่มต้นบันทึกใหม่ได้เลย!"`
     - หากตอบ `ยกเลิก` หรือข้อความอื่นๆ:
       - เคลียร์สถานะ pending
       - ตอบกลับ: `"ยกเลิกการล้างข้อมูลแล้วครับ"`

## Technical Architecture & Components

### 1. Database (Supabase)
- ตาราง `transactions` ปัจจุบันเปิดใช้งาน Row Level Security (RLS) แต่มีเพียง policy สำหรับ `INSERT` และ `SELECT`
- ต้องเพิ่ม policy สำหรับการ `DELETE`:
  ```sql
  CREATE POLICY "Allow all deletes" ON transactions
    FOR DELETE USING (true);
  ```

### 2. State Management (`src/state/pendingConfirmations.js`)
- ปรับโครงสร้างเพื่อรองรับประเภทของ pending action:
  - `TRANSACTION`: รอการยืนยันบันทึกธุรกรรม (เมื่อ Gemini วิเคราะห์ได้ confidence ต่ำ)
  - `CLEAR_ALL`: รอการยืนยันล้างข้อมูลทั้งหมด
- เมธอดคงเดิม: `setPending(userId, data, type = 'TRANSACTION')`, `getPending(userId)`, `clearPending(userId)` โดย `getPending` คืนค่า `{ type, data }` หรือ object ที่ระบุ `type` ชัดเจน

### 3. Service Layer (`src/services/transactionService.js`)
- เพิ่มฟังก์ชัน `deleteLatestTransaction(lineUserId)`:
  - Query: `select('*').eq('line_user_id', lineUserId).order('id', { ascending: false }).limit(1).maybeSingle()`
  - Delete: `delete().eq('id', record.id)`
  - ส่งคืน `{ success: true, data: record }` หรือ `{ success: false, reason: 'NOT_FOUND' | 'ERROR', error }`
- เพิ่มฟังก์ชัน `clearAllTransactions(lineUserId)`:
  - Query ตรวจสอบก่อนหรือ Delete ทันที: `delete().eq('line_user_id', lineUserId)`
  - ส่งคืน `{ success: true }` หรือ `{ success: false, error }`
- เพิ่มฟังก์ชัน `hasTransactions(lineUserId)`:
  - ตรวจสอบว่ามีข้อมูลก่อนเริ่มกระบวนการยืนยันล้างข้อมูลหรือไม่

### 4. Text & Intent Helpers (`src/messages/textReplies.js`)
- เพิ่ม Intent Matchers:
  - `isDeleteLatestRequest(text)`
  - `isClearAllRequest(text)`
- เพิ่ม Response Generators:
  - `generateDeleteLatestSuccessReply(transaction)`
  - `generateClearAllConfirmReply()`
  - `generateClearAllSuccessReply()`
  - `generateCancelReply()`

### 5. Message Handler (`src/handlers/messageHandler.js`)
- จัดลำดับการประมวลผลข้อความ:
  1. ตรวจสอบ Pending Confirmation ก่อน (รองรับทั้ง `TRANSACTION` และ `CLEAR_ALL`)
  2. ตรวจสอบ Greeting / Help / Analysis / Summary
  3. **ตรวจสอบคำสั่งลบประวัติ (`isDeleteLatestRequest`, `isClearAllRequest`)** เพื่อทำงานทันทีโดยไม่ต้องส่งไปให้ Gemini AI
  4. หากไม่ใช่คำสั่งเฉพาะ ให้ส่งต่อไปยัง Gemini AI เพื่อแยกแยะรายการรายรับ-รายจ่าย

## Error Handling & Edge Cases
1. **User ID เป็น null**: แจ้งเตือนข้อผิดพลาดว่าไม่สามารถระบุตัวตนผู้ใช้ได้
2. **Supabase Delete Policy ขาดหาย**: หาก error เกิดจาก permission ให้แจ้งผู้ใช้พร้อมแสดง log ฝั่ง server
3. **ยกเลิกอัตโนมัติ**: หากอยู่ในสถานะรอเคลียร์ข้อมูล แต่ผู้ใช้พิมพ์รายการบัญชีใหม่เข้ามา (ไม่ใช่คำยืนยัน) ให้เคลียร์สถานะ pending ทิ้งแล้วตอบกลับว่ายกเลิกการล้างข้อมูล หรือประมวลผลรายการใหม่ตามความเหมาะสม

## Testing & Verification Plan
1. **Manual / Integration Test Scenarios**:
   - บันทึกรายการใหม่ -> พิมพ์ "ลบล่าสุด" -> รายการต้องถูกลบออกจาก Supabase และตอบกลับรายละเอียดรายการที่ถูกลบ
   - พิมพ์ "ลบล่าสุด" ซ้ำเมื่อไม่มีรายการเหลือ -> ต้องตอบกลับว่าไม่มีรายการให้ลบ
   - พิมพ์ "เริ่มใหม่" หรือ "เคลียร์ข้อมูล" -> บอทต้องส่งคำถามพร้อม Quick Reply
   - กดปุ่ม "ยกเลิก" -> บอทแจ้งยกเลิกและข้อมูลใน Supabase ยังคงอยู่ครบ
   - พิมพ์ "เคลียร์ข้อมูล" แล้วกด "ยืนยันล้างข้อมูลทั้งหมด" -> รายการทั้งหมดของผู้ใช้ต้องถูกลบ และส่งข้อความยืนยันสำเร็จ
