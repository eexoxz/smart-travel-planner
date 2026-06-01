const plannerService = require('../services/plannerService');

async function getTripPlan(req, res) {
  const summary = await plannerService.getTripWeatherSummary(req.user.id, req.validated.params.id);

  res.status(200).json({
    success: true,
    data: summary
  });
}

module.exports = {
  getTripPlan
};
