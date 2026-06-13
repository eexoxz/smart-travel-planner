const placeCatalog = [
  {
    keys: ['busan'],
    country: 'south korea',
    places: [
      place('Gamcheon Culture Village', 'culture', ['culture', 'family'], 'https://www.openstreetmap.org/search?query=Gamcheon%20Culture%20Village%20Busan'),
      place('Haeundae Beach', 'beach', ['beach', 'nature', 'family'], 'https://www.openstreetmap.org/search?query=Haeundae%20Beach%20Busan'),
      place('Jagalchi Market', 'marketplace', ['food', 'culture', 'shopping'], 'https://www.openstreetmap.org/search?query=Jagalchi%20Market%20Busan'),
      place('Haedong Yonggungsa Temple', 'temple', ['culture', 'nature'], 'https://www.openstreetmap.org/search?query=Haedong%20Yonggungsa%20Temple%20Busan'),
      place('Gwangalli Beach', 'beach', ['beach', 'nightlife'], 'https://www.openstreetmap.org/search?query=Gwangalli%20Beach%20Busan'),
      place('BIFF Square', 'street food area', ['food', 'shopping', 'culture'], 'https://www.openstreetmap.org/search?query=BIFF%20Square%20Busan'),
      place('Taejongdae Resort Park', 'park', ['nature', 'family'], 'https://www.openstreetmap.org/search?query=Taejongdae%20Busan'),
      place('Busan Museum of Art', 'museum', ['museums', 'culture'], 'https://www.openstreetmap.org/search?query=Busan%20Museum%20of%20Art'),
      place('Seomyeon Food Alley', 'food street', ['food', 'nightlife'], 'https://www.openstreetmap.org/search?query=Seomyeon%20Food%20Alley%20Busan'),
      place('Songdo Cloud Trails', 'coastal walk', ['nature', 'family'], 'https://www.openstreetmap.org/search?query=Songdo%20Cloud%20Trails%20Busan')
    ]
  },
  {
    keys: ['jeju', 'jeju city'],
    country: 'south korea',
    places: [
      place('Dongmun Market', 'marketplace', ['food', 'shopping', 'culture'], 'https://www.openstreetmap.org/search?query=Dongmun%20Market%20Jeju'),
      place('Yongduam Rock', 'natural landmark', ['nature', 'culture'], 'https://www.openstreetmap.org/search?query=Yongduam%20Rock%20Jeju'),
      place('Iho Tewoo Beach', 'beach', ['beach', 'nature'], 'https://www.openstreetmap.org/search?query=Iho%20Tewoo%20Beach%20Jeju'),
      place('Jeju National Museum', 'museum', ['museums', 'culture'], 'https://www.openstreetmap.org/search?query=Jeju%20National%20Museum'),
      place('Sarabong Park', 'park', ['nature', 'family'], 'https://www.openstreetmap.org/search?query=Sarabong%20Park%20Jeju'),
      place('Black Pork Street', 'food street', ['food', 'nightlife'], 'https://www.openstreetmap.org/search?query=Black%20Pork%20Street%20Jeju')
    ]
  },
  {
    keys: ['kyoto'],
    country: 'japan',
    places: [
      place('Nishiki Market', 'marketplace', ['food', 'shopping', 'culture'], 'https://www.openstreetmap.org/search?query=Nishiki%20Market%20Kyoto'),
      place('Fushimi Inari Taisha', 'shrine', ['culture', 'nature'], 'https://www.openstreetmap.org/search?query=Fushimi%20Inari%20Taisha'),
      place('Kiyomizu-dera', 'temple', ['culture', 'family'], 'https://www.openstreetmap.org/search?query=Kiyomizu-dera%20Kyoto'),
      place('Arashiyama Bamboo Grove', 'nature area', ['nature', 'family'], 'https://www.openstreetmap.org/search?query=Arashiyama%20Bamboo%20Grove'),
      place('Kyoto National Museum', 'museum', ['museums', 'culture'], 'https://www.openstreetmap.org/search?query=Kyoto%20National%20Museum'),
      place('Gion', 'historic district', ['culture', 'nightlife', 'food'], 'https://www.openstreetmap.org/search?query=Gion%20Kyoto')
    ]
  },
  {
    keys: ['penang', 'george town', 'georgetown'],
    country: 'malaysia',
    places: [
      place('George Town Street Art', 'street art area', ['culture', 'family'], 'https://www.openstreetmap.org/search?query=George%20Town%20Street%20Art%20Penang'),
      place('Gurney Drive Hawker Centre', 'food centre', ['food', 'nightlife'], 'https://www.openstreetmap.org/search?query=Gurney%20Drive%20Hawker%20Centre'),
      place('Kek Lok Si Temple', 'temple', ['culture', 'family'], 'https://www.openstreetmap.org/search?query=Kek%20Lok%20Si%20Temple'),
      place('Penang Hill', 'hill viewpoint', ['nature', 'family'], 'https://www.openstreetmap.org/search?query=Penang%20Hill'),
      place('Batu Ferringhi Beach', 'beach', ['beach', 'nature'], 'https://www.openstreetmap.org/search?query=Batu%20Ferringhi%20Beach'),
      place('Chew Jetty', 'heritage area', ['culture', 'food'], 'https://www.openstreetmap.org/search?query=Chew%20Jetty%20Penang')
    ]
  },
  {
    keys: ['kuala lumpur'],
    country: 'malaysia',
    places: [
      place('Petronas Twin Towers', 'landmark', ['culture', 'family', 'shopping'], 'https://www.openstreetmap.org/search?query=Petronas%20Twin%20Towers'),
      place('Jalan Alor', 'food street', ['food', 'nightlife'], 'https://www.openstreetmap.org/search?query=Jalan%20Alor%20Kuala%20Lumpur'),
      place('Batu Caves', 'cultural landmark', ['culture', 'nature'], 'https://www.openstreetmap.org/search?query=Batu%20Caves'),
      place('KLCC Park', 'park', ['nature', 'family'], 'https://www.openstreetmap.org/search?query=KLCC%20Park'),
      place('Central Market', 'marketplace', ['shopping', 'culture'], 'https://www.openstreetmap.org/search?query=Central%20Market%20Kuala%20Lumpur')
    ]
  },
  {
    keys: ['singapore'],
    country: 'singapore',
    places: [
      place('Gardens by the Bay', 'garden', ['nature', 'family'], 'https://www.openstreetmap.org/search?query=Gardens%20by%20the%20Bay'),
      place('Maxwell Food Centre', 'food centre', ['food'], 'https://www.openstreetmap.org/search?query=Maxwell%20Food%20Centre'),
      place('National Gallery Singapore', 'museum', ['museums', 'culture'], 'https://www.openstreetmap.org/search?query=National%20Gallery%20Singapore'),
      place('Sentosa', 'island resort', ['beach', 'family'], 'https://www.openstreetmap.org/search?query=Sentosa%20Singapore'),
      place('Chinatown', 'heritage district', ['food', 'culture', 'shopping'], 'https://www.openstreetmap.org/search?query=Chinatown%20Singapore')
    ]
  }
];

