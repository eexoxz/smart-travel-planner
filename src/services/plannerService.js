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
    getRequestedPlaceCount(trip),
    trip
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

async function getAttractionsSafely(latitude, longitude, preferences, requestedLimit, trip) {
  try {
    return await attractionService.getNearbyAttractions(latitude, longitude, preferences, requestedLimit, {
      destination: trip.destination,
      region: trip.region,
      country: trip.country,
      latitude,
      longitude
    });
  } catch (error) {
    return {
      provider: 'OpenStreetMap Overpass API',
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
    advice.push('Live nearby places could not be loaded at the moment, but the weather result is still available.');
  }

  if (attractions.message) {
    advice.push(attractions.message);
  }

  return {
    destination: trip.destination,
    summary: advice.join(' ')
  };
}

function buildTravelPlan(trip, weather, attractions) {
  const durationDays = getTripDurationDays(trip);
  const nearbyPlaces = buildPlaceList(trip, attractions, durationDays);

  return {
    title: `${trip.destination} travel plan`,
    overview: buildOverview(trip),
    weatherAdvice: buildWeatherAdvice(weather),
    suggestedPlaces: nearbyPlaces,
    itinerary: buildItinerary(trip, weather, nearbyPlaces, durationDays),
    preparationTips: buildPreparationTips(trip, weather),
    limitation: attractions.available
      ? 'Nearby places are based on public OpenStreetMap records and should be checked before final booking.'
      : 'Live nearby places could not be loaded, so this plan uses the saved destination, trip notes and weather.'
  };
}

function buildPlaceList(trip, attractions, durationDays) {
  const places = attractions.attractions.map((attraction, index) => ({
    order: index + 1,
    name: attraction.name,
    category: attraction.category,
    url: attraction.url,
    preferenceTags: getPlacePreferenceTags(attraction)
  }));

  if (places.length) {
    return prioritizePlacesForPreferences(places, trip.preferenceTags)
      .slice(0, Math.min(Math.max(durationDays * 2, 5), 15))
      .map((place, index) => ({ ...place, order: index + 1 }));
  }

  return [{
    order: 1,
    name: trip.destination,
    category: 'destination area'
  }];
}

function buildItinerary(trip, weather, places, durationDays) {
  const totalDays = Math.min(durationDays, 14);
  const usage = new Map();

  return Array.from({ length: totalDays }, (_, index) => {
    const focus = getDayFocus(trip, index);
    const location = getDayLocation(trip, places, focus.preference, usage);
    const bestTime = getBestVisitTime(focus.theme, weather);

    return {
      day: index + 1,
      date: addDays(trip.startDate, index),
      theme: focus.theme,
      location: location.name,
      locationCategory: location.category,
      locationUrl: location.url,
      bestTime,
      morning: location.isFallback
        ? `Use ${location.name} as the main area and confirm a suitable stop before travelling.`
        : `Make ${location.name} the main stop for this day.`,
      afternoon: getWeatherBasedAfternoon(weather),
      evening: getEveningPlan(trip, index)
    };
  });
}

function getDayLocation(trip, places, preference, usage) {
  if (!places.length) {
    return {
      name: trip.destination,
      category: 'destination area',
      isFallback: true
    };
  }

  const matchingPlaces = places.filter((place) => placeMatchesPreference(place, preference));
  const source = matchingPlaces.length ? matchingPlaces : places;
  const usageKey = matchingPlaces.length ? preference : 'general';
  const nextIndex = usage.get(usageKey) || 0;
  const place = source[nextIndex % source.length];

  usage.set(usageKey, nextIndex + 1);

  return {
    ...place,
    isFallback: place.category === 'destination area',
    isPreferenceMatch: matchingPlaces.length > 0
  };
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);

  return value.toISOString().slice(0, 10);
}

