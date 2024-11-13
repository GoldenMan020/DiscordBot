const Database = require('better-sqlite3');

// Connect to the database
const db = new Database('./fitness_music.db');

// Create Fitness Tables
db.prepare(`
    CREATE TABLE IF NOT EXISTS fitness_users (
        id TEXT PRIMARY KEY,
        goal TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS fitness_logs (
        id TEXT,
        type TEXT,
        duration INTEGER,
        date TEXT
    )
`).run();

// Create Playlist Tables
db.prepare(`
    CREATE TABLE IF NOT EXISTS playlists (
        user_id TEXT,
        playlist_name TEXT,
        songs TEXT,
        PRIMARY KEY (user_id, playlist_name)
    )
`).run();

module.exports = db;
