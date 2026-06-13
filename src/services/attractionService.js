const AppError = require('../utils/appError');

const WIKIDATA_QUERY_URL = 'https://query.wikidata.org/sparql';
const SEARCH_RADIUS_METERS = 10000;
const DEFAULT_RESULT_LIMIT = 8;
const MAX_RESULT_LIMIT = 15;

const preferenceTypes = {
  food: ['wd:Q11707', 'wd:Q30022'],
  culture: ['wd:Q570116', 'wd:Q33506', 'wd:Q44539', 'wd:Q16970', 'wd:Q4989906'],
  museums: ['wd:Q33506'],
  beach: ['wd:Q40080'],
  nature: ['wd:Q22698', 'wd:Q1107656', 'wd:Q8502', 'wd:Q23397'],
  shopping: ['wd:Q11315', 'wd:Q37654'],
  nightlife: ['wd:Q187456', 'wd:Q622425'],
  family: ['wd:Q22698', 'wd:Q43501', 'wd:Q194195', 'wd:Q2281788']
};

const defaultTypes = [
  'wd:Q570116',
  'wd:Q33506',
  'wd:Q839954',
  'wd:Q4989906',
  'wd:Q24354',
  'wd:Q22698',
  'wd:Q44539',
  'wd:Q40080',
  'wd:Q2977',
  'wd:Q16970',
  'wd:Q41176'
];

async function getNearbyAttractions(latitude, longitude, preferences = [], requestedLimit = DEFAULT_RESULT_LIMIT) {
  const resultLimit = Math.min(Math.max(Number(requestedLimit) || DEFAULT_RESULT_LIMIT, 5), MAX_RESULT_LIMIT);
  const targetTypes = getTargetTypes(preferences);
  const attractions = await fetchAttractions(latitude, longitude, targetTypes, resultLimit);

  return {
    provider: 'Wikidata Query Service',
    searchRadiusMeters: SEARCH_RADIUS_METERS,
    searchFocus: getSearchFocus(preferences),
    available: true,
    attractions
  };
}

async function fetchAttractions(latitude, longitude, targetTypes, resultLimit) {
  const radiusKm = SEARCH_RADIUS_METERS / 1000;
  const values = targetTypes.map((type) => `        ${type}`).join('\n');
  const query = `
    SELECT ?place ?placeLabel ?location (SAMPLE(?typeLabel) AS ?categoryLabel) (SAMPLE(?article) AS ?article) WHERE {
      VALUES ?targetType {
${values}
      }

      SERVICE wikibase:around {
        ?place wdt:P625 ?location .
        bd:serviceParam wikibase:center "Point(${longitude} ${latitude})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "${radiusKm}" .
      }

      ?place wdt:P31 ?type .
      ?type wdt:P279* ?targetType .
      OPTIONAL {
        ?article schema:about ?place ;
          schema:isPartOf <https://en.wikipedia.org/> .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    GROUP BY ?place ?placeLabel ?location
    LIMIT ${resultLimit}
  `;

  const params = new URLSearchParams({
    query,
    format: 'json'
  });

  let response;

  try {
    response = await fetch(`${WIKIDATA_QUERY_URL}?${params}`, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'SmartTravelPlannerApp/1.0'
      }
    });
  } catch (error) {
    throw new AppError('Unable to fetch nearby attractions: network request failed', 503);
  }

  if (!response.ok) {
    throw new AppError(`Unable to fetch nearby attractions: external API returned ${response.status}`, 502);
  }

  const data = await response.json();
  const attractions = (data.results?.bindings || [])
    .map(mapAttraction)
    .filter((attraction) => attraction.name)
    .slice(0, resultLimit);

  return attractions;
}

function getTargetTypes(preferences) {
  const selected = preferences
    .map((preference) => preference.toLowerCase())
    .flatMap((preference) => preferenceTypes[preference] || []);

  return [...new Set(selected.length ? selected : defaultTypes)];
}

function getSearchFocus(preferences) {
  const selected = preferences.filter((preference) => preferenceTypes[preference.toLowerCase()]);

  return selected.length ? selected : ['general'];
}

function mapAttraction(binding) {
  const coordinates = parsePoint(binding.location?.value);
  const wikidataId = binding.place?.value?.split('/').pop();

  return {
    id: wikidataId,
    name: binding.placeLabel?.value,
    category: binding.categoryLabel?.value || 'point of interest',
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
    url: binding.article?.value || `https://www.wikidata.org/wiki/${wikidataId}`
  };
}

function parsePoint(value) {
  const match = value?.match(/Point\(([-\d.]+) ([-\d.]+)\)/);

  if (!match) {
    return undefined;
  }

  return {
    longitude: Number(match[1]),
    latitude: Number(match[2])
  };
}

module.exports = {
  getNearbyAttractions
};
