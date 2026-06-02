const AppError = require('../utils/appError');

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

async function searchDestinations(name, country) {
  if (!name || name.trim().length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    name: name.trim(),
    count: '10',
    language: 'en',
    format: 'json'
  });

  let response;

  try {
    response = await fetch(`${GEOCODING_URL}?${params}`);
  } catch (error) {
    throw new AppError('Unable to search destinations: network request failed', 503);
  }

  if (!response.ok) {
    throw new AppError(`Unable to search destinations: external API returned ${response.status}`, 502);
  }

  const data = await response.json();
  const selectedCountry = country?.trim().toLowerCase();

  return (data.results || [])
    .filter((place) => !selectedCountry || place.country?.toLowerCase() === selectedCountry)
    .map((place) => ({
      name: place.name,
      country: place.country,
      region: place.admin1,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone
    }));
}

module.exports = {
  searchDestinations
};
