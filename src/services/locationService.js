const AppError = require('../utils/appError');

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const COUNTRIES_NOW_URL = 'https://countriesnow.space/api/v0.1/countries';

async function fetchCountriesNow(path, body, message) {
  let response;

  try {
    response = await fetch(`${COUNTRIES_NOW_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new AppError(`${message}: network request failed`, 503);
  }

  if (!response.ok) {
    throw new AppError(`${message}: external API returned ${response.status}`, 502);
  }

  const payload = await response.json();

  if (payload.error) {
    throw new AppError(payload.msg || message, 502);
  }

  return payload.data;
}

async function getStates(country) {
  if (!country) {
    return [];
  }

  const data = await fetchCountriesNow('/states', { country }, 'Unable to fetch states');

  return (data.states || []).map((state) => ({
    name: state.name,
    code: state.state_code
  }));
}

async function getCities(country, state) {
  if (!country) {
    return [];
  }

  const path = state ? '/state/cities' : '/cities';
  const body = state ? { country, state } : { country };
  const data = await fetchCountriesNow(path, body, 'Unable to fetch cities');

  return (data || []).map((city) => ({
    name: city
  }));
}

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
  searchDestinations,
  getStates,
  getCities
};
