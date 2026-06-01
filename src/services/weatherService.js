const AppError = require('../utils/appError');
const { describeWeatherCode } = require('./weatherCodeService');

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

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

async function geocodeDestination(destination, country) {
  const query = country ? `${destination}, ${country}` : destination;
  const params = new URLSearchParams({
    name: query,
    count: '1',
    language: 'en',
    format: 'json'
  });

  const data = await fetchJson(`${GEOCODING_URL}?${params}`, 'Unable to geocode destination');
  const match = data.results?.[0];

  if (!match) {
    throw new AppError('No location found for this trip destination', 404);
  }

  return {
    name: match.name,
    country: match.country,
    latitude: match.latitude,
    longitude: match.longitude,
    timezone: match.timezone
  };
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

async function getWeatherForDestination(destination, country) {
  const location = await geocodeDestination(destination, country);
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
