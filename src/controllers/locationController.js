const locationService = require('../services/locationService');

async function searchDestinations(req, res) {
  const destinations = await locationService.searchDestinations(req.query.name, req.query.country);

  res.status(200).json({
    success: true,
    count: destinations.length,
    data: destinations
  });
}

async function getStates(req, res) {
  const states = await locationService.getStates(req.query.country);

  res.status(200).json({
    success: true,
    count: states.length,
    data: states
  });
}

async function getCities(req, res) {
  const cities = await locationService.getCities(req.query.country, req.query.state);

  res.status(200).json({
    success: true,
    count: cities.length,
    data: cities
  });
}

module.exports = {
  searchDestinations,
  getStates,
  getCities
};
