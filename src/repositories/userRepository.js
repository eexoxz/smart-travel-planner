const { readDatabase, writeDatabase, getTimestamp } = require('../db/jsonStore');

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
  const database = readDatabase();
  const now = getTimestamp();
  const user = {
    id: database.meta.usersNextId,
    name,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    role: 'traveller',
    created_at: now,
    updated_at: now
  };

  database.meta.usersNextId += 1;
  database.users.push(user);
  writeDatabase(database);

  return user;
}

function findByEmail(email) {
  const database = readDatabase();
  return database.users.find((user) => user.email === email.toLowerCase());
}

function findById(id) {
  const database = readDatabase();
  return database.users.find((user) => user.id === Number(id));
}

module.exports = {
  create,
  findByEmail,
  findById,
  toPublicUser
};
