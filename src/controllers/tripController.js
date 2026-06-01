const tripService = require('../services/tripService');

function createTrip(req, res) {
  const trip = tripService.createTrip(req.user.id, req.validated.body);

  res.status(201).json({
    success: true,
    data: trip
  });
}

function listTrips(req, res) {
  const trips = tripService.listTrips(req.user.id, req.validated.query);

  res.status(200).json({
    success: true,
    count: trips.length,
    data: trips
  });
}

function getTrip(req, res) {
  const trip = tripService.getTrip(req.user.id, req.validated.params.id);

  res.status(200).json({
    success: true,
    data: trip
  });
}

function updateTrip(req, res) {
  const trip = tripService.updateTrip(req.user.id, req.validated.params.id, req.validated.body);

  res.status(200).json({
    success: true,
    data: trip
  });
}

function deleteTrip(req, res) {
  tripService.deleteTrip(req.user.id, req.validated.params.id);

  res.status(204).send();
}

module.exports = {
  createTrip,
  listTrips,
  getTrip,
  updateTrip,
  deleteTrip
};
