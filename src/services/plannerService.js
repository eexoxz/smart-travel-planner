const tripService = require('./tripService');
const weatherService = require('./weatherService');

async function getTripWeatherSummary(userId, tripId) {
  const trip = tripService.getTrip(userId, tripId);
  const weather = await weatherService.getWeatherForDestination(trip.destination, trip.country);

  return {
    trip,
    externalData: {
      weather
    },
    recommendation: buildRecommendation(trip, weather.currentWeather)
  };
}

function buildRecommendation(trip, weather) {
  const advice = [];

  if (weather.temperatureCelsius >= 30) {
    advice.push('Plan indoor breaks and carry water because the temperature is high.');
  }

  if (weather.weatherCode >= 61 && weather.weatherCode <= 82) {
    advice.push('Pack an umbrella or raincoat because rain is likely.');
  }

  if (weather.windSpeedKmh >= 30) {
    advice.push('Check outdoor activities because wind speed is relatively strong.');
  }

  if (advice.length === 0) {
    advice.push('Weather conditions look suitable for general sightseeing.');
  }

  return {
    destination: trip.destination,
    summary: advice.join(' ')
  };
}

module.exports = {
  getTripWeatherSummary
};