function getCuratedPlaces(location = {}, preferences = [], limit = 8) {
  const entry = findCatalogEntry(location);

  if (!entry) {
    return {
      items: [],
      matchedPreferences: false
    };
  }

  const tags = preferences.map((preference) => normalize(preference)).filter(Boolean);
  const preferred = tags.length
    ? entry.places.filter((item) => item.tags.some((tag) => tags.includes(tag)))
    : entry.places;
  const ordered = preferred.length
    ? [...preferred, ...entry.places.filter((item) => !preferred.includes(item))]
    : entry.places;

  return {
    items: ordered.slice(0, limit).map(({ tags: _tags, ...item }, index) => ({
      ...item,
      id: `curated/${normalize(item.name).replaceAll(' ', '-')}`,
      order: index + 1
    })),
    matchedPreferences: preferred.length > 0
  };
}

function findCatalogEntry(location = {}) {
  const destinationText = normalize([
    location.destination,
    location.region,
    location.country
  ].filter(Boolean).join(' '));
  const country = normalize(location.country);

  return placeCatalog.find((entry) => {
    const countryMatches = !entry.country || !country || entry.country === country;

    return countryMatches && entry.keys.some((key) => destinationText.includes(key));
  });
}

function place(name, category, tags, url) {
  return {
    name,
    category,
    tags,
    url
  };
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

module.exports = {
  getCuratedPlaces
};
