process.env.NODE_ENV = 'test';
process.env.DATA_FILE = './data/test-travel-planner.json';
process.env.JWT_SECRET = 'test_secret_for_local_automated_tests';

const request = require('supertest');
const createApp = require('../src/app');
const { resetStore } = require('../src/db/jsonStore');

let app;
let token;

beforeAll(async () => {
  resetStore(process.env.DATA_FILE);
  app = createApp();

  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Test Traveller',
      email: 'traveller@example.com',
      password: 'Password123'
    });

  token = response.body.data.token;
});

afterAll(() => {
  resetStore(process.env.DATA_FILE);
});

describe('Trip API', () => {
  test('rejects unauthenticated trip creation', async () => {
    const response = await request(app)
      .post('/api/v1/trips')
      .send({
        destination: 'Kyoto',
        startDate: '2026-07-10'
      });

    expect(response.status).toBe(401);
  });

  test('creates, lists, updates and deletes a trip', async () => {
    const created = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destination: 'Kyoto',
        country: 'Japan',
        startDate: '2026-07-10',
        endDate: '2026-07-16',
        notes: 'Try local food and visit temples.',
        preferenceTags: ['food', 'culture'],
        budgetAmount: 2500,
        status: 'planned'
      });

    expect(created.status).toBe(201);
    expect(created.body.data.destination).toBe('Kyoto');

    const tripId = created.body.data.id;

    const listed = await request(app)
      .get('/api/v1/trips?status=planned')
      .set('Authorization', `Bearer ${token}`);

    expect(listed.status).toBe(200);
    expect(listed.body.count).toBe(1);

    const updated = await request(app)
      .put(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'visited',
        notes: 'Completed trip and saved notes.'
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe('visited');

    const deleted = await request(app)
      .delete(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleted.status).toBe(204);

    const missing = await request(app)
      .get(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(missing.status).toBe(404);
  });

  test('validates date ranges', async () => {
    const response = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destination: 'Seoul',
        startDate: '2026-08-20',
        endDate: '2026-08-10'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].path).toContain('endDate');
  });
});
