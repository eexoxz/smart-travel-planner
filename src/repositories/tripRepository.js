const { getDatabase, getTimestamp } = require('../db/sqliteStore');

function parseTags(value) {
  if (!value) return [];

  try {
    return JSON.parse(value);
  } catch (error) {
    return [];
  }
}

function mapTrip(row) {
  if (!row) return undefined;

  return {
    id: row.id,
    userId: row.user_id,
    destination: row.destination,
    country: row.country,
    region: row.region,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    preferenceTags: parseTags(row.preference_tags),
    budgetAmount: row.budget_amount,
    budgetCurrency: row.budget_currency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function create(userId, data) {
  const database = getDatabase();
  const now = getTimestamp();
  const result = database.prepare(`
    INSERT INTO trips (
      user_id, destination, country, region, start_date, end_date, notes,
      preference_tags, budget_amount, budget_currency, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(userId),
    data.destination,
    data.country || null,
    data.region || null,
    data.startDate,
    data.endDate || null,
    data.notes || null,
    JSON.stringify(data.preferenceTags || []),
    data.budgetAmount ?? null,
    data.budgetCurrency || null,
    data.status || 'planned',
    now,
    now
  );

  return findByIdForUser(result.lastInsertRowid, userId);
}

function findAllForUser(userId, filters) {
  const clauses = ['user_id = ?'];
  const params = [Number(userId)];

  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }

  if (filters.destination) {
    clauses.push('LOWER(destination) LIKE ?');
    params.push(`%${filters.destination.toLowerCase()}%`);
  }

  params.push(filters.limit, filters.offset);

  const rows = getDatabase()
    .prepare(`
      SELECT *
      FROM trips
      WHERE ${clauses.join(' AND ')}
      ORDER BY start_date ASC, created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params);

  return rows.map(mapTrip);
}

function findByIdForUser(id, userId) {
  const row = getDatabase()
    .prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?')
    .get(Number(id), Number(userId));

  return mapTrip(row);
}

function update(id, userId, data) {
  const existing = findByIdForUser(id, userId);
  if (!existing) return undefined;

  const next = {
    destination: data.destination ?? existing.destination,
    country: data.country ?? existing.country,
    region: data.region ?? existing.region,
    startDate: data.startDate ?? existing.startDate,
    endDate: data.endDate ?? existing.endDate,
    notes: data.notes ?? existing.notes,
    preferenceTags: data.preferenceTags ?? existing.preferenceTags,
    budgetAmount: data.budgetAmount ?? existing.budgetAmount,
    budgetCurrency: data.budgetCurrency ?? existing.budgetCurrency,
    status: data.status ?? existing.status
  };

  getDatabase().prepare(`
    UPDATE trips
    SET destination = ?,
        country = ?,
        region = ?,
        start_date = ?,
        end_date = ?,
        notes = ?,
        preference_tags = ?,
        budget_amount = ?,
        budget_currency = ?,
        status = ?,
        updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    next.destination,
    next.country,
    next.region,
    next.startDate,
    next.endDate,
    next.notes,
    JSON.stringify(next.preferenceTags || []),
    next.budgetAmount,
    next.budgetCurrency,
    next.status,
    getTimestamp(),
    Number(id),
    Number(userId)
  );

  return findByIdForUser(id, userId);
}

function remove(id, userId) {
  const result = getDatabase()
    .prepare('DELETE FROM trips WHERE id = ? AND user_id = ?')
    .run(Number(id), Number(userId));

  return result.changes > 0;
}

module.exports = {
  create,
  findAllForUser,
  findByIdForUser,
  update,
  remove
};
