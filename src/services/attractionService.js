const AppError = require('../utils/appError');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];
const SEARCH_RADIUS_METERS = 10000;
const FALLBACK_RADIUS_METERS = 20000;
const DEFAULT_RESULT_LIMIT = 8;
const MAX_RESULT_LIMIT = 15;
const OVERPASS_CANDIDATE_LIMIT = 80;
const ACTIVE_PLACE_FILTER = '["name"]["disused"!~"."]["abandoned"!~"."]["demolished"!~"."]["razed"!~"."]["removed"!~"."]["closed"!~"."]["construction"!~"."]';

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
  const hasPreferenceSearch = hasKnownPreference(preferences);
  let searchRadiusMeters = SEARCH_RADIUS_METERS;
  let attractions = await fetchAttractions(latitude, longitude, filters, resultLimit, searchRadiusMeters);

  if (!attractions.length && hasPreferenceSearch) {
    searchRadiusMeters = FALLBACK_RADIUS_METERS;
    attractions = await fetchAttractions(latitude, longitude, defaultFilters, resultLimit, searchRadiusMeters);
  }

  return {
    provider: 'OpenStreetMap Overpass API',
    searchRadiusMeters,
    searchFocus: getSearchFocus(preferences),
    available: true,
    attractions
  };
}

async function fetchAttractions(latitude, longitude, filters, resultLimit, radiusMeters) {
  const statements = filters
    .flatMap((filter) => [
      `node(around:${radiusMeters},${latitude},${longitude})${filter}${ACTIVE_PLACE_FILTER};`,
      `way(around:${radiusMeters},${latitude},${longitude})${filter}${ACTIVE_PLACE_FILTER};`,
      `relation(around:${radiusMeters},${latitude},${longitude})${filter}${ACTIVE_PLACE_FILTER};`
    ])
    .join('\n');
  const candidateLimit = Math.max(resultLimit * 5, OVERPASS_CANDIDATE_LIMIT);
  const query = `
    [out:json][timeout:15];
    (
      ${statements}
    );
    out center tags ${candidateLimit};
  `;
  const params = new URLSearchParams({ data: query });
  let lastError;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SmartTravelPlannerApp/1.0'
        },
        body: params
      });

      if (!response.ok) {
        lastError = new AppError(`Unable to fetch nearby attractions: external API returned ${response.status}`, 502);
        continue;
      }

      const data = await response.json();

      return normalizeAttractions(data.elements || [], resultLimit);
    } catch (error) {
      lastError = error instanceof AppError
        ? error
        : new AppError('Unable to fetch nearby attractions: network request failed', 503);
    }
  }

  throw lastError || new AppError('Unable to fetch nearby attractions: network request failed', 503);
}

function normalizeAttractions(elements, resultLimit) {
  const seen = new Set();

  return elements
    .filter((element) => isOpenPlace(element.tags || {}))
    .map(mapAttraction)
    .filter((attraction) => attraction.name)
    .filter((attraction) => {
      const key = `${attraction.name.toLowerCase()}|${attraction.category.toLowerCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
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

function hasKnownPreference(preferences) {
  return preferences.some((preference) => preferenceFilters[preference.toLowerCase()]);
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
  return tags.amenity
    || tags.tourism
    || tags.historic
    || tags.leisure
    || tags.natural
    || tags.shop
    || tags.cuisine
    || 'point of interest';
}

function isOpenPlace(tags) {
  const inactiveKeys = ['disused', 'abandoned', 'demolished', 'razed', 'removed', 'closed', 'construction'];
  const inactiveValues = new Set(['abandoned', 'closed', 'construction', 'demolished', 'disused', 'razed', 'removed', 'vacant']);
  const categoryKeys = ['amenity', 'tourism', 'historic', 'leisure', 'natural', 'shop'];

  if (inactiveKeys.some((key) => isTruthyTag(tags[key]))) {
    return false;
  }

  if (Object.keys(tags).some((key) => inactiveKeys.some((prefix) => key.startsWith(`${prefix}:`)))) {
    return false;
  }

  return !categoryKeys.some((key) => inactiveValues.has(String(tags[key] || '').toLowerCase()));
}

function isTruthyTag(value) {
  return ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());
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
