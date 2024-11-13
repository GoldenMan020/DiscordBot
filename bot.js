require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const db = require('./db');

// Initialize the bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Event: Bot is Ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Command: Set Fitness Goal
client.on('messageCreate', (message) => {
    if (message.content.startsWith('!setgoal')) {
        const goal = message.content.replace('!setgoal ', '').trim();

        if (!goal) {
            message.reply('Please specify a goal! Example: `!setgoal Run 5km every week`');
            return;
        }

        const userId = message.author.id;
        db.prepare(`
            INSERT INTO users (id, goal) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET goal = ?
        `).run(userId, goal, goal);

        message.reply(`Your fitness goal has been set to: "${goal}"`);
    }
});

// Command: Log Activity
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
            INSERT INTO logs (id, type, duration, date) VALUES (?, ?, ?, ?)
        `).run(userId, type, durationInt, date);

        message.reply(`Logged ${durationInt} minutes of ${type}! Keep it up! 💪`);
    }
});

// Command: View Progress
client.on('messageCreate', (message) => {
    if (message.content === '!progress') {
        const userId = message.author.id;

        const rows = db.prepare(`
            SELECT type, SUM(duration) as total FROM logs
            WHERE id = ? GROUP BY type
        `).all(userId);

        if (rows.length === 0) {
            message.reply('No progress logged yet! Use `!logactivity` to get started.');
        } else {
            const progress = rows.map(row => `${row.type}: ${row.total} minutes`).join('\n');
            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`${message.author.username}'s Progress`)
                .setDescription(progress)
                .setFooter({ text: 'Keep pushing towards your goal!' });

            message.reply({ embeds: [embed] });
        }
    }
});

// Command: Motivation
client.on('messageCreate', async (message) => {
    if (message.content === '!motivation') {
        try {
            const response = await axios.get(
                `https://api.giphy.com/v1/gifs/random?tag=fitness&rating=g&api_key=${process.env.GIPHY_API_KEY}`
            );

            const gifUrl = response.data.data.images.original.url;
            const embed = new EmbedBuilder()
                .setColor(0xff5733)
                .setTitle('Here’s your fitness motivation for today! 💪')
                .setImage(gifUrl);

            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error.message);
            message.reply('Could not fetch a motivational image. Try again later.');
        }
    }
});

// Start the bot
client.login(process.env.DISCORD_TOKEN);