function getDayFocus(trip, index) {
  const tags = trip.preferenceTags.map((tag) => tag.toLowerCase());
  const themes = [];

  if (tags.includes('food')) themes.push({ preference: 'food', theme: 'Food and local neighbourhoods' });
  if (tags.includes('museums')) themes.push({ preference: 'museums', theme: 'Museums and galleries' });
  if (tags.includes('culture')) themes.push({ preference: 'culture', theme: 'Culture and landmarks' });
  if (tags.includes('beach')) themes.push({ preference: 'beach', theme: 'Beach and coastal time' });
  if (tags.includes('nature')) themes.push({ preference: 'nature', theme: 'Nature and slower outdoor time' });
  if (tags.includes('shopping')) themes.push({ preference: 'shopping', theme: 'Shopping and city browsing' });
  if (tags.includes('nightlife')) themes.push({ preference: 'nightlife', theme: 'Evening atmosphere' });
  if (tags.includes('family')) themes.push({ preference: 'family', theme: 'Family-friendly pacing' });

  return themes.length ? themes[index % themes.length] : { preference: 'general', theme: 'Balanced sightseeing' };
}

function prioritizePlacesForPreferences(places, preferences) {
  const selectedPreferences = getKnownPreferences(preferences);

  if (!selectedPreferences.length) {
    return places;
  }

  const result = [];
  const used = new Set();

  for (const preference of selectedPreferences) {
    const match = places.find((place) => !used.has(place.order) && placeMatchesPreference(place, preference));

    if (match) {
      result.push(match);
      used.add(match.order);
    }
  }

  for (const place of places) {
    if (!used.has(place.order)) {
      result.push(place);
    }
  }

  return result;
}

function getKnownPreferences(preferences) {
  return preferences
    .map((preference) => preference.toLowerCase())
    .filter((preference) => preferenceKeywords[preference]);
}

function getPlacePreferenceTags(place) {
  const text = `${place.name || ''} ${place.category || ''}`.toLowerCase();

  return Object.keys(preferenceKeywords)
    .filter((preference) => preferenceKeywords[preference].some((keyword) => text.includes(keyword)));
}

function placeMatchesPreference(place, preference) {
  if (!preference || preference === 'general') {
    return true;
  }

  const tags = place.preferenceTags || getPlacePreferenceTags(place);

  return tags.includes(preference);
}

const preferenceKeywords = {
  food: ['restaurant', 'cafe', 'food', 'marketplace', 'market', 'bakery', 'bar', 'pub', 'dining', 'street food'],
  culture: ['culture', 'cultural', 'historic', 'heritage', 'temple', 'shrine', 'church', 'mosque', 'palace', 'monument', 'landmark', 'village', 'castle', 'attraction'],
  museums: ['museum', 'gallery'],
  beach: ['beach', 'coast', 'coastal', 'waterfront', 'bay', 'harbour', 'marina', 'island'],
  nature: ['park', 'garden', 'forest', 'wood', 'mountain', 'peak', 'river', 'lake', 'waterfall', 'viewpoint', 'trail', 'nature'],
  shopping: ['shop', 'shopping', 'mall', 'market', 'boutique', 'store'],
  nightlife: ['night', 'nightclub', 'bar', 'pub', 'club'],
  family: ['zoo', 'aquarium', 'theme park', 'playground', 'family', 'park', 'garden']
};

function getWeatherBasedAfternoon(weather) {
  if (weather.temperatureCelsius >= 30) {
    return 'Use the hotter afternoon period for indoor stops, cafes or shaded areas.';
  }

  if (weather.weatherCode >= 51 && weather.weatherCode <= 82) {
    return 'Keep an indoor backup plan in case rain affects outdoor stops.';
  }

  return 'Use the afternoon for flexible sightseeing around the destination area.';
}

function getBestVisitTime(theme, weather) {
  if (weather.weatherCode >= 61 && weather.weatherCode <= 82) {
    return 'Late morning or early afternoon, with an indoor backup if rain starts.';
  }

  if (weather.temperatureCelsius >= 30) {
    return 'Morning before the hottest period, or after 5 PM.';
  }

  if (theme.includes('Food') || theme.includes('Evening')) {
    return 'Late afternoon or evening.';
  }

  if (theme.includes('Beach') || theme.includes('Nature')) {
    return 'Early morning or late afternoon.';
  }

  return 'Morning to early afternoon.';
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
