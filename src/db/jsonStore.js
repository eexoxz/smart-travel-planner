const path = require('path');
const fs = require('fs');
const env = require('../config/env');

let dataFilePath = path.resolve(env.dataFile);

const emptyDatabase = {
  meta: {
    usersNextId: 1,
    tripsNextId: 1
  },
  users: [],
  trips: []
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStore(filePath = env.dataFile) {
  dataFilePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });

  if (!fs.existsSync(dataFilePath)) {
    writeDatabase(emptyDatabase);
  }
}

function readDatabase() {
  ensureStore(dataFilePath);
  const raw = fs.readFileSync(dataFilePath, 'utf8');
  return JSON.parse(raw);
}

function writeDatabase(data) {
  fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

function resetStore(filePath = env.dataFile) {
  dataFilePath = path.resolve(filePath);
  writeDatabase(clone(emptyDatabase));
}

function getTimestamp() {
  return new Date().toISOString();
}

module.exports = {
  ensureStore,
  readDatabase,
  writeDatabase,
  resetStore,
  getTimestamp
};
