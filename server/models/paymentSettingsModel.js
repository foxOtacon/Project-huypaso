const { query } = require("../config/db");

async function getPaymentSettings() {
  const result = await query(
    `SELECT payment_setting_id, promptpay_number, account_name, qr_image_url,
            bank_name, bank_account_number, bank_account_name, updated_at
     FROM payment_settings WHERE payment_setting_id = 1`,
  );
  return result[0] || null;
}

async function updatePaymentSettings({ promptpayNumber, accountName, qrImageUrl, bankName, bankAccountNumber, bankAccountName, updatedBy }) {
  const result = await query(
    `INSERT INTO payment_settings
       (payment_setting_id, promptpay_number, account_name, qr_image_url,
        bank_name, bank_account_number, bank_account_name, updated_at, updated_by)
     VALUES (1, ?, ?, ?, ?, ?, ?, NOW(), ?)
     ON CONFLICT (payment_setting_id) DO UPDATE SET
       promptpay_number = EXCLUDED.promptpay_number,
       account_name = EXCLUDED.account_name,
       qr_image_url = COALESCE(EXCLUDED.qr_image_url, payment_settings.qr_image_url),
       bank_name = EXCLUDED.bank_name,
       bank_account_number = EXCLUDED.bank_account_number,
       bank_account_name = EXCLUDED.bank_account_name,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by
     RETURNING payment_setting_id, promptpay_number, account_name, qr_image_url,
               bank_name, bank_account_number, bank_account_name, updated_at`,
    [promptpayNumber || null, accountName || null, qrImageUrl || null, bankName || null, bankAccountNumber || null, bankAccountName || null, updatedBy],
  );
  return result.rows?.[0] || null;
}

module.exports = { getPaymentSettings, updatePaymentSettings };
