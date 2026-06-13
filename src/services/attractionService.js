const AppError = require('../utils/appError');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
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

const preferenceSearchTerms = {
  food: ['cafes', 'restaurants', 'food markets'],
  culture: ['landmarks', 'cultural attractions'],
  museums: ['museums', 'galleries'],
  beach: ['beaches'],
  nature: ['parks', 'nature attractions'],
  shopping: ['shopping areas', 'markets'],
  nightlife: ['bars', 'nightlife'],
  family: ['family attractions', 'parks']
};

const defaultFilters = [
  '["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium)$"]',
  '["historic"]',
  '["leisure"~"^(park|garden)$"]',
  '["natural"="beach"]',
  '["amenity"~"^(cafe|restaurant|marketplace)$"]'
];

async function getNearbyAttractions(latitude, longitude, preferences = [], requestedLimit = DEFAULT_RESULT_LIMIT, location = {}) {
  const resultLimit = Math.min(Math.max(Number(requestedLimit) || DEFAULT_RESULT_LIMIT, 5), MAX_RESULT_LIMIT);
  const filters = getTargetFilters(preferences);
  const hasPreferenceSearch = hasKnownPreference(preferences);
  let searchRadiusMeters = SEARCH_RADIUS_METERS;
  let attractions = [];
  let searchError;

  try {
    attractions = await fetchAttractions(latitude, longitude, filters, resultLimit, searchRadiusMeters);

    if (!attractions.length && hasPreferenceSearch) {
      searchRadiusMeters = FALLBACK_RADIUS_METERS;
      attractions = await fetchAttractions(latitude, longitude, defaultFilters, resultLimit, searchRadiusMeters);
    }
  } catch (error) {
    searchError = error;
  }

  if (!attractions.length) {
    attractions = await searchNamedPlaces(location, preferences, resultLimit);
  }

  const attractionCount = Array.isArray(attractions) ? attractions.length : attractions.items.length;

  if (!attractionCount && searchError) {
    throw searchError;
  }

  return {
    provider: attractions.provider || 'OpenStreetMap Overpass API',
    searchRadiusMeters,
    searchFocus: getSearchFocus(preferences),
    available: true,
    attractions: attractions.items || attractions
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

async function searchNamedPlaces(location, preferences, resultLimit) {
  const placeText = getLocationText(location);

  if (!placeText) {
    return { provider: 'OpenStreetMap Nominatim', items: [] };
  }

  const terms = getSearchTerms(preferences).slice(0, 3);
  const results = [];

  for (const term of terms) {
    const params = new URLSearchParams({
      q: `${term} in ${placeText}`,
      format: 'jsonv2',
      limit: '6',
      addressdetails: '1',
      namedetails: '1',
      extratags: '1'
    });
    const data = await fetchNominatim(`${NOMINATIM_URL}?${params}`);

    results.push(...data.map((item) => mapNominatimPlace(item, term)));

    if (results.length >= Math.min(resultLimit, 5)) {
      break;
    }
  }

  return {
    provider: 'OpenStreetMap Nominatim',
    items: dedupeAttractions(results)
      .filter((place) => place.name && isActivePlaceName(place.name))
      .slice(0, resultLimit)
  };
}

async function fetchNominatim(url) {
  let response;

  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'SmartTravelPlannerApp/1.0'
      }
    });
  } catch (error) {
    return [];
  }

  if (!response || !response.ok) {
    return [];
  }

  return response.json();
}

function normalizeAttractions(elements, resultLimit) {
  return elements
    .filter((element) => isOpenPlace(element.tags || {}))
    .map(mapAttraction)
    .filter((attraction) => attraction.name)
    .filter((attraction) => isActivePlaceName(attraction.name))
    .filter((attraction) => attraction.latitude && attraction.longitude)
    .filter(dedupeByNameAndCategory())
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

function getSearchTerms(preferences) {
  const selected = preferences
    .map((preference) => preference.toLowerCase())
    .flatMap((preference) => preferenceSearchTerms[preference] || []);

  return [...new Set(selected.length ? selected : ['attractions', 'restaurants', 'parks'])];
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

function mapNominatimPlace(item, term) {
  const address = item.address || {};
  const namedetails = item.namedetails || {};
  const name = namedetails.name
    || item.name
    || item.display_name?.split(',')[0];
  const type = item.type || item.category || term;

  return {
    id: `${item.osm_type}/${item.osm_id}`,
    name,
    category: type.replaceAll('_', ' '),
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    address: [address.road, address.city || address.town || address.county].filter(Boolean).join(', ') || undefined,
    url: item.osm_type && item.osm_id
      ? `https://www.openstreetmap.org/${item.osm_type}/${item.osm_id}`
      : item.display_name
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
  const inactiveKeys = ['disused', 'abandoned', 'demolished', 'razed', 'removed', 'closed', 'construction', 'former', 'was'];
  const inactiveValues = new Set(['abandoned', 'closed', 'construction', 'demolished', 'disused', 'razed', 'removed', 'vacant']);
  const categoryKeys = ['amenity', 'tourism', 'historic', 'leisure', 'natural', 'shop'];

  if (!isActivePlaceName(tags.name)) {
    return false;
  }

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

function isActivePlaceName(name) {
  return !/(^closed\b|permanently closed|temporarily closed|closed down|shut down|폐업|영업종료)/i.test(String(name || ''));
}

function dedupeAttractions(items) {
  return items.filter(dedupeByNameAndCategory());
}

function dedupeByNameAndCategory() {
  const seen = new Set();

  return (attraction) => {
    const key = `${attraction.name.toLowerCase()}|${attraction.category.toLowerCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  };
}

function getLocationText(location = {}) {
  return [
    location.destination,
    location.region,
    location.country
  ].filter(Boolean).join(', ');
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
