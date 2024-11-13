const Database = require('better-sqlite3');

// Connect to the database
const db = new Database('./fitness.db');

// Create tables if they don't exist
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        goal TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS logs (
        id TEXT,
        type TEXT,
        duration INTEGER,
        date TEXT
    )
`).run();

module.exports = db;
