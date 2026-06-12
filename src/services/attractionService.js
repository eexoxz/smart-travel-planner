const AppError = require('../utils/appError');

const WIKIDATA_QUERY_URL = 'https://query.wikidata.org/sparql';
const SEARCH_RADIUS_METERS = 10000;
const RESULT_LIMIT = 5;

async function getNearbyAttractions(latitude, longitude) {
  const radiusKm = SEARCH_RADIUS_METERS / 1000;
  const query = `
    SELECT ?place ?placeLabel ?location (SAMPLE(?typeLabel) AS ?categoryLabel) (SAMPLE(?article) AS ?article) WHERE {
      VALUES ?targetType {
        wd:Q570116    # tourist attraction
        wd:Q33506     # museum
        wd:Q839954    # archaeological site
        wd:Q4989906   # monument
        wd:Q24354     # theatre
        wd:Q22698     # park
        wd:Q44539     # temple
        wd:Q40080     # beach
        wd:Q2977      # cathedral
        wd:Q16970     # church
        wd:Q41176     # building
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
    LIMIT ${RESULT_LIMIT}
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
    .slice(0, RESULT_LIMIT);

  return {
    provider: 'Wikidata Query Service',
    searchRadiusMeters: SEARCH_RADIUS_METERS,
    available: true,
    attractions
  };
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
