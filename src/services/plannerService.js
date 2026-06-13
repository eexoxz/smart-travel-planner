const tripService = require('./tripService');
const weatherService = require('./weatherService');
const attractionService = require('./attractionService');

async function getTripWeatherSummary(userId, tripId) {
  const trip = tripService.getTrip(userId, tripId);
  const weather = await weatherService.getWeatherForDestination(trip.destination, trip.country, trip.region);
  const attractions = await getAttractionsSafely(
    weather.location.latitude,
    weather.location.longitude,
    trip.preferenceTags,
    getRequestedPlaceCount(trip)
  );

  return {
    trip,
    externalData: {
      weather,
      attractions
    },
    recommendation: buildRecommendation(trip, weather.currentWeather, attractions),
    travelPlan: buildTravelPlan(trip, weather.currentWeather, attractions)
  };
}

async function getAttractionsSafely(latitude, longitude, preferences, requestedLimit) {
  try {
    return await attractionService.getNearbyAttractions(latitude, longitude, preferences, requestedLimit);
  } catch (error) {
    return {
      provider: 'Wikidata Query Service',
      searchRadiusMeters: 10000,
      searchFocus: preferences.length ? preferences : ['general'],
      available: false,
      attractions: [],
      message: error.message
    };
  }
}

function getRequestedPlaceCount(trip) {
  return Math.min(Math.max(getTripDurationDays(trip) * 2, 8), 15);
}

function getTripDurationDays(trip) {
  if (!trip.endDate) {
    return 1;
  }

  const start = new Date(`${trip.startDate}T00:00:00Z`);
  const end = new Date(`${trip.endDate}T00:00:00Z`);
  const diffDays = Math.floor((end - start) / 86400000) + 1;

  return Number.isFinite(diffDays) && diffDays > 0 ? diffDays : 1;
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

function buildTravelPlan(trip, weather, attractions) {
  const durationDays = getTripDurationDays(trip);
  const nearbyPlaces = attractions.attractions.slice(0, Math.min(Math.max(durationDays * 2, 5), 15)).map((attraction, index) => ({
    order: index + 1,
    name: attraction.name,
    category: attraction.category,
    url: attraction.url
  }));

  return {
    title: `${trip.destination} travel plan`,
    overview: buildOverview(trip),
    weatherAdvice: buildWeatherAdvice(weather),
    suggestedPlaces: nearbyPlaces,
    itinerary: buildItinerary(trip, weather, nearbyPlaces, durationDays),
    preparationTips: buildPreparationTips(trip, weather),
    limitation: attractions.available
      ? 'Nearby places are based on public Wikidata records and should be checked before final booking.'
      : 'Nearby places could not be loaded, so this plan is based on trip notes and weather only.'
  };
}

function buildItinerary(trip, weather, places, durationDays) {
  const totalDays = Math.min(durationDays, 14);

  return Array.from({ length: totalDays }, (_, index) => {
    const firstPlace = places.length ? places[(index * 2) % places.length] : undefined;
    const secondPlace = places.length ? places[(index * 2 + 1) % places.length] : undefined;

    return {
      day: index + 1,
      date: addDays(trip.startDate, index),
      theme: getDayTheme(trip, index),
      morning: firstPlace
        ? `Start with ${firstPlace.name} while energy levels are high.`
        : `Start near ${trip.destination} and use saved notes to choose the first stop.`,
      afternoon: secondPlace
        ? `Continue to ${secondPlace.name} and keep transit time flexible.`
        : getWeatherBasedAfternoon(weather),
      evening: getEveningPlan(trip, index)
    };
  });
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);

  return value.toISOString().slice(0, 10);
}

function getDayTheme(trip, index) {
  const tags = trip.preferenceTags.map((tag) => tag.toLowerCase());
  const themes = [];

  if (tags.includes('food')) themes.push('Food and local neighbourhoods');
  if (tags.includes('culture') || tags.includes('museums')) themes.push('Culture and landmarks');
  if (tags.includes('beach')) themes.push('Beach and coastal time');
  if (tags.includes('nature')) themes.push('Nature and slower outdoor time');
  if (tags.includes('shopping')) themes.push('Shopping and city browsing');
  if (tags.includes('nightlife')) themes.push('Evening atmosphere');
  if (tags.includes('family')) themes.push('Family-friendly pacing');

  return themes.length ? themes[index % themes.length] : 'Balanced sightseeing';
}

function getWeatherBasedAfternoon(weather) {
  if (weather.temperatureCelsius >= 30) {
    return 'Use the hotter afternoon period for indoor stops, cafes or shaded areas.';
  }

  if (weather.weatherCode >= 51 && weather.weatherCode <= 82) {
    return 'Keep an indoor backup plan in case rain affects outdoor stops.';
  }

  return 'Use the afternoon for flexible sightseeing around the destination area.';
}

function getEveningPlan(trip, index) {
  const tags = trip.preferenceTags.map((tag) => tag.toLowerCase());

  if (tags.includes('food')) {
    return 'Leave the evening open for dinner, cafes or a local food street.';
  }

  if (tags.includes('nightlife')) {
    return 'Use the evening for nightlife or a lively district, depending on safety and transport.';
  }

  if (index === 0) {
    return 'Keep the first evening light for check-in, orientation and nearby food.';
  }

  return 'End with a lower-intensity activity and review the next day route.';
}

function buildOverview(trip) {
  const dates = trip.endDate
    ? `${trip.startDate} to ${trip.endDate}`
    : `starting ${trip.startDate}`;
  const preferences = trip.preferenceTags.length
    ? `Preferences: ${trip.preferenceTags.join(', ')}.`
    : 'No specific preferences were saved.';

  const location = [trip.destination, trip.region, trip.country].filter(Boolean).join(', ');

  return `${location} trip ${dates}. ${preferences}`;
}

function buildWeatherAdvice(weather) {
  if (weather.temperatureCelsius >= 30) {
    return 'Plan outdoor activities earlier or later in the day and schedule indoor breaks during hotter hours.';
  }

  if (weather.weatherCode >= 61 && weather.weatherCode <= 82) {
    return 'Keep flexible indoor options because rain may affect outdoor sightseeing.';
  }

  if (weather.windSpeedKmh >= 30) {
    return 'Avoid exposed outdoor activities until wind conditions improve.';
  }

  return 'Weather conditions look suitable for normal sightseeing.';
}

function buildPreparationTips(trip, weather) {
  const tips = ['Bring a charged phone and keep important booking details accessible.'];
  const tags = trip.preferenceTags.map((tag) => tag.toLowerCase());

  if (weather.temperatureCelsius >= 30) {
    tips.push('Carry water, sunscreen and light clothing.');
  }

  if (weather.weatherCode >= 51 && weather.weatherCode <= 82) {
    tips.push('Pack an umbrella or raincoat.');
  }

  if (tags.includes('food')) {
    tips.push('Reserve time for local food spots and keep meal times flexible.');
  }

  if (tags.includes('culture') || tags.includes('museums')) {
    tips.push('Check attraction opening hours before visiting museums or cultural sites.');
  }

  if (tags.includes('beach')) {
    tips.push('Check tide, heat and rain conditions before planning beach time.');
  }

  if (trip.budgetAmount) {
    const budget = trip.budgetCurrency
      ? `${trip.budgetAmount} ${trip.budgetCurrency}`
      : String(trip.budgetAmount);
    tips.push(`Keep the plan within the saved budget of ${budget}.`);
  }

  return tips;
}

module.exports = {
  getTripWeatherSummary
};
