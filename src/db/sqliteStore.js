const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const env = require('../config/env');

let database;
let databaseFilePath;

function getTimestamp() {
  return new Date().toISOString();
}

function migrate(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'traveller',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      destination TEXT NOT NULL,
      country TEXT,
      region TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      notes TEXT,
      preference_tags TEXT NOT NULL DEFAULT '[]',
      budget_amount REAL,
      budget_currency TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trips_user_status ON trips(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_trips_user_start_date ON trips(user_id, start_date);
  `);
}

function openDatabase(filePath = env.databaseFile) {
  const nextPath = path.resolve(filePath);

  if (database && databaseFilePath !== nextPath) {
    database.close();
    database = undefined;
  }

  if (!database) {
    fs.mkdirSync(path.dirname(nextPath), { recursive: true });
    database = new DatabaseSync(nextPath);
    databaseFilePath = nextPath;
    migrate(database);
  }

  return database;
}

function ensureStore(filePath = env.databaseFile) {
  openDatabase(filePath);
}

function resetStore(filePath = env.databaseFile) {
  const db = openDatabase(filePath);

  db.exec(`
    DELETE FROM trips;
    DELETE FROM users;
    DELETE FROM sqlite_sequence WHERE name IN ('trips', 'users');
  `);
}

module.exports = {
  ensureStore,
  getDatabase: openDatabase,
  resetStore,
  getTimestamp
};
