const { readDatabase, writeDatabase, getTimestamp } = require('../db/jsonStore');

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
    preferenceTags: row.preference_tags || [],
    budgetAmount: row.budget_amount,
    budgetCurrency: row.budget_currency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function create(userId, data) {
  const database = readDatabase();
  const now = getTimestamp();
  const trip = {
    id: database.meta.tripsNextId,
    user_id: Number(userId),
    destination: data.destination,
    country: data.country || null,
    region: data.region || null,
    start_date: data.startDate,
    end_date: data.endDate || null,
    notes: data.notes || null,
    preference_tags: data.preferenceTags || [],
    budget_amount: data.budgetAmount || null,
    budget_currency: data.budgetCurrency || null,
    status: data.status || 'planned',
    created_at: now,
    updated_at: now
  };

  database.meta.tripsNextId += 1;
  database.trips.push(trip);
  writeDatabase(database);

  return mapTrip(trip);
}

function findAllForUser(userId, filters) {
  const database = readDatabase();
  const destination = filters.destination?.toLowerCase();
  const rows = database.trips
    .filter((trip) => trip.user_id === Number(userId))
    .filter((trip) => !filters.status || trip.status === filters.status)
    .filter((trip) => !destination || trip.destination.toLowerCase().includes(destination))
    .sort((a, b) => {
      const dateCompare = a.start_date.localeCompare(b.start_date);
      return dateCompare || b.created_at.localeCompare(a.created_at);
    })
    .slice(filters.offset, filters.offset + filters.limit);

  return rows.map(mapTrip);
}

function findByIdForUser(id, userId) {
  const database = readDatabase();
  const row = database.trips.find((trip) => (
    trip.id === Number(id) && trip.user_id === Number(userId)
  ));

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

  const database = readDatabase();
  const index = database.trips.findIndex((trip) => (
    trip.id === Number(id) && trip.user_id === Number(userId)
  ));

  database.trips[index] = {
    ...database.trips[index],
    destination: next.destination,
    country: next.country,
    region: next.region,
    start_date: next.startDate,
    end_date: next.endDate,
    notes: next.notes,
    preference_tags: next.preferenceTags || [],
    budget_amount: next.budgetAmount,
    budget_currency: next.budgetCurrency,
    status: next.status,
    updated_at: getTimestamp()
  };

  writeDatabase(database);
  return mapTrip(database.trips[index]);
}

function remove(id, userId) {
  const database = readDatabase();
  const originalLength = database.trips.length;
  database.trips = database.trips.filter((trip) => !(
    trip.id === Number(id) && trip.user_id === Number(userId)
  ));

  writeDatabase(database);
  return database.trips.length < originalLength;
}

module.exports = {
  create,
  findAllForUser,
  findByIdForUser,
  update,
  remove
};
