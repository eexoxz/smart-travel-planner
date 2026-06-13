process.env.NODE_ENV = 'test';
process.env.DATABASE_FILE = './data/test-planner.sqlite';
process.env.JWT_SECRET = 'test_secret_for_planner_tests';

const request = require('supertest');
const createApp = require('../src/app');
const { resetStore } = require('../src/db/sqliteStore');

let app;
let token;
let tripId;

beforeAll(async () => {
  resetStore(process.env.DATABASE_FILE);
  app = createApp();

  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          name: 'Kyoto',
          country: 'Japan',
          admin1: 'Kyoto',
          latitude: 35.0116,
          longitude: 135.7681,
          timezone: 'Asia/Tokyo'
        }]
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          time: '2026-06-01T12:00',
          temperature_2m: 28,
          relative_humidity_2m: 70,
          weather_code: 2,
          wind_speed_10m: 10
        }
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 444444,
            lat: 35.004,
            lon: 135.763,
            tags: {
              name: 'Closed Coffee Shop',
              amenity: 'cafe',
              disused: 'yes'
            }
          },
          {
            type: 'node',
            id: 555555,
            lat: 35.004,
            lon: 135.763,
            tags: {
              amenity: 'cafe'
            }
          },
          {
            type: 'node',
            id: 703170,
            lat: 35.005,
            lon: 135.764,
            tags: {
              name: 'Nishiki Market',
              amenity: 'marketplace',
              website: 'https://example.com/nishiki'
            }
          },
          {
            type: 'node',
            id: 123456,
            lat: 35.006,
            lon: 135.765,
            tags: {
              name: 'Kyoto Coffee Stand',
              amenity: 'cafe',
              cuisine: 'coffee_shop'
            }
          }
        ]
      })
    });

  const registered = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Planner Tester',
      email: 'planner@example.com',
      password: 'Password123'
    });

  token = registered.body.data.token;

  const trip = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      destination: 'Kyoto',
      country: 'Japan',
      region: 'Kyoto',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      preferenceTags: ['food', 'museums']
    });

  tripId = trip.body.data.id;
});

afterAll(() => {
  resetStore(process.env.DATABASE_FILE);
  jest.restoreAllMocks();
});

test('builds trip summary', async () => {
  const response = await request(app)
    .get(`/api/v1/planner/trips/${tripId}/summary`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.trip.destination).toBe('Kyoto');
  expect(response.body.data.externalData.weather.provider).toBe('Open-Meteo');
  expect(response.body.data.externalData.weather.location.region).toBe('Kyoto');
  expect(response.body.data.externalData.weather.currentWeather.description).toBe('Partly cloudy');
  expect(response.body.data.externalData.attractions.provider).toBe('OpenStreetMap Overpass API');
  expect(response.body.data.externalData.attractions.available).toBe(true);
  expect(response.body.data.externalData.attractions.searchFocus).toContain('food');
  expect(response.body.data.externalData.attractions.searchFocus).toContain('museums');
  expect(response.body.data.externalData.attractions.attractions[0].name).toBe('Nishiki Market');
  expect(response.body.data.externalData.attractions.attractions.map((item) => item.name)).not.toContain('Closed Coffee Shop');
  expect(response.body.data.recommendation.summary).toContain('Nearby attractions');
  expect(response.body.data.travelPlan.title).toBe('Kyoto travel plan');
  expect(response.body.data.travelPlan.suggestedPlaces[0].name).toBe('Nishiki Market');
  expect(response.body.data.travelPlan.itinerary).toHaveLength(3);
  expect(response.body.data.travelPlan.itinerary[0]).toMatchObject({
    day: 1,
    date: '2026-07-10',
    theme: 'Food and local neighbourhoods',
    location: 'Nishiki Market',
    bestTime: 'Late afternoon or evening.'
  });
  expect(response.body.data.travelPlan.itinerary[0].morning).toContain('Nishiki Market');
  expect(response.body.data.travelPlan.preparationTips).toContain('Reserve time for local food spots and keep meal times flexible.');
  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(global.fetch.mock.calls[0][0]).toContain('name=Kyoto');
  expect(global.fetch.mock.calls[0][0]).not.toContain('Kyoto%2C');
  expect(global.fetch.mock.calls[2][1].body.toString()).toContain('amenity');
  expect(global.fetch.mock.calls[2][1].body.toString()).toContain('cafe');
  expect(global.fetch.mock.calls[2][1].body.toString()).toContain('museum');
  expect(global.fetch.mock.calls[2][1].body.toString()).toContain('%5B%22disused%22%21%7E%22.%22%5D');
});

