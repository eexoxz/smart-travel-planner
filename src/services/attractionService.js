const AppError = require('../utils/appError');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const WIKIMEDIA_URL = 'https://en.wikipedia.org/w/api.php';
const SEARCH_RADIUS_METERS = 10000;
const DEFAULT_RESULT_LIMIT = 8;
const MAX_RESULT_LIMIT = 15;
const OVERPASS_CANDIDATE_LIMIT = 80;
const OVERPASS_TIMEOUT_MS = 8000;
const NOMINATIM_TIMEOUT_MS = 5000;
const WIKIMEDIA_TIMEOUT_MS = 5000;
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

const preferenceSearchTerms = {
  food: ['restaurants', 'cafes', 'food markets'],
  culture: ['tourist attractions', 'historic landmarks', 'temples'],
  museums: ['museums', 'art galleries'],
  beach: ['beaches', 'waterfront attractions'],
  nature: ['parks', 'gardens', 'viewpoints'],
  shopping: ['shopping streets', 'markets', 'malls'],
  nightlife: ['night markets', 'bars', 'nightlife'],
  family: ['family attractions', 'parks', 'aquariums']
};

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

    attractions = await searchNamedPlaces({ ...location, latitude, longitude }, preferences, resultLimit);
  }

  if (!getAttractionCount(attractions)) {
    attractions = await searchWikimediaPlaces({ ...location, latitude, longitude }, preferences, resultLimit);
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

function getAttractionCount(attractions) {
  return Array.isArray(attractions) ? attractions.length : attractions.items.length;
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

async function searchWikimediaPlaces(location, preferences, resultLimit) {
  if (!Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
    return { provider: 'Wikimedia geosearch fallback', items: [] };
  }

  const params = new URLSearchParams({
    action: 'query',
    list: 'geosearch',
    gscoord: `${location.latitude}|${location.longitude}`,
    gsradius: '10000',
    gslimit: '50',
    format: 'json',
    origin: '*'
  });
  const data = await fetchWikimedia(`${WIKIMEDIA_URL}?${params}`);
  const pages = data.query?.geosearch || [];

  return {
    provider: 'Wikimedia geosearch fallback',
    items: normalizeWikimediaPlaces(pages, preferences, resultLimit)
  };
}

async function fetchWikimedia(url) {
  let response;

  try {
    response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'SmartTravelPlannerApp/1.0'
      }
    }, WIKIMEDIA_TIMEOUT_MS);
  } catch (error) {
    return {};
  }

  if (!response || !response.ok) {
    return {};
  }

  return response.json();
}

