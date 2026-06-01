const AppError = require('../utils/appError');

const WIKIPEDIA_GEOSEARCH_URL = 'https://en.wikipedia.org/w/api.php';
const SEARCH_RADIUS_METERS = 10000;
const RESULT_LIMIT = 5;

async function getNearbyAttractions(latitude, longitude) {
  const params = new URLSearchParams({
    action: 'query',
    list: 'geosearch',
    gscoord: `${latitude}|${longitude}`,
    gsradius: String(SEARCH_RADIUS_METERS),
    gslimit: String(RESULT_LIMIT),
    format: 'json',
    origin: '*'
  });

  let response;

  try {
    response = await fetch(`${WIKIPEDIA_GEOSEARCH_URL}?${params}`, {
      headers: {
        'User-Agent': 'SmartTravelPlannerStudentProject/1.0'
      }
    });
  } catch (error) {
    throw new AppError('Unable to fetch nearby attractions: network request failed', 503);
  }

  if (!response.ok) {
    throw new AppError(`Unable to fetch nearby attractions: external API returned ${response.status}`, 502);
  }

  const data = await response.json();
  const attractions = (data.query?.geosearch || [])
    .map(mapAttraction)
    .filter((attraction) => attraction.name)
    .slice(0, RESULT_LIMIT);

  return {
    provider: 'Wikipedia GeoSearch API',
    searchRadiusMeters: SEARCH_RADIUS_METERS,
    available: true,
    attractions
  };
}

function mapAttraction(place) {
  return {
    id: String(place.pageid),
    name: place.title,
    category: 'point_of_interest',
    latitude: place.lat,
    longitude: place.lon,
    distanceMeters: place.dist,
    url: `https://en.wikipedia.org/?curid=${place.pageid}`
  };
}

module.exports = {
  getNearbyAttractions
};
