const AppError = require('../utils/appError');
const { describeWeatherCode } = require('./weatherCodeService');

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_TIMEOUT_MS = 5000;

async function fetchJson(url, errorMessage) {
  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new AppError(`${errorMessage}: network request failed`, 503);
  }

  if (!response.ok) {
    throw new AppError(`${errorMessage}: external API returned ${response.status}`, 502);
  }

  return response.json();
}

function normalize(value) {
  return value?.trim().toLowerCase();
}

async function fetchJsonSafely(url, options = {}) {
  let response;

  try {
    response = await fetchWithTimeout(url, options, NOMINATIM_TIMEOUT_MS);
  } catch (error) {
    return undefined;
  }

  if (!response.ok) {
    return undefined;
  }

  return response.json();
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function chooseLocationMatch(results = [], country, region) {
  const selectedCountry = normalize(country);
  const selectedRegion = normalize(region);
  const countryMatches = selectedCountry
    ? results.filter((place) => normalize(place.country) === selectedCountry)
    : results;

  if (selectedRegion) {
    const regionMatch = countryMatches.find((place) => (
      normalize(place.admin1) === selectedRegion
      || normalize(place.admin2) === selectedRegion
      || normalize(place.admin3) === selectedRegion
    ));

    if (regionMatch) {
      return regionMatch;
    }
  }

  return countryMatches[0] || results[0];
}

async function geocodeDestination(destination, country, region) {
  const params = new URLSearchParams({
    name: destination,
    count: '10',
    language: 'en',
    format: 'json'
  });

  const data = await fetchJson(`${GEOCODING_URL}?${params}`, 'Unable to geocode destination');
  const match = chooseLocationMatch(data.results, country, region);

  if (match) {
    return {
      name: match.name,
      country: match.country,
      region: match.admin1,
      latitude: match.latitude,
      longitude: match.longitude,
      timezone: match.timezone
    };
  }

  const nominatimMatch = await geocodeWithNominatim(destination, country, region);

  if (nominatimMatch) {
    return nominatimMatch;
  }

  throw new AppError('No location found for this trip destination', 404);
}

async function geocodeWithNominatim(destination, country, region) {
  const query = [destination, region, country].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
    namedetails: '1'
  });
  const data = await fetchJsonSafely(`${NOMINATIM_URL}?${params}`, {
    headers: {
      'User-Agent': 'SmartTravelPlannerApp/1.0'
    }
  });

  if (!Array.isArray(data) || !data.length) {
    return undefined;
  }

  const selected = chooseNominatimMatch(data, country, region);

  if (!selected) {
    return undefined;
  }

  const address = selected.address || {};

  return {
    name: selected.namedetails?.name
      || selected.name
      || selected.display_name?.split(',')[0]
      || destination,
    country: address.country || country,
    region: address.state || address.region || address.county || region,
    latitude: Number(selected.lat),
    longitude: Number(selected.lon),
    timezone: 'auto'
  };
}

function chooseNominatimMatch(results = [], country, region) {
  const selectedCountry = normalize(country);
  const selectedRegion = normalize(region);
  const countryMatches = selectedCountry
    ? results.filter((place) => normalize(place.address?.country) === selectedCountry)
    : results;

  if (selectedRegion) {
    const regionMatch = countryMatches.find((place) => (
      normalize(place.address?.state) === selectedRegion
      || normalize(place.address?.region) === selectedRegion
      || normalize(place.address?.county) === selectedRegion
      || normalize(place.address?.city) === selectedRegion
    ));

    if (regionMatch) {
      return regionMatch;
    }
  }

  return countryMatches[0] || results[0];
}

async function getCurrentWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    timezone: 'auto'
  });

  const data = await fetchJson(`${FORECAST_URL}?${params}`, 'Unable to fetch current weather');

  if (!data.current) {
    throw new AppError('Weather response did not include current conditions', 502);
  }

  return {
    observedAt: data.current.time,
    temperatureCelsius: data.current.temperature_2m,
    humidityPercent: data.current.relative_humidity_2m,
    windSpeedKmh: data.current.wind_speed_10m,
    weatherCode: data.current.weather_code,
    description: describeWeatherCode(data.current.weather_code)
  };
}

async function getWeatherForDestination(destination, country, region) {
  const location = await geocodeDestination(destination, country, region);
  const currentWeather = await getCurrentWeather(location.latitude, location.longitude);

  return {
    provider: 'Open-Meteo',
    location,
    currentWeather
  };
}

module.exports = {
  getWeatherForDestination
};
