const AppError = require('../utils/appError');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const SEARCH_RADIUS_METERS = 10000;
const DEFAULT_RESULT_LIMIT = 8;
const MAX_RESULT_LIMIT = 15;
const OVERPASS_CANDIDATE_LIMIT = 80;
const OVERPASS_TIMEOUT_MS = 8000;
const NOMINATIM_TIMEOUT_MS = 5000;
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

async function getNearbyAttractions(latitude, longitude, preferences = [], requestedLimit = DEFAULT_RESULT_LIMIT, location = {}) {
  const resultLimit = Math.min(Math.max(Number(requestedLimit) || DEFAULT_RESULT_LIMIT, 5), MAX_RESULT_LIMIT);
  const filters = getTargetFilters(preferences);
  const hasPreferenceSearch = hasKnownPreference(preferences);
  const searchRadiusMeters = SEARCH_RADIUS_METERS;
  let attractions = [];
  let searchError;
  let message;

  try {
    attractions = await fetchAttractions(latitude, longitude, filters, resultLimit, searchRadiusMeters);
  } catch (error) {
    searchError = error;
  }

  if (!attractions.length) {
    if (hasPreferenceSearch) {
      message = 'No matching preference-specific places were found, so the plan uses a broader destination-level place search.';
    }

    attractions = await searchNamedPlaces({ ...location, latitude, longitude }, resultLimit);
  }

  const attractionCount = Array.isArray(attractions) ? attractions.length : attractions.items.length;

  if (!attractionCount && searchError) {
    return {
      provider: 'Destination fallback',
      searchRadiusMeters,
      searchFocus: getSearchFocus(preferences),
      available: false,
      message: 'Live nearby places could not be loaded, so the plan uses the saved destination as the daily planning area.',
      attractions: []
    };
  }

  return {
    provider: attractions.provider || 'OpenStreetMap Overpass API',
    searchRadiusMeters,
    searchFocus: getSearchFocus(preferences),
    available: true,
    message,
    attractions: attractions.items || attractions
  };
}

async function fetchAttractions(latitude, longitude, filters, resultLimit, radiusMeters) {
  const statements = filters
    .flatMap((filter) => [
      `node(around:${radiusMeters},${latitude},${longitude})${filter}${ACTIVE_PLACE_FILTER};`,
      `way(around:${radiusMeters},${latitude},${longitude})${filter}${ACTIVE_PLACE_FILTER};`
    ])
    .join('\n');
  const candidateLimit = Math.max(resultLimit * 5, OVERPASS_CANDIDATE_LIMIT);
  const query = `
    [out:json][timeout:8];
    (
      ${statements}
    );
    out center tags ${candidateLimit};
  `;
  const params = new URLSearchParams({ data: query });
  let response;

  try {
    response = await fetchWithTimeout(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SmartTravelPlannerApp/1.0'
      },
      body: params
    }, OVERPASS_TIMEOUT_MS);
  } catch (error) {
    throw new AppError('Unable to fetch nearby attractions: network request failed', 503);
  }

  if (!response.ok) {
    throw new AppError(`Unable to fetch nearby attractions: external API returned ${response.status}`, 502);
  }

  const data = await response.json();

  return normalizeAttractions(data.elements || [], resultLimit);
}

async function searchNamedPlaces(location, resultLimit) {
  const placeText = getLocationText(location);

  if (!placeText) {
    return { provider: 'OpenStreetMap Nominatim', items: [] };
  }

  const params = new URLSearchParams({
    q: `tourist attractions in ${placeText}`,
    format: 'jsonv2',
    limit: String(resultLimit),
    addressdetails: '1',
    namedetails: '1',
    extratags: '1'
  });
  const viewbox = getViewbox(location.latitude, location.longitude);

  if (viewbox) {
    params.set('viewbox', viewbox);
    params.set('bounded', '1');
  }

  const data = await fetchNominatim(`${NOMINATIM_URL}?${params}`);

  return {
    provider: 'OpenStreetMap Nominatim',
    items: dedupeAttractions(data.map((item) => mapNominatimPlace(item, 'tourist attraction')))
      .filter((place) => place.name && isActivePlaceName(place.name))
      .slice(0, resultLimit)
  };
}

async function fetchNominatim(url) {
  let response;

  try {
    response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'SmartTravelPlannerApp/1.0'
      }
    }, NOMINATIM_TIMEOUT_MS);
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
  return !/(^closed\b|permanently closed|temporarily closed|closed down|shut down)/i.test(String(name || ''));
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

function getViewbox(latitude, longitude) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return undefined;
  }

  const lat = Number(latitude);
  const lon = Number(longitude);
  const offset = 0.25;

  return [
    lon - offset,
    lat + offset,
    lon + offset,
    lat - offset
  ].join(',');
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
