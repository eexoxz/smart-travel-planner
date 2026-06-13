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
        results: {
          bindings: [
            {
              place: { value: 'http://www.wikidata.org/entity/Q703170' },
              placeLabel: { value: 'Nishiki Market' },
              typeLabel: { value: 'market' },
              location: { value: 'Point(135.772 35.019)' },
              article: { value: 'https://en.wikipedia.org/wiki/Nishiki_Market' }
            },
            {
              place: { value: 'http://www.wikidata.org/entity/Q123456' },
              placeLabel: { value: 'Kyoto Coffee Stand' },
              typeLabel: { value: 'café' },
              location: { value: 'Point(135.765 35.012)' }
            }
          ]
        }
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
      preferenceTags: ['food']
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
  expect(response.body.data.externalData.attractions.provider).toBe('Wikidata Query Service');
  expect(response.body.data.externalData.attractions.available).toBe(true);
  expect(response.body.data.externalData.attractions.searchFocus).toContain('food');
  expect(response.body.data.externalData.attractions.attractions[0].name).toBe('Nishiki Market');
  expect(response.body.data.recommendation.summary).toContain('Nearby attractions');
  expect(response.body.data.travelPlan.title).toBe('Kyoto travel plan');
  expect(response.body.data.travelPlan.suggestedPlaces[0].name).toBe('Nishiki Market');
  expect(response.body.data.travelPlan.preparationTips).toContain('Reserve time for local food spots and keep meal times flexible.');
  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(global.fetch.mock.calls[0][0]).toContain('name=Kyoto');
  expect(global.fetch.mock.calls[0][0]).not.toContain('Kyoto%2C');
  expect(new URL(global.fetch.mock.calls[2][0]).searchParams.get('query')).toContain('wd:Q11707');
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
