process.env.NODE_ENV = 'test';
process.env.DATA_FILE = './data/test-locations.json';
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

test('filters destination suggestions by selected country', async () => {
  const response = await request(app)
    .get('/api/v1/locations/destinations?name=Pen&country=Malaysia');

  expect(response.status).toBe(200);
  expect(response.body.count).toBe(1);
  expect(response.body.data[0].name).toBe('Penang');
  expect(response.body.data[0].country).toBe('Malaysia');
});
