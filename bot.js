require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');
const axios = require('axios');
const db = require('./db');

// Initialize bot and player
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});
const player = new Player(client);

// Event: Bot Ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

//
// FITNESS COMMANDS
//

// Set Fitness Goal
client.on('messageCreate', (message) => {
    if (message.content.startsWith('!setgoal')) {
        const goal = message.content.replace('!setgoal ', '').trim();

        if (!goal) {
            message.reply('Please specify a goal! Example: `!setgoal Run 5km every week`');
            return;
        }

        const userId = message.author.id;
        db.prepare(`
            INSERT INTO fitness_users (id, goal) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET goal = ?
        `).run(userId, goal, goal);

        message.reply(`Your fitness goal has been set to: "${goal}"`);
    }
});

// Log Activity
client.on('messageCreate', (message) => {
    if (message.content.startsWith('!logactivity')) {
        const args = message.content.replace('!logactivity ', '').trim().split(' ');

        if (args.length < 2) {
            message.reply('Usage: `!logactivity <type> <duration_in_minutes>`');
            return;
        }

        const [type, duration] = args;
        const durationInt = parseInt(duration);
        if (isNaN(durationInt)) {
            message.reply('Duration must be a number in minutes!');
            return;
        }

        const userId = message.author.id;
        const date = new Date().toISOString().split('T')[0];

        db.prepare(`
            INSERT INTO fitness_logs (id, type, duration, date) VALUES (?, ?, ?, ?)
        `).run(userId, type, durationInt, date);

        message.reply(`Logged ${durationInt} minutes of ${type}! Keep it up! 💪`);
    }
});

// View Progress
client.on('messageCreate', (message) => {
    if (message.content === '!progress') {
        const userId = message.author.id;

        const rows = db.prepare(`
            SELECT type, SUM(duration) as total FROM fitness_logs
            WHERE id = ? GROUP BY type
        `).all(userId);

        if (rows.length === 0) {
            message.reply('No progress logged yet! Use `!logactivity` to get started.');
        } else {
            const progress = rows.map(row => `${row.type}: ${row.total} minutes`).join('\n');
            message.reply(`Your progress:\n${progress}`);
        }
    }
});

// Motivation
client.on('messageCreate', async (message) => {
    if (message.content === '!motivation') {
        try {
            const response = await axios.get(
                `https://api.giphy.com/v1/gifs/random?tag=fitness&rating=g&api_key=${process.env.GIPHY_API_KEY}`
            );
            const gifUrl = response.data.data.images.original.url;
            message.reply(`Here’s your fitness motivation! 💪\n${gifUrl}`);
        } catch (error) {
            message.reply('Could not fetch a motivational image. Try again later.');
        }
    }
});

//
// MUSIC COMMANDS
//

// Create Playlist
client.on('messageCreate', (message) => {
    if (message.content.startsWith('!createplaylist')) {
        const playlistName = message.content.replace('!createplaylist ', '').trim();

        if (!playlistName) {
            message.reply('Please provide a name for your playlist! Example: `!createplaylist MyPlaylist`');
            return;
        }

        const userId = message.author.id;

        try {
            db.prepare(`
                INSERT INTO playlists (user_id, playlist_name, songs)
                VALUES (?, ?, ?)
            `).run(userId, playlistName, JSON.stringify([]));
            message.reply(`Playlist "${playlistName}" created successfully!`);
        } catch (error) {
            message.reply(`A playlist with the name "${playlistName}" already exists.`);
        }
    }
});

// Add Song
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!addsong')) {
        const [command, playlistName, ...songQuery] = message.content.split(' ');
        const songName = songQuery.join(' ');

        if (!playlistName || !songName) {
            message.reply('Usage: `!addsong <playlist_name> <song_name>`');
            return;
        }

        const userId = message.author.id;
        const playlist = db
            .prepare(`SELECT songs FROM playlists WHERE user_id = ? AND playlist_name = ?`)
            .get(userId, playlistName);

        if (!playlist) {
            message.reply(`Playlist "${playlistName}" not found!`);
            return;
        }

        const songs = JSON.parse(playlist.songs);
        songs.push(songName);

        db.prepare(`
            UPDATE playlists SET songs = ? WHERE user_id = ? AND playlist_name = ?
        `).run(JSON.stringify(songs), userId, playlistName);

        message.reply(`Added "${songName}" to "${playlistName}"!`);
    }
});

// Play Music
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!play')) {
        const songName = message.content.replace('!play ', '').trim();

        if (!songName) {
            message.reply('Please provide a song name to play!');
            return;
        }

        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            message.reply('You need to be in a voice channel to play music!');
            return;
        }

        const searchResult = await player.search(songName, {
            requestedBy: message.author,
        });

        if (!searchResult || !searchResult.tracks.length) {
            message.reply('No results found for your query!');
            return;
        }

        const queue = player.createQueue(message.guild, {
            metadata: {
                channel: message.channel,
            },
        });

        try {
            if (!queue.connection) await queue.connect(voiceChannel);
        } catch {
            player.deleteQueue(message.guild.id);
            message.reply('Could not join your voice channel!');
            return;
        }

        message.reply(`🎶 Now playing: **${searchResult.tracks[0].title}**`);
        queue.addTrack(searchResult.tracks[0]);
        if (!queue.playing) await queue.play();
    }
});

// Stop Music
client.on('messageCreate', (message) => {
    if (message.content === '!stop') {
        const queue = player.getQueue(message.guild);

        if (!queue || !queue.playing) {
            message.reply('No music is currently playing!');
            return;
        }

        queue.destroy();
        message.reply('Stopped the music and cleared the queue.');
    }
});

// Start Bot
client.login(process.env.DISCORD_TOKEN);