test('falls back to named place search when nearby radius search is empty', async () => {
  const jejuTrip = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      destination: 'Jeju City',
      country: 'South Korea',
      region: 'Jeju',
      startDate: '2026-07-20',
      endDate: '2026-07-23',
      preferenceTags: ['food', 'culture', 'nature']
    });

  global.fetch.mockReset()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          name: 'Jeju City',
          country: 'South Korea',
          admin1: 'Jeju',
          latitude: 33.4996,
          longitude: 126.5312,
          timezone: 'Asia/Seoul'
        }]
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          time: '2026-06-01T12:00',
          temperature_2m: 24,
          relative_humidity_2m: 62,
          weather_code: 1,
          wind_speed_10m: 12
        }
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ elements: [] })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          osm_type: 'node',
          osm_id: 9001,
          lat: '33.512',
          lon: '126.526',
          category: 'amenity',
          type: 'cafe',
          name: 'Jeju Coffee Street',
          display_name: 'Jeju Coffee Street, Jeju City, South Korea',
          address: {
            city: 'Jeju City'
          }
        },
        {
          osm_type: 'node',
          osm_id: 9002,
          lat: '33.513',
          lon: '126.527',
          category: 'amenity',
          type: 'restaurant',
          name: 'Closed Jeju Cafe',
          display_name: 'Closed Jeju Cafe, Jeju City, South Korea',
          address: {
            city: 'Jeju City'
          }
        }
      ])
    })
    .mockResolvedValue({
      ok: true,
      json: async () => ([])
    });

  const response = await request(app)
    .get(`/api/v1/planner/trips/${jejuTrip.body.data.id}/summary`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.externalData.attractions.provider).toBe('OpenStreetMap Nominatim');
  expect(response.body.data.externalData.attractions.message).toContain('broader destination-level');
  expect(response.body.data.externalData.attractions.attractions[0].name).toBe('Jeju Coffee Street');
  expect(response.body.data.externalData.attractions.attractions.map((item) => item.name)).not.toContain('Closed Jeju Cafe');
  expect(response.body.data.travelPlan.itinerary).toHaveLength(4);
  expect(response.body.data.travelPlan.itinerary[0].location).toBe('Jeju Coffee Street');
  expect(response.body.data.travelPlan.itinerary[0].bestTime).toBe('Late afternoon or evening.');
  expect(response.body.data.travelPlan.itinerary[0].morning).toContain('Jeju Coffee Street');
  expect(global.fetch.mock.calls[3][0]).toContain('nominatim.openstreetmap.org');
  expect(global.fetch.mock.calls[3][0]).toContain('Jeju');
  expect(global.fetch.mock.calls[3][0]).toContain('bounded=1');
});

test('uses Wikimedia geosearch when Nominatim has no matching places', async () => {
  const trip = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      destination: 'Jeju City',
      country: 'South Korea',
      region: 'Jeju',
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      preferenceTags: ['beach']
    });

  global.fetch.mockReset()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          name: 'Jeju City',
          country: 'South Korea',
          admin1: 'Jeju',
          latitude: 33.4996,
          longitude: 126.5312,
          timezone: 'Asia/Seoul'
        }]
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          time: '2026-06-01T12:00',
          temperature_2m: 24,
          relative_humidity_2m: 62,
          weather_code: 1,
          wind_speed_10m: 12
        }
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ elements: [] })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ([])
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ([])
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        query: {
          geosearch: [
            {
              pageid: 7001,
              title: 'Iho Tewoo Beach',
              lat: 33.497,
              lon: 126.452
            },
            {
              pageid: 7002,
              title: 'Jeju National Museum',
              lat: 33.513,
              lon: 126.548
            }
          ]
        }
      })
    });

  const response = await request(app)
    .get(`/api/v1/planner/trips/${trip.body.data.id}/summary`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.externalData.attractions.message).toContain('broader destination-level');
  expect(response.body.data.travelPlan.itinerary).toHaveLength(2);
  expect(response.body.data.externalData.attractions.provider).toBe('Wikimedia geosearch fallback');
  expect(response.body.data.travelPlan.itinerary[0].location).toBe('Iho Tewoo Beach');
  expect(response.body.data.travelPlan.suggestedPlaces[0].name).toBe('Iho Tewoo Beach');
});

