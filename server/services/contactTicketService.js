const { query } = require("../config/db");

let schemaPromise;

async function ensureContactTicketSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS contacts (
        contact_id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(200) NOT NULL,
        category VARCHAR(40) NOT NULL DEFAULT 'general',
        order_id BIGINT REFERENCES orders(order_id) ON DELETE SET NULL,
        subject VARCHAR(255),
        message TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'new',
        ticket_status VARCHAR(30) NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_reply_at TIMESTAMPTZ
      )`);
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL`);
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'general'`);
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(order_id) ON DELETE SET NULL`);
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ`);
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ticket_status VARCHAR(30) NOT NULL DEFAULT 'new'`);
      await query(`CREATE TABLE IF NOT EXISTS contact_replies (
        reply_id BIGSERIAL PRIMARY KEY,
        contact_id BIGINT NOT NULL REFERENCES contacts(contact_id) ON DELETE CASCADE,
        sender_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
        sender_role VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await query(`CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_contacts_ticket_status ON contacts(ticket_status)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_contact_replies_contact_id ON contact_replies(contact_id)`);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function getTicket(contactId) {
  const rows = await query(`SELECT c.*,
      u.full_name AS account_name, u.email AS account_email,
      u.phone AS account_phone, u.address AS account_address
    FROM contacts c
    LEFT JOIN users u ON u.user_id = c.user_id
      OR (c.user_id IS NULL AND LOWER(TRIM(u.email)) = LOWER(TRIM(c.email)))
    WHERE c.contact_id = ? LIMIT 1`, [contactId]);
  const ticket = rows[0] || null;
  return ticket ? { ...ticket, status: ticket.ticket_status || ticket.status } : null;
}

async function getReplies(contactId) {
  return query(`SELECT r.*, u.full_name AS sender_name
    FROM contact_replies r LEFT JOIN users u ON u.user_id = r.sender_id
    WHERE r.contact_id = ? ORDER BY r.created_at ASC, r.reply_id ASC`, [contactId]);
}

function canAccessTicket(user, ticket) {
  return Boolean(user && ticket && (user.role === 'admin' || String(ticket.user_id) === String(user.user_id)));
}

module.exports = { ensureContactTicketSchema, getTicket, getReplies, canAccessTicket };
