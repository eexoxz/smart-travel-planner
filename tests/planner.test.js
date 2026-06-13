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
    theme: 'Food and local neighbourhoods'
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
  expect(response.body.data.externalData.attractions.attractions[0].name).toBe('Jeju Coffee Street');
  expect(response.body.data.externalData.attractions.attractions.map((item) => item.name)).not.toContain('Closed Jeju Cafe');
  expect(response.body.data.travelPlan.itinerary[0].morning).toContain('Jeju Coffee Street');
  expect(global.fetch.mock.calls[4][0]).toContain('nominatim.openstreetmap.org');
  expect(global.fetch.mock.calls[4][0]).toContain('Jeju');
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

test('handles attraction fallback', async () => {
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
    });

  const response = await request(app)
    .get(`/api/v1/planner/trips/${tripId}/summary`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.externalData.weather.provider).toBe('Open-Meteo');
  expect(response.body.data.externalData.attractions.available).toBe(false);
  expect(response.body.data.travelPlan.limitation).toContain('Nearby places could not be loaded');
});