async function searchNamedPlaces(location, preferences, resultLimit) {
  const placeText = getLocationText(location);

  if (!placeText) {
    return { provider: 'OpenStreetMap Nominatim', items: [] };
  }

  const terms = getNominatimTerms(preferences);
  const viewbox = getViewbox(location.latitude, location.longitude);
  const results = [];
  const minimumSearches = Math.max(getKnownPreferences(preferences).length, 1);

  for (const [index, search] of terms.entries()) {
    const params = new URLSearchParams({
      q: `${search.term} in ${placeText}`,
      format: 'jsonv2',
      limit: String(Math.min(Math.max(Math.ceil(resultLimit / terms.length) + 2, 3), 8)),
      addressdetails: '1',
      namedetails: '1',
      extratags: '1'
    });

    if (viewbox) {
      params.set('viewbox', viewbox);
      params.set('bounded', '1');
    }

    const data = await fetchNominatim(`${NOMINATIM_URL}?${params}`);
    results.push(...data.map((item) => mapNominatimPlace(item, search.term, search.preference)));

    if (index + 1 >= minimumSearches && dedupeAttractions(results).length >= resultLimit) {
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

  const data = await response.json();

  return Array.isArray(data) ? data : [];
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

function normalizeWikimediaPlaces(pages, preferences, resultLimit) {
  return pages
    .map((page) => {
      const category = getWikimediaCategory(page.title, preferences);

      return {
        id: `wikimedia/${page.pageid}`,
        name: page.title,
        category,
        latitude: page.lat,
        longitude: page.lon,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
        score: getPreferenceScore(page.title, preferences)
      };
    })
    .filter((place) => place.name && isActivePlaceName(place.name))
    .sort((left, right) => right.score - left.score)
    .filter(dedupeByNameAndCategory())
    .slice(0, resultLimit)
    .map(({ score: _score, ...place }, index) => ({
      ...place,
      order: index + 1
    }));
}

function getTargetFilters(preferences) {
  const selected = preferences
    .map((preference) => preference.toLowerCase())
    .flatMap((preference) => preferenceFilters[preference] || []);

  return [...new Set(selected.length ? selected : defaultFilters)];
}

function getSearchFocus(preferences) {
  const selected = getKnownPreferences(preferences);

  return selected.length ? selected : ['general'];
}

function hasKnownPreference(preferences) {
  return preferences.some((preference) => preferenceFilters[preference.toLowerCase()]);
}

function getNominatimTerms(preferences) {
  const selectedPreferences = getKnownPreferences(preferences);

  if (!selectedPreferences.length) {
    return ['tourist attractions', 'restaurants', 'parks'].map((term) => ({
      term,
      preference: 'general'
    }));
  }

  const searches = [];
  const maxTermsPerPreference = Math.max(...selectedPreferences.map((preference) => preferenceSearchTerms[preference].length));

  for (let index = 0; index < maxTermsPerPreference; index += 1) {
    for (const preference of selectedPreferences) {
      const term = preferenceSearchTerms[preference][index];

      if (term) {
        searches.push({ term, preference });
      }
    }
  }

  return searches.slice(0, Math.min(Math.max(selectedPreferences.length * 2, 5), 10));
}

function getKnownPreferences(preferences) {
  return [...new Set(preferences
    .map((preference) => preference.toLowerCase())
    .filter((preference) => preferenceFilters[preference]))];
}

function getPreferenceScore(name, preferences) {
  const lowerName = name.toLowerCase();
  const tags = preferences.map((preference) => preference.toLowerCase());

  return tags.reduce((score, tag) => score + getPreferenceKeywords(tag)
    .filter((keyword) => lowerName.includes(keyword)).length, 0);
}

function getWikimediaCategory(name, preferences) {
  const tags = preferences.map((preference) => preference.toLowerCase());
  const matchedTag = tags.find((tag) => getPreferenceKeywords(tag)
    .some((keyword) => name.toLowerCase().includes(keyword)));

  return matchedTag || 'point of interest';
}

function getPreferenceKeywords(preference) {
  const keywords = {
    food: ['market', 'food', 'restaurant', 'cafe', 'street'],
    culture: ['temple', 'shrine', 'palace', 'church', 'tower', 'historic', 'village', 'monument'],
    museums: ['museum', 'gallery'],
    beach: ['beach', 'bay', 'coast', 'waterfront'],
    nature: ['park', 'garden', 'mountain', 'river', 'lake', 'forest', 'island'],
    shopping: ['market', 'mall', 'shopping', 'street'],
    nightlife: ['night', 'bar', 'club', 'square', 'street'],
    family: ['zoo', 'aquarium', 'park', 'garden', 'museum']
  };

  return keywords[preference] || [];
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

function mapNominatimPlace(item, term, preference) {
  const address = item.address || {};
  const namedetails = item.namedetails || {};
  const name = namedetails.name
    || item.name
    || item.display_name?.split(',')[0];
  const type = item.type || item.category || term;

  return {
    id: `${item.osm_type}/${item.osm_id}`,
    name,
    category: getNominatimCategory(type, term, preference),
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    address: [address.road, address.city || address.town || address.county].filter(Boolean).join(', ') || undefined,
    url: item.osm_type && item.osm_id
      ? `https://www.openstreetmap.org/${item.osm_type}/${item.osm_id}`
      : item.display_name
  };
}

function getNominatimCategory(type, term, preference) {
  const category = String(type || '').replaceAll('_', ' ').toLowerCase();

  if (category && !['yes', 'attraction', 'point'].includes(category)) {
    return category;
  }

  if (preference && preference !== 'general') {
    return preference;
  }

  return term.replaceAll('_', ' ');
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
