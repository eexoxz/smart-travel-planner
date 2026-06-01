const tripService = require('./tripService');
const weatherService = require('./weatherService');
const attractionService = require('./attractionService');

async function getTripWeatherSummary(userId, tripId) {
  const trip = tripService.getTrip(userId, tripId);
  const weather = await weatherService.getWeatherForDestination(trip.destination, trip.country);
  const attractions = await getAttractionsSafely(weather.location.latitude, weather.location.longitude);

  return {
    trip,
    externalData: {
      weather,
      attractions
    },
    recommendation: buildRecommendation(trip, weather.currentWeather, attractions)
  };
}

async function getAttractionsSafely(latitude, longitude) {
  try {
    return await attractionService.getNearbyAttractions(latitude, longitude);
  } catch (error) {
    return {
      provider: 'Wikipedia GeoSearch API',
      searchRadiusMeters: 10000,
      available: false,
      attractions: [],
      message: error.message
    };
  }
}

function buildRecommendation(trip, weather, attractions) {
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

  if (attractions.attractions.length > 0) {
    const names = attractions.attractions.slice(0, 3).map((attraction) => attraction.name).join(', ');
    advice.push(`Nearby attractions to consider: ${names}.`);
  } else if (!attractions.available) {
    advice.push('Nearby attractions could not be loaded at the moment, but the weather result is still available.');
  }

  return {
    destination: trip.destination,
    summary: advice.join(' ')
  };
}

module.exports = {
  getTripWeatherSummary
};
