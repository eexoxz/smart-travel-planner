const AppError = require('../utils/appError');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_METERS = 10000;
const DEFAULT_RESULT_LIMIT = 8;
const MAX_RESULT_LIMIT = 15;

const preferenceFilters = {
  food: [
    '["amenity"~"^(cafe|restaurant|food_court|fast_food|bar|pub)$"]'
  ],
  culture: [
    '["tourism"~"^(attraction|museum|gallery)$"]',
    '["historic"]',
    '["amenity"="place_of_worship"]'
  ],
  museums: [
    '["tourism"="museum"]',
    '["tourism"="gallery"]'
  ],
  beach: [
    '["natural"="beach"]'
  ],
  nature: [
    '["leisure"="park"]',
    '["tourism"="picnic_site"]',
    '["natural"~"^(wood|water|peak|beach)$"]'
  ],
  shopping: [
    '["shop"]',
    '["amenity"="marketplace"]'
  ],
  nightlife: [
    '["amenity"~"^(bar|pub|nightclub)$"]'
  ],
  family: [
    '["tourism"~"^(zoo|theme_park|aquarium)$"]',
    '["leisure"~"^(park|playground|garden)$"]'
  ]
};

const defaultFilters = [
  '["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium)$"]',
  '["historic"]',
  '["leisure"~"^(park|garden)$"]',
  '["natural"="beach"]',
  '["amenity"~"^(cafe|restaurant|marketplace)$"]'
];

async function getNearbyAttractions(latitude, longitude, preferences = [], requestedLimit = DEFAULT_RESULT_LIMIT) {
  const resultLimit = Math.min(Math.max(Number(requestedLimit) || DEFAULT_RESULT_LIMIT, 5), MAX_RESULT_LIMIT);
  const filters = getTargetFilters(preferences);
  const attractions = await fetchAttractions(latitude, longitude, filters, resultLimit);

  return {
    provider: 'OpenStreetMap Overpass API',
    searchRadiusMeters: SEARCH_RADIUS_METERS,
    searchFocus: getSearchFocus(preferences),
    available: true,
    attractions
  };
}

async function fetchAttractions(latitude, longitude, filters, resultLimit) {
  const statements = filters
    .flatMap((filter) => [
      `node(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})${filter};`,
      `way(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})${filter};`,
      `relation(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})${filter};`
    ])
    .join('\n');
  const query = `
    [out:json][timeout:15];
    (
      ${statements}
    );
    out center tags ${resultLimit};
  `;
  const params = new URLSearchParams({ data: query });
  let response;

  try {
    response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SmartTravelPlannerApp/1.0'
      },
      body: params
    });
  } catch (error) {
    throw new AppError('Unable to fetch nearby attractions: network request failed', 503);
  }

  if (!response.ok) {
    throw new AppError(`Unable to fetch nearby attractions: external API returned ${response.status}`, 502);
  }

  const data = await response.json();

  return (data.elements || [])
    .map(mapAttraction)
    .filter((attraction) => attraction.name)
    .slice(0, resultLimit);
}

function getTargetFilters(preferences) {
  const selected = preferences
    .map((preference) => preference.toLowerCase())
    .flatMap((preference) => preferenceFilters[preference] || []);

  return [...new Set(selected.length ? selected : defaultFilters)];
}

function getSearchFocus(preferences) {
  const selected = preferences.filter((preference) => preferenceFilters[preference.toLowerCase()]);

  return selected.length ? selected : ['general'];
}

function mapAttraction(element) {
  const tags = element.tags || {};
  const latitude = element.lat || element.center?.lat;
  const longitude = element.lon || element.center?.lon;

  return {
    id: `${element.type}/${element.id}`,
    name: tags.name,
    category: getCategory(tags),
    latitude,
    longitude,
    address: getAddress(tags),
    url: tags.website || tags['contact:website'] || `https://www.openstreetmap.org/${element.type}/${element.id}`
  };
}

function getCategory(tags) {
  return tags.cuisine
    || tags.amenity
    || tags.tourism
    || tags.historic
    || tags.leisure
    || tags.natural
    || tags.shop
    || 'point of interest';
}

function getAddress(tags) {
  return [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city']
  ].filter(Boolean).join(', ') || undefined;
}

module.exports = {
  getNearbyAttractions
};