test('uses Nominatim preference search for arbitrary destination places', async () => {
  const trip = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      destination: 'Tokyo',
      country: 'Japan',
      region: 'Tokyo',
      startDate: '2026-08-10',
      endDate: '2026-08-19',
      preferenceTags: ['food', 'museums']
    });

  global.fetch.mockReset()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          name: 'Tokyo',
          country: 'Japan',
          admin1: 'Tokyo',
          latitude: 35.6762,
          longitude: 139.6503,
          timezone: 'Asia/Tokyo'
        }]
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          time: '2026-06-01T12:00',
          temperature_2m: 25,
          relative_humidity_2m: 64,
          weather_code: 1,
          wind_speed_10m: 14
        }
      })
    })
    .mockRejectedValueOnce(new Error('network request failed'))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          osm_type: 'node',
          osm_id: 8101,
          lat: '35.665',
          lon: '139.770',
          category: 'tourism',
          type: 'attraction',
          name: 'Tsukiji Outer Market',
          display_name: 'Tsukiji Outer Market, Tokyo, Japan',
          address: {
            city: 'Tokyo'
          }
        },
        {
          osm_type: 'node',
          osm_id: 8102,
          lat: '35.718',
          lon: '139.776',
          category: 'tourism',
          type: 'museum',
          name: 'Tokyo National Museum',
          display_name: 'Tokyo National Museum, Tokyo, Japan',
          address: {
            city: 'Tokyo'
          }
        }
      ])
    })
    .mockResolvedValue({
      ok: true,
      json: async () => ([])
    });

  const response = await request(app)
    .get(`/api/v1/planner/trips/${trip.body.data.id}/summary`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.externalData.attractions.provider).toBe('OpenStreetMap Nominatim');
  expect(response.body.data.travelPlan.itinerary).toHaveLength(10);
  expect(response.body.data.travelPlan.suggestedPlaces[0].name).toBe('Tsukiji Outer Market');
  expect(response.body.data.travelPlan.suggestedPlaces[1].name).toBe('Tokyo National Museum');
  expect(response.body.data.travelPlan.itinerary[0].location).toBe('Tsukiji Outer Market');
  expect(response.body.data.travelPlan.itinerary[1].location).toBe('Tokyo National Museum');
  expect(global.fetch.mock.calls[3][0]).toContain('restaurants+in+Tokyo');
});

test('matches itinerary stops to selected preference themes', async () => {
  const trip = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      destination: 'Lava',
      country: 'Italy',
      region: 'Sicily',
      startDate: '2026-06-17',
      endDate: '2026-06-19',
      preferenceTags: ['food', 'culture', 'beach']
    });

  global.fetch.mockReset()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          name: 'Lava',
          country: 'Italy',
          admin1: 'Sicily',
          latitude: 37.5,
          longitude: 15.1,
          timezone: 'Europe/Rome'
        }]
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          time: '2026-06-01T12:00',
          temperature_2m: 24,
          relative_humidity_2m: 61,
          weather_code: 1,
          wind_speed_10m: 11
        }
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 9201,
            lat: 37.501,
            lon: 15.101,
            tags: {
              name: 'Stretta di u Paese di Lava',
              amenity: 'restaurant'
            }
          },
          {
            type: 'node',
            id: 9202,
            lat: 37.502,
            lon: 15.102,
            tags: {
              name: 'Lava Heritage Church',
              historic: 'church'
            }
          },
          {
            type: 'node',
            id: 9203,
            lat: 37.503,
            lon: 15.103,
            tags: {
              name: 'Lava Beach',
              natural: 'beach'
            }
          }
        ]
      })
    });

  const response = await request(app)
    .get(`/api/v1/planner/trips/${trip.body.data.id}/summary`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.travelPlan.itinerary).toHaveLength(3);
  expect(response.body.data.travelPlan.itinerary[0]).toMatchObject({
    theme: 'Food and local neighbourhoods',
    location: 'Stretta di u Paese di Lava',
    locationCategory: 'restaurant'
  });
  expect(response.body.data.travelPlan.itinerary[1]).toMatchObject({
    theme: 'Culture and landmarks',
    location: 'Lava Heritage Church',
    locationCategory: 'church'
  });
  expect(response.body.data.travelPlan.itinerary[2]).toMatchObject({
    theme: 'Beach and coastal time',
    location: 'Lava Beach',
    locationCategory: 'beach'
  });
});

