const locationService = require('../services/locationService');

async function searchDestinations(req, res) {
  const destinations = await locationService.searchDestinations(req.query.name, req.query.country);

  res.status(200).json({
    success: true,
    count: destinations.length,
    data: destinations
  });
}

module.exports = {
  searchDestinations
};
