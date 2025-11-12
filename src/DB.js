// src/DB.js
const Database = require("better-sqlite3");
const db = new Database("queue.db");


db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    command TEXT,
    state TEXT,
    attempts INTEGER,
    max_retries INTEGER,
    created_at TEXT,
    updated_at TEXT,
    error TEXT
  );
`);

module.exports = db;