test('uses Nominatim geocoding when Open-Meteo cannot resolve the destination', async () => {
  const trip = await request(app)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      destination: 'Asakusa',
      country: 'Japan',
      region: 'Tokyo',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      preferenceTags: ['food']
    });

  global.fetch.mockReset()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          lat: '35.7148',
          lon: '139.7967',
          name: 'Asakusa',
          display_name: 'Asakusa, Taito, Tokyo, Japan',
          namedetails: {
            name: 'Asakusa'
          },
          address: {
            city: 'Tokyo',
            state: 'Tokyo',
            country: 'Japan'
          }
        }
      ])
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          time: '2026-06-01T12:00',
          temperature_2m: 26,
          relative_humidity_2m: 65,
          weather_code: 1,
          wind_speed_10m: 9
        }
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 9101,
            lat: 35.714,
            lon: 139.796,
            tags: {
              name: 'Asakusa Food Hall',
              amenity: 'restaurant'
            }
          }
        ]
      })
    });

  const response = await request(app)
    .get(`/api/v1/planner/trips/${trip.body.data.id}/summary`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.externalData.weather.location.name).toBe('Asakusa');
  expect(response.body.data.externalData.weather.location.region).toBe('Tokyo');
  expect(response.body.data.travelPlan.suggestedPlaces[0].name).toBe('Asakusa Food Hall');
  expect(global.fetch.mock.calls[1][0]).toContain('nominatim.openstreetmap.org');
});

test('handles geocoding failure', async () => {
  global.fetch.mockReset().mockResolvedValueOnce({
    ok: false,
    status: 429,
    json: async () => ({})
  });

  const response = await request(app)
    .get(`/api/v1/planner/trips/${tripId}/summary`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(502);
  expect(response.body.success).toBe(false);
  expect(response.body.error.message).toBe('Unable to geocode destination: external API returned 429');
});

test('handles unavailable live places without exposing network errors', async () => {
  global.fetch.mockReset()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          name: 'Kyoto',
          country: 'Japan',
          admin1: 'Kyoto',
          latitude: 35.0116,
          longitude: 135.7681,
          timezone: 'Asia/Tokyo'
        }]
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          time: '2026-06-01T12:00',
          temperature_2m: 28,
          relative_humidity_2m: 70,
          weather_code: 2,
          wind_speed_10m: 10
        }
      })
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({})
    })
    .mockRejectedValueOnce(new Error('network request failed'));

  const response = await request(app)
    .get(`/api/v1/planner/trips/${tripId}/summary`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.externalData.weather.provider).toBe('Open-Meteo');
  expect(response.body.data.externalData.attractions.available).toBe(false);
  expect(response.body.data.externalData.attractions.provider).toBe('Destination fallback');
  expect(response.body.data.externalData.attractions.message).toContain('saved destination');
  expect(response.body.data.externalData.attractions.message).not.toContain('network request failed');
  expect(response.body.data.travelPlan.suggestedPlaces[0].name).toBe('Kyoto');
  expect(response.body.data.travelPlan.itinerary[0].location).toBe('Kyoto');
  expect(response.body.data.travelPlan.limitation).toContain('saved destination');
});
