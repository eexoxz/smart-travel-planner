const { getDatabase, getTimestamp } = require('../db/sqliteStore');

function toPublicUser(row) {
  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function create({ name, email, passwordHash }) {
  const database = getDatabase();
  const now = getTimestamp();
  const result = database.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, email.toLowerCase(), passwordHash, 'traveller', now, now);

  return findById(result.lastInsertRowid);
}

function findByEmail(email) {
  return getDatabase()
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.toLowerCase());
}

function findById(id) {
  return getDatabase()
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(Number(id));
}

module.exports = {
  create,
  findByEmail,
  findById,
  toPublicUser
};
