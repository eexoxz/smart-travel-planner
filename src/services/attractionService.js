const AppError = require('../utils/appError');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_METERS = 5000;
const RESULT_LIMIT = 5;

async function getNearbyAttractions(latitude, longitude) {
  const query = `
    [out:json][timeout:15];
    (
      node["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park)$"](around:${SEARCH_RADIUS_METERS},${latitude},${longitude});
    );
    out tags ${RESULT_LIMIT};
  `;

  const params = new URLSearchParams({ data: query });
  let response;

  try {
    response = await fetch(`${OVERPASS_URL}?${params}`);
  } catch (error) {
    throw new AppError('Unable to fetch nearby attractions: network request failed', 503);
  }

  if (!response.ok) {
    throw new AppError(`Unable to fetch nearby attractions: external API returned ${response.status}`, 502);
  }

  const data = await response.json();
  const attractions = (data.elements || [])
    .map(mapAttraction)
    .filter((attraction) => attraction.name)
    .slice(0, RESULT_LIMIT);

  return {
    provider: 'OpenStreetMap Overpass API',
    searchRadiusMeters: SEARCH_RADIUS_METERS,
    available: true,
    attractions
  };
}

function mapAttraction(element) {
  const tags = element.tags || {};
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  return {
    id: `${element.type}/${element.id}`,
    name: tags.name,
    category: tags.tourism || 'attraction',
    latitude,
    longitude
  };
}

module.exports = {
  getNearbyAttractions
};
