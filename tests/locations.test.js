process.env.NODE_ENV = 'test';
process.env.DATABASE_FILE = './data/test-locations.sqlite';
process.env.JWT_SECRET = 'test_secret_for_location_tests';

const request = require('supertest');
const createApp = require('../src/app');

let app;

beforeAll(() => {
  app = createApp();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [
        {
          name: 'Penang',
          country: 'Malaysia',
          admin1: 'Penang',
          latitude: 5.4112,
          longitude: 100.3354,
          timezone: 'Asia/Kuala_Lumpur'
        },
        {
          name: 'Penedo',
          country: 'Brazil',
          admin1: 'Alagoas',
          latitude: -10.29,
          longitude: -36.58,
          timezone: 'America/Maceio'
        }
      ]
    })
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

test('lists country regions', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      error: false,
      data: {
        states: [
          { name: 'Penang', state_code: '07' },
          { name: 'Selangor', state_code: '10' }
        ]
      }
    })
  });

  const response = await request(app)
    .get('/api/v1/locations/states?country=Malaysia');

  expect(response.status).toBe(200);
  expect(response.body.count).toBe(2);
  expect(response.body.data[0].name).toBe('Penang');
});

test('lists region cities', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      error: false,
      data: ['George Town', 'Bayan Lepas']
    })
  });

  const response = await request(app)
    .get('/api/v1/locations/cities?country=Malaysia&state=Penang');

  expect(response.status).toBe(200);
  expect(response.body.count).toBe(2);
  expect(response.body.data[0].name).toBe('George Town');
});
