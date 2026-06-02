const tripRepository = require('../repositories/tripRepository');
const AppError = require('../utils/appError');

function createTrip(userId, data) {
  return tripRepository.create(userId, data);
}

function listTrips(userId, filters) {
  return tripRepository.findAllForUser(userId, filters);
}

function getTrip(userId, tripId) {
  const trip = tripRepository.findByIdForUser(tripId, userId);

  if (!trip) {
    throw new AppError('Trip not found', 404);
  }

  return trip;
}

function updateTrip(userId, tripId, data) {
  const existingTrip = getTrip(userId, tripId);
  const nextStartDate = data.startDate ?? existingTrip.startDate;
  const nextEndDate = data.endDate ?? existingTrip.endDate;
  const today = new Date().toISOString().slice(0, 10);

  if (nextStartDate < today) {
    throw new AppError('startDate cannot be in the past', 400);
  }

  if (nextEndDate && nextEndDate < nextStartDate) {
    throw new AppError('endDate must be on or after startDate', 400);
  }

  const updatedTrip = tripRepository.update(tripId, userId, data);

  if (!updatedTrip) {
    throw new AppError('Trip not found', 404);
  }

  return updatedTrip;
}

function deleteTrip(userId, tripId) {
  const deleted = tripRepository.remove(tripId, userId);

  if (!deleted) {
    throw new AppError('Trip not found', 404);
  }
}

module.exports = {
  createTrip,
  listTrips,
  getTrip,
  updateTrip,
  deleteTrip
};
