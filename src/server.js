const createApp = require('./app');
const env = require('./config/env');
const { ensureStore } = require('./db/jsonStore');

ensureStore();

const app = createApp();

app.listen(env.port, () => {
  console.log(`Smart Travel Planner API running on http://localhost:${env.port}`);
});
