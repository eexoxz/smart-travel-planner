process.env.NODE_ENV = 'test';
process.env.DATA_FILE = './data/test-planner.json';
process.env.JWT_SECRET = 'test_secret_for_planner_tests';

const request = require('supertest');
const createApp = require('../src/app');
const { resetStore } = require('../src/db/jsonStore');

let app;
let token;
let tripId;

beforeAll(async () => {
  resetStore(process.env.DATA_FILE);
  app = createApp();

  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          name: 'Kyoto',
          country: 'Japan',
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
      startDate: '2026-07-10',
      preferenceTags: ['culture']
    });

  tripId = trip.body.data.id;
});

afterAll(() => {
  resetStore(process.env.DATA_FILE);
  jest.restoreAllMocks();
});

test('combines a saved trip with external weather data', async () => {
  const response = await request(app)
    .get(`/api/v1/planner/trips/${tripId}/weather`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.trip.destination).toBe('Kyoto');
  expect(response.body.data.externalData.weather.provider).toBe('Open-Meteo');
  expect(response.body.data.externalData.weather.currentWeather.description).toBe('Partly cloudy');
  expect(response.body.data.recommendation.summary).toContain('sightseeing');
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
