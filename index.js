require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const URL = require('url-parse');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Level system configuration
const LEVEL_UP_CHANNEL = '1417122639717339237';
const BASE_XP_PER_MESSAGE = 125; // Base XP for first message
const VOICE_XP_PER_MINUTE = 200; // XP per minute in voice
const BOT_OWNER_ID = '1327564898460242015'; // Bot owner ID

// XP calculation functions
function getXPForMessage(messageCount) {
    // Increase XP every 10 messages by 25 XP
    const bonusMultiplier = Math.floor(messageCount / 10);
    return BASE_XP_PER_MESSAGE + (bonusMultiplier * 25);
}

function getXPRequiredForLevel(level) {
    // Level 1 requires 0 XP, Level 2 requires 1000 XP, then increases exponentially
    if (level <= 1) return 0;
    return Math.floor(1000 * Math.pow(1.2, level - 2));
}

function getLevelFromXP(totalXP) {
    let level = 1;
    let requiredXP = 0;

    while (totalXP >= requiredXP) {
        level++;
        requiredXP = getXPRequiredForLevel(level);
    }

    return level - 1;
}

// User data storage
let userData = {};
let voiceTracker = {};

// Track violation warning messages (messageId -> warningMessageId)
let violationWarnings = {};

// Moderation logs storage
let moderationLogs = [];

// User warnings storage
let userWarnings = {};

// AFK system (owner only)
let afkData = {
    isAFK: false,
    message: '',
    timestamp: null
};

// Temporary voice channels tracking
let tempVoiceChannels = {};

// Rapid user movement tracking
let rapidMoveIntervals = {};

// Small, optimized GIF collection (reduced dimensions for smaller file sizes)
const cuteGifs = [
    // Original small animal GIFs (80x80 pixels)
    'https://media.giphy.com/media/26BRrSvJUa0crqw4E/80w_d.gif', // tiny cat
    'https://media.giphy.com/media/ICOgUNjpvO0PC/80w_d.gif', // small cat wave
    'https://media.giphy.com/media/vFKqnCdLPNOKc/80w_d.gif', // tiny kitten
    'https://media.giphy.com/media/JIX9t2j0ZTN9S/80w_d.gif', // small dog
    'https://media.giphy.com/media/l1J9FiGxR61OcF2mI/80w_d.gif', // tiny hamster
    'https://media.giphy.com/media/MDJ9IbxxvDUQM/80w_d.gif', // small panda
    'https://media.giphy.com/media/Yr3XGGGhQBan6/80w_d.gif', // tiny bunny
    'https://media.giphy.com/media/yFQ0ywscgobJK/80w_d.gif', // small heart
    'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/80w_d.gif', // tiny duck
    'https://media.giphy.com/media/mlvseq9yvZhba/80w_d.gif', // small puppy
    'https://media.giphy.com/media/bAplZhiLAsNnG/80w_d.gif', // tiny owl
    'https://media.giphy.com/media/11s7Ke7jcNxCHS/80w_d.gif', // small hedgehog
    'https://media.giphy.com/media/mCRJDo24UvJMA/80w_d.gif', // tiny penguin
    'https://media.giphy.com/media/PQKlfexeEpnTq/80w_d.gif', // small seal
    'https://media.giphy.com/media/H4DjXQXamtTiIuCcRU/80w_d.gif', // tiny fox
    'https://media.giphy.com/media/xTiN0CNHgoRf1Ha7CM/80w_d.gif', // small bear
    
    // New anime character GIFs (Vocaloid & others)
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482668123230279/7131_MegurineLuka_Applause1.gif?ex=68caa51b&is=68c9539b&hm=0bd84307e72bc75ae4385b4d928a52d296e3a58d964ccb9f52bfbcac724e93a7&', // Megurine Luka applause
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482669020942436/7174_Meiko_Laugh.gif?ex=68caa51b&is=68c9539b&hm=98266491b03fc6084008d51440497e0be5fd0567139ad3c96f36ff3aeabb3a02&', // Meiko laugh
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482669318606890/9403_Meiko_Angry.gif?ex=68caa51b&is=68c9539b&hm=8fd7d8368cb01995ff5b588304fe9b7cbed7e0a7f7ae35d40550ab060d5c7eae&', // Meiko angry
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482669754941480/5785_HatsuneMiku_Sing.gif?ex=68caa51c&is=68c9539c&hm=d426f7e196edc4767a97716bad6d39e45e0f480465a7e8b42c49b7c7c8038193&', // Hatsune Miku sing
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482670073577612/3349_Meiko_Joy.gif?ex=68caa51c&is=68c9539c&hm=7b5b347ff9244bb6c01bf5f38faf58e24a97c9c15912be7aa9308cd9ed64211a&', // Meiko joy
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482671084277800/8302_KagamineRin_Nice.gif?ex=68caa51c&is=68c9539c&hm=290669aaa69d0e0640e3aa19c7dcf1feb240b36c3d9f23c7403fe1d6b46a3229&', // Kagamine Rin nice
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482671441051688/8022_KagamineRin_Screen.gif?ex=68caa51c&is=68c9539c&hm=c8df2ecfcb98b57ffaff5ca998b29ea8b0407bd2727cb6bcfa0243851d871d82&', // Kagamine Rin screen
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482765552844942/2116_MegurineLuka_Sparkle.gif?ex=68caa532&is=68c953b2&hm=155ad78d429e4bd7d4562f1274ee8c1033c00d3b19c8e2739fb273eba2fd4570&', // Megurine Luka sparkle
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482767859449886/5809_HatsuneMiku_Happy.gif?ex=68caa533&is=68c953b3&hm=045c8f2a9492ec4a2d4e7d1f412471e2eb68a77b17991462aa6e70aa5d22f476&', // Hatsune Miku happy
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482766781780018/7200_MegurineLuka_What.gif?ex=68caa533&is=68c953b3&hm=9b021d0bba0057ee9456b784f5c11cf0b97f92117afdcc324a264dc11db38ca9&', // Megurine Luka what
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482768459366462/4413_MegurineLuka_Applause2.gif?ex=68caa533&is=68c953b3&hm=84a2cbbbd37717f26ff011a3ec280ce423c9fa7c2d12a0e8a2db48b1eac0ff39&', // Megurine Luka applause 2
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482765913559202/1726_Kaito_IceCream.gif?ex=68caa532&is=68c953b2&hm=83dce5c54cce542c091bd3b188bef6446fc3b81b599bf3258214045c92320145&', // Kaito ice cream
    
    // New cute heart and butterfly GIFs
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482595565834393/45008-butterflieswhite.gif?ex=68caa50a&is=68c9538a&hm=3e276b17bc929413a838fa703d79ac7600201e4b3fd2d77faf5da740642f5a4a&', // white butterflies
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482817331531807/4035-lightpinkheartgif.gif?ex=68caa53f&is=68c953bf&hm=6c63e3677a96e3b5ba055f0c446b394b77cc598f30945ac49ae208888b43f822&', // light pink heart
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482819273494528/72281-pinkheartgif.gif?ex=68caa53f&is=68c953bf&hm=0d6957c1886eb7ff0e65de7752b87758adcb06976d1859cd64e0f62823a2b35a&', // pink heart
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482819956903997/30455-hotlovetext.gif?ex=68caa53f&is=68c953bf&hm=0b82b3eaa15cbb621532fdf1c8058f7dbcffdf08b79cb369b1797fb4f0ea22c6&', // hot love text
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482958482178068/30018-purplelovetext.gif?ex=68caa560&is=68c953e0&hm=6e25190517255c6ec5cc6f349a5e02ad0d452e4e0c3844a9630a76a713adeb21&', // purple love text
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482958797017235/17062-butterfliespink.gif?ex=68caa560&is=68c953e0&hm=e3c4eca46b4f9b397f35b3cdd7d076e1d6bde23ea07b41d1a39df0f06781b01a&', // pink butterflies
    
    // New Genshin Impact character GIFs
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417485276003176498/3787-confused.gif?ex=68caa789&is=68c95609&hm=838fe1e5bf1023f46bcf4955db96983f12eeb7fb64cc9136e754f8b5683da7ee&', // confused character
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417485276816609340/2642-raiden-shotgun.gif?ex=68caa789&is=68c95609&hm=dc5f1ca7f7faf0f6139b994afa161bb4d3e95924eaf4fe4ea7299d967dd01a23&', // Raiden shotgun
    
    // Static PNG emotes (will display as images)
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417482765145735400/5438_KagamineLen_Sorry.png?ex=68caa532&is=68c953b2&hm=f89537d98e00c16b6ac764ef6f5c37af403e91e8e24671f1ea8b28c85e6c85b2&', // Kagamine Len sorry
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417485275411517503/6970-paimonevil.png?ex=68caa789&is=68c95609&hm=7a6d3bea56a1b6ee5f771402342edbb0b81443012a2f006b1e811f141fae1732&', // Paimon evil
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417485278561439846/3646-eulano.png?ex=68caa78a&is=68c9560a&hm=5380d9a133994455ae9b7b6dd05d892431ae212151f2d3b239cf3ad80272215f&', // Eula no
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417485280725831782/9266-klee-fu.png?ex=68caa78a&is=68c9560a&hm=b18cfbb1a99bb024ebdebe7dd616a3783a2a6ab4785165b3c0c62cd284083d0c&', // Klee fu
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417485277705797732/3342-luminewoke.png?ex=68caa789&is=68c95609&hm=adfd982e5cbfead73f5f534e19f96738f5596f39e414a0ac4a3e74ed67087650&', // Lumine woke
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417485279337648168/7807-diluccool.png?ex=68caa78a&is=68c9560a&hm=e2572a350850fec1c57b190413f25f7e04c0efe175fe86ee9af3452218ac9aef&', // Diluc cool
    'https://cdn.discordapp.com/attachments/1377710452653424711/1417485281346457600/6986-aether-pray.png?ex=68caa78a&is=68c9560a&hm=391be87654a6f0862c3ab957488ee3a48e10f2ad2d41cb4d972ed4dcb961915a&', // Aether pray
];

// Function to get a random cute GIF
function getRandomCuteGif() {
    return cuteGifs[Math.floor(Math.random() * cuteGifs.length)];
}

// Function to format time duration
function formatTime(seconds) {
    if (seconds < 60) {
        return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
    }
}

// Load user data from file
const DATA_FILE = 'userdata.json';
if (fs.existsSync(DATA_FILE)) {
    try {
        userData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (error) {
        console.log('Creating new user data file...');
        userData = {};
    }
}

// Save user data to file
function saveUserData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(userData, null, 2));
}

// Save moderation logs
function saveModerationLogs() {
    try {
        fs.writeFileSync('modlogs.json', JSON.stringify(moderationLogs, null, 2));
    } catch (error) {
        console.error('Error saving moderation logs:', error);
    }
}

// Save user warnings
function saveUserWarnings() {
    try {
        fs.writeFileSync('warnings.json', JSON.stringify(userWarnings, null, 2));
    } catch (error) {
        console.error('Error saving user warnings:', error);
    }
}

// Load moderation data on startup
if (fs.existsSync('modlogs.json')) {
    try {
        moderationLogs = JSON.parse(fs.readFileSync('modlogs.json', 'utf8'));
    } catch (error) {
        console.log('Creating new moderation logs file...');
        moderationLogs = [];
    }
}

if (fs.existsSync('warnings.json')) {
    try {
        userWarnings = JSON.parse(fs.readFileSync('warnings.json', 'utf8'));
    } catch (error) {
        console.log('Creating new warnings file...');
        userWarnings = {};
    }
}

// Add moderation log entry
function addModerationLog(action, moderator, target, reason = 'No reason provided', additional = {}) {
    const logEntry = {
        id: Date.now().toString(),
        action,
        moderator: {
            id: moderator.id,
            tag: moderator.tag,
            displayName: moderator.displayName || moderator.username
        },
        target: {
            id: target.id,
            tag: target.tag,
            displayName: target.displayName || target.username
        },
        reason,
        timestamp: new Date().toISOString(),
        ...additional
    };

    moderationLogs.unshift(logEntry); // Add to beginning
    
    // Keep only last 100 logs to prevent file from growing too large
    if (moderationLogs.length > 100) {
        moderationLogs = moderationLogs.slice(0, 100);
    }
    
    saveModerationLogs();
    return logEntry;
}

// Parse duration string to milliseconds
function parseDuration(duration) {
    const match = duration.match(/^(\d+)([smhdw])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000,
        w: 604800000
    };

    return value * multipliers[unit];
}

// Initialize user data
function initUser(userId) {
    if (!userData[userId]) {
        userData[userId] = {
            level: 1,
            totalXP: 0,
            messageCount: 0,
            voiceMinutes: 0,
            totalMessages: 0,
            totalVoiceMinutes: 0,
            lastMessageTime: 0,
            lastXPGain: 0
        };
    }
    return userData[userId];
}

// Check if user should level up and handle level up
async function checkLevelUp(userId, guild, xpGained = 0) {
    const user = userData[userId];
    const oldLevel = user.level;
    const newLevel = getLevelFromXP(user.totalXP);

    console.log(`🔍 Level Check for ${guild.members.cache.get(userId)?.displayName || 'User'}: Old Level: ${oldLevel}, New Level: ${newLevel}, Total XP: ${user.totalXP}`);

    if (newLevel > oldLevel) {
        user.level = newLevel;
        saveUserData();

        console.log(`🎉 LEVEL UP! ${guild.members.cache.get(userId)?.displayName || 'User'} leveled up from ${oldLevel} to ${newLevel}!`);

        // Send level up notification
        const levelUpChannel = guild.channels.cache.get(LEVEL_UP_CHANNEL);
        if (levelUpChannel) {
            const member = guild.members.cache.get(userId);
            const nextLevelXP = getXPRequiredForLevel(newLevel + 1);
            const currentLevelXP = getXPRequiredForLevel(newLevel);
            const progressXP = user.totalXP - currentLevelXP;
            const neededXP = nextLevelXP - currentLevelXP;

            const levelUpEmbed = new EmbedBuilder()
                .setDescription(`🎉 **${member?.displayName || 'Someone'}** • ${oldLevel} ➜ **Lv.${newLevel}** • +${xpGained} XP\n📊 ${user.totalXP.toLocaleString()} XP • ${user.totalMessages}m • ${user.totalVoiceMinutes}v • ${Math.floor((progressXP/neededXP)*100)}% next`)
                .setColor(0xFFD700); // Gold color for level ups

            try {
                const levelUpMsg = await levelUpChannel.send({ 
                    content: `🎉 <@${userId}> leveled up!`,
                    embeds: [levelUpEmbed]
                });
                console.log(`✅ Level up notification sent successfully to channel ${LEVEL_UP_CHANNEL}`);
            } catch (error) {
                console.error(`❌ Failed to send level up message to channel ${LEVEL_UP_CHANNEL}:`, error);

                // Try to send in the current channel as backup
                try {
                    const currentChannel = guild.channels.cache.find(channel => 
                        channel.type === 0 && channel.permissionsFor(guild.members.me)?.has('SendMessages')
                    );
                    if (currentChannel) {
                        await currentChannel.send({ 
                            content: `🎉 <@${userId}> leveled up to **Level ${newLevel}**! (Backup notification - check level up channel permissions)`,
                            embeds: [levelUpEmbed] 
                        });
                        console.log(`✅ Backup level up notification sent to ${currentChannel.name}`);
                    }
                } catch (backupError) {
                    console.error('❌ Failed to send backup level up notification:', backupError);
                }
            }
        } else {
            console.error(`❌ Level up channel ${LEVEL_UP_CHANNEL} not found or inaccessible!`);
        }

        return true;
    }
    return false;
}

// Add XP for messages (with cooldown to prevent spam)
async function addMessageXP(userId, guild) {
    const user = initUser(userId);
    const now = Date.now();

    // 3 second cooldown between XP gains
    if (now - user.lastMessageTime < 3000) {
        return false;
    }

    user.lastMessageTime = now;
    user.messageCount++;
    user.totalMessages++;

    // Calculate XP based on message count (increases every 10 messages)
    const xpToGain = getXPForMessage(user.messageCount);
    user.totalXP += xpToGain;
    user.lastXPGain = xpToGain;

    console.log(`💰 ${guild.members.cache.get(userId)?.displayName || 'User'} gained ${xpToGain} XP (Total: ${user.totalXP} XP, Messages: ${user.messageCount})`);

    // Check for level up after gaining XP
    const leveledUp = await checkLevelUp(userId, guild, xpToGain);
    saveUserData();

    return leveledUp;
}

// Voice state tracking
client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id;
    const guild = newState.guild;

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
        voiceTracker[userId] = Date.now();
    }

    // User left a voice channel
    if (oldState.channelId && !newState.channelId) {
        if (voiceTracker[userId]) {
            const timeSpent = Math.floor((Date.now() - voiceTracker[userId]) / 60000); // minutes
            delete voiceTracker[userId];

            if (timeSpent >= 1) { // At least 1 minute
                const user = initUser(userId);
                user.voiceMinutes += timeSpent;
                user.totalVoiceMinutes += timeSpent;

                // Add XP for voice time (200 XP per minute)
                const voiceXP = timeSpent * VOICE_XP_PER_MINUTE;
                user.totalXP += voiceXP;
                user.lastXPGain = voiceXP;

                console.log(`🎤 ${guild.members.cache.get(userId)?.displayName || 'User'} gained ${voiceXP} XP from ${timeSpent} minutes in voice (Total: ${user.totalXP} XP)`);

                await checkLevelUp(userId, guild, voiceXP);
                saveUserData();
            }
        }

        // Check if user left a temporary voice channel and it's now empty
        const leftChannel = oldState.channel;
        if (leftChannel && tempVoiceChannels[leftChannel.id]) {
            // Wait a moment for Discord to update member counts
            setTimeout(async () => {
                try {
                    // Refresh channel data
                    const channelToCheck = await guild.channels.fetch(leftChannel.id);
                    
                    if (channelToCheck && channelToCheck.members.size === 0) {
                        // Channel is empty, delete it
                        console.log(`🗑️ Temp VC "${channelToCheck.name}" is now empty, auto-deleting...`);
                        
                        // Clear the duration timeout since we're deleting early
                        if (tempVoiceChannels[leftChannel.id].timeout) {
                            clearTimeout(tempVoiceChannels[leftChannel.id].timeout);
                        }
                        
                        await channelToCheck.delete('Temporary VC empty - auto cleanup');
                        delete tempVoiceChannels[leftChannel.id];
                        
                        console.log(`✅ Auto-deleted empty temp VC: ${channelToCheck.name}`);
                    }
                } catch (error) {
                    console.error('Error checking/deleting empty temp VC:', error);
                }
            }, 2000); // 2 second delay to ensure Discord has updated
        }
    }

    // User switched channels (update tracker)
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        if (voiceTracker[userId]) {
            const timeSpent = Math.floor((Date.now() - voiceTracker[userId]) / 60000);

            if (timeSpent >= 1) {
                const user = initUser(userId);
                user.voiceMinutes += timeSpent;
                user.totalVoiceMinutes += timeSpent;

                // Add XP for voice time (200 XP per minute)
                const voiceXP = timeSpent * VOICE_XP_PER_MINUTE;
                user.totalXP += voiceXP;
                user.lastXPGain = voiceXP;

                await checkLevelUp(userId, guild, voiceXP);
                saveUserData();
            }
        }
        voiceTracker[userId] = Date.now(); // Reset tracker for new channel

        // Check if user left a temporary voice channel and it's now empty
        const leftChannel = oldState.channel;
        if (leftChannel && tempVoiceChannels[leftChannel.id]) {
            // Wait a moment for Discord to update member counts
            setTimeout(async () => {
                try {
                    // Refresh channel data
                    const channelToCheck = await guild.channels.fetch(leftChannel.id);
                    
                    if (channelToCheck && channelToCheck.members.size === 0) {
                        // Channel is empty, delete it
                        console.log(`🗑️ Temp VC "${channelToCheck.name}" is now empty, auto-deleting...`);
                        
                        // Clear the duration timeout since we're deleting early
                        if (tempVoiceChannels[leftChannel.id].timeout) {
                            clearTimeout(tempVoiceChannels[leftChannel.id].timeout);
                        }
                        
                        await channelToCheck.delete('Temporary VC empty - auto cleanup');
                        delete tempVoiceChannels[leftChannel.id];
                        
                        console.log(`✅ Auto-deleted empty temp VC: ${channelToCheck.name}`);
                    }
                } catch (error) {
                    console.error('Error checking/deleting empty temp VC:', error);
                }
            }, 2000); // 2 second delay to ensure Discord has updated
        }
    }
});

// Blacklisted content patterns for comprehensive content moderation
const blacklistedPatterns = {
    // Game-related match requests and custom games
    gameMatchRequests: [
        /looking\s+for\s+(a\s+)?(match|game|partner|teammate|duo|squad|team)/i,
        /anyone\s+(want\s+to\s+|wanna\s+)?(play|match|game)/i,
        /need\s+(a\s+)?(teammate|partner|duo|squad|team)/i,
        /lfg|lf[0-9]+|looking\s+for\s+group/i,
        /dm\s+(me\s+)?(to\s+|for\s+)?(play|match|game)/i,
        /add\s+(me\s+)?(to\s+|for\s+)?(play|match|game)/i,
        /who\s+(wants\s+to\s+|wanna\s+)?(play|match|game)/i,
        /1v1\s+(me|anyone)|anyone\s+1v1/i,
        /2v2|3v3|4v4|5v5|6v6/i,
        /ranked\s+(match|game|queue)/i,
        /casual\s+(match|game|queue)/i,
        /comp\s+(match|game|queue)/i,
        /competitive\s+(match|game|queue)/i,
        /custom\s+(match|game|lobby|room)/i,
        /scrim(s|mage)?/i,
        /tournament/i,
        /private\s+(match|game|lobby)/i,
        /join\s+(my\s+)?(lobby|room|match|game)/i,
        /game\s+(mode|lobby|room)/i,
        /clan\s+(war|battle|match)/i,
        /guild\s+(war|battle|match)/i
    ],
    
    // Discord server promotions
    discordPromotion: [
        /join\s+(my\s+|our\s+)?server/i,
        /check\s+(out\s+)?(my\s+|our\s+)?server/i,
        /discord\.gg\/[a-zA-Z0-9]+/i,
        /discord\.com\/invite\/[a-zA-Z0-9]+/i,
        /new\s+server/i,
        /server\s+(invite|link)/i,
        /promoting\s+(my\s+|our\s+)?server/i,
        /advertis(e|ing)\s+(my\s+|our\s+)?server/i,
        /come\s+join\s+(us|our\s+server)/i,
        /server\s+(promotion|promo)/i,
        /friendly\s+server/i,
        /active\s+server/i,
        /gaming\s+server/i,
        /community\s+server/i
    ],
    
    // Social media and content promotion
    socialMediaPromotion: [
        /check\s+(out\s+)?(my\s+)?(channel|stream|video|content|page|account)/i,
        /subscribe\s+(to\s+)?(my\s+)?(channel|page)/i,
        /follow\s+(me\s+)?(on\s+)?(twitch|youtube|instagram|tiktok|twitter|x\.com)/i,
        /watch\s+(my\s+)?(stream|video|content)/i,
        /new\s+(video|stream|content|post)\s+(is\s+)?(up|live|out)/i,
        /promoting\s+(my\s+)?(channel|stream|content|account)/i,
        /self[\s\-_]*promo/i,
        /shameless\s+plug/i,
        /check\s+my\s+(bio|profile|link)/i,
        /link\s+in\s+(bio|description|profile)/i,
        /go\s+(check\s+)?(my\s+)?(profile|bio|page)/i,
        /(youtube|twitch|instagram|tiktok|twitter)\.com\/[a-zA-Z0-9_\-\.]+/i,
        /youtu\.be\/[a-zA-Z0-9_\-]+/i,
        /instagram\.com\/[a-zA-Z0-9_\-\.]+/i,
        /tiktok\.com\/@[a-zA-Z0-9_\-\.]+/i,
        /twitter\.com\/[a-zA-Z0-9_\-\.]+/i,
        /x\.com\/[a-zA-Z0-9_\-\.]+/i,
        /twitch\.tv\/[a-zA-Z0-9_\-\.]+/i,
        /like\s+(and\s+)?subscribe/i,
        /smash\s+that\s+(like|subscribe)/i,
        /hit\s+the\s+(bell|like|subscribe)/i,
        // Enhanced promotional link detection
        /promot(e|ing|ion)/i,
        /advertis(e|ing|ement)/i,
        /check\s+(this\s+)?(out|link)/i,
        /click\s+(here|this|link)/i,
        /visit\s+(my\s+)?(site|website|page)/i,
        /my\s+(website|site|blog|store)/i,
        /free\s+(stuff|content|download)/i,
        /special\s+(offer|deal|discount)/i,
        /limited\s+(time|offer)/i,
        /exclusive\s+(content|access)/i,
        /(support|sponsor)\s+me/i,
        /donate\s+(to\s+)?me/i,
        /buy\s+(my\s+)?(product|service|content)/i,
        /selling\s+(my\s+)?(stuff|products)/i,
        /business\s+(opportunity|offer)/i,
        /make\s+money\s+(fast|quick|easy)/i,
        /earn\s+(cash|money|income)/i,
        /work\s+from\s+home/i,
        /get\s+paid\s+(to|for)/i,
        /affiliate\s+(link|program)/i,
        /referral\s+(link|code|program)/i,
        /promo\s+(code|link)/i,
        /discount\s+(code|link)/i,
        /coupon\s+(code|link)/i,
        /partnership\s+(opportunity|offer)/i,
        /collab(oration)?\s+(opportunity|offer)/i,
        /influencer\s+(opportunity|program)/i,
        /brand\s+(deal|partnership)/i,
        /sponsored\s+(content|post)/i
    ],
    
    // General promotional content
    generalPromotion: [
        /advertis(e|ing|ement)/i,
        /sponsor(ed|ship)/i,
        /partnership/i,
        /collab(oration)?/i,
        /brand\s+deal/i,
        /paid\s+promotion/i,
        /affiliate\s+link/i,
        /referral\s+(link|code)/i,
        /promo\s+code/i,
        /discount\s+code/i,
        /business\s+(opportunity|proposal)/i,
        /make\s+money/i,
        /earn\s+(money|cash|income)/i,
        /work\s+from\s+home/i,
        /click\s+(here|link)\s+(to|for)/i
    ],
    
    // Game-related spam and scams
    gameRelatedSpam: [
        /selling\s+(accounts|items|skins|coins|currency)/i,
        /buying\s+(accounts|items|skins|coins|currency)/i,
        /free\s+(robux|vbucks|coins|gems|currency|skins)/i,
        /hack(s|ed|ing)?\s+(for\s+)?(free\s+)?(robux|vbucks|coins|gems)/i,
        /generator\s+(for\s+)?(robux|vbucks|coins|gems|currency)/i,
        /cheat(s|ed|ing)?\s+(for\s+)?(robux|vbucks|coins|gems)/i,
        /exploit(s|ed|ing)?\s+(for\s+)?(robux|vbucks|coins|gems)/i,
        /trading\s+(accounts|items|skins|currency)/i,
        /account\s+(selling|buying|trading)/i,
        /cheap\s+(robux|vbucks|coins|gems|accounts)/i,
        /giveaway\s+(robux|vbucks|coins|gems|accounts)/i,
        /win\s+(free\s+)?(robux|vbucks|coins|gems)/i,
        /boosting\s+(service|account|rank)/i,
        /elo\s+boost/i,
        /rank\s+boost/i,
        /carry\s+service/i
    ],
    
    // Unauthorized links and suspicious content
    unauthorizedLinks: [
        /https?:\/\/[^\s]+\.(tk|ml|ga|cf|000webhostapp\.com)/i,
        /bit\.ly\/[a-zA-Z0-9]+/i,
        /tinyurl\.com\/[a-zA-Z0-9]+/i,
        /t\.co\/[a-zA-Z0-9]+/i,
        /short\.link\/[a-zA-Z0-9]+/i,
        /cutt\.ly\/[a-zA-Z0-9]+/i,
        /rb\.gy\/[a-zA-Z0-9]+/i,
        /ow\.ly\/[a-zA-Z0-9]+/i,
        /is\.gd\/[a-zA-Z0-9]+/i,
        /buff\.ly\/[a-zA-Z0-9]+/i,
        /click\s+(here|this)\s+https?:\/\//i,
        /visit\s+(this\s+)?https?:\/\//i,
        /go\s+to\s+https?:\/\//i,
        /check\s+(out\s+)?https?:\/\//i,
        /https?:\/\/[^\s]+\.(exe|scr|bat|com|pif|vbs|jar|app|dmg)/i,
        /discord\.com\/api\/webhooks/i,
        /discordapp\.com\/api\/webhooks/i,
        /grabify\.link/i,
        /iplogger\.(org|com|ru|co)/i,
        /yip\.su/i,
        /blasze\.com/i,
        /2no\.co/i,
        /ipgrab(b)?er\.ru/i,
        /suspicious\-site\./i,
        /malware\-test\./i,
        /phishing\-test\./i
    ]
};

// Function to check if message contains blacklisted content
function checkBlacklistedContent(messageContent, authorId, guild) {
    const content = messageContent.toLowerCase();
    
    // Check if user is bot owner or server owner (they can promote anything)
    const isOwner = authorId === BOT_OWNER_ID;
    const isServerOwner = guild && guild.ownerId === authorId;
    
    if (isOwner || isServerOwner) {
        return {
            isBlacklisted: false,
            category: null,
            reason: null
        };
    }
    
    // Check game match requests
    for (const pattern of blacklistedPatterns.gameMatchRequests) {
        if (pattern.test(content)) {
            return {
                isBlacklisted: true,
                category: 'Game Match Request',
                reason: 'Message contains game/match request content - only allowed for owner'
            };
        }
    }
    
    // Check Discord server promotion
    for (const pattern of blacklistedPatterns.discordPromotion) {
        if (pattern.test(content)) {
            return {
                isBlacklisted: true,
                category: 'Discord Server Promotion',
                reason: 'Message contains Discord server promotion - only owner can promote servers'
            };
        }
    }
    
    // Check social media promotion
    for (const pattern of blacklistedPatterns.socialMediaPromotion) {
        if (pattern.test(content)) {
            return {
                isBlacklisted: true,
                category: 'Social Media Promotion',
                reason: 'Message contains social media/content promotion - only owner can promote'
            };
        }
    }
    
    // Check general promotion
    for (const pattern of blacklistedPatterns.generalPromotion) {
        if (pattern.test(content)) {
            return {
                isBlacklisted: true,
                category: 'General Promotion',
                reason: 'Message contains promotional content - only owner can advertise'
            };
        }
    }
    
    // Check game-related spam/scams
    for (const pattern of blacklistedPatterns.gameRelatedSpam) {
        if (pattern.test(content)) {
            return {
                isBlacklisted: true,
                category: 'Game Related Spam',
                reason: 'Message contains game-related spam or scam content'
            };
        }
    }
    
    // Check unauthorized/suspicious links
    for (const pattern of blacklistedPatterns.unauthorizedLinks) {
        if (pattern.test(content)) {
            return {
                isBlacklisted: true,
                category: 'Unauthorized Link',
                reason: 'Message contains unauthorized or suspicious link - only owner can post such links'
            };
        }
    }
    
    return {
        isBlacklisted: false,
        category: null,
        reason: null
    };
}

// Function to create deletion notification embed
function createDeletionEmbed(message, blacklistResult) {
    const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted - Blacklisted Content')
        .setColor(0xFF4444)
        .setDescription(`A message was automatically deleted for violating content guidelines.`)
        .addFields(
            { name: '👤 User', value: `${message.author} (${message.author.tag})`, inline: true },
            { name: '📂 Category', value: blacklistResult.category, inline: true },
            { name: '📍 Channel', value: `${message.channel}`, inline: true },
            { name: '🚫 Reason', value: blacklistResult.reason, inline: false },
            { name: '💬 Content Preview', value: message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: '🤖 Automatic content moderation' });
    
    return embed;
}

// Legitimate Discord domains (always safe)
const legitimateDiscordDomains = [
    'discord.gg',
    'discord.com',
    'discordapp.com',
    'discordapp.net',
    'discord.new',
    'dis.gd'
];

// Malicious domains and patterns to check
const maliciousDomains = [
    // Discord phishing/scam domains (fake Discord sites)
    'discord-nitro.com',
    'discordgift.site',
    'discord-give.com',
    'discordnitro.info',
    'discord-airdrop.org',
    'discordgiveaway.com',
    'discordapp.io',
    'dlscord.gg',
    'discrod.gg',
    'discord-gifts.com',
    'free-discord-nitro.com',

    // Steam phishing domains
    'steam-nitro.com',
    'discordsteam.com',
    'steamcommunity.ru',
    'steamcommunlty.com',
    'steampowered.ru',
    'steamcommunitiy.com',
    'steam-wallet.com',

    // Known token grabber hosts
    'grabify.link',
    'iplogger.org',
    'iplogger.com',
    'iplogger.ru',
    'yip.su',
    'iplogger.co',
    'blasze.com',
    '2no.co',
    'ipgrabber.ru',
    'ipgraber.ru',

    // Other malicious domains
    'bit.do',
    'suspicious-site.tk',
    'malware-test.com',
    'phishing-test.com'
];

const suspiciousPatterns = [
    // Token grabber patterns
    /token[\s\-_]*grab/i,
    /grab[\s\-_]*token/i,
    /discord[\s\-_]*token/i,
    /steal[\s\-_]*token/i,
    /token[\s\-_]*steal/i,
    /account[\s\-_]*steal/i,
    /credential[\s\-_]*steal/i,

    // Common scam patterns
    /free\s*nitro/i,
    /free\s*discord/i,
    /steam\s*gift/i,
    /discord\s*gift/i,
    /nitro\s*generator/i,
    /discord\s*generator/i,
    /account\s*generator/i,

    // Phishing patterns
    /phishing/i,
    /scam/i,
    /fake[\s\-_]*login/i,
    /login[\s\-_]*steal/i,
    /password[\s\-_]*steal/i,

    // Malware patterns
    /malware/i,
    /trojan/i,
    /keylog/i,
    /backdoor/i,
    /rat[\s\-_]*tool/i,
    /remote[\s\-_]*access/i,

    // Suspicious file extensions in URLs
    /\.exe(\?|$|#)/i,
    /\.scr(\?|$|#)/i,
    /\.bat(\?|$|#)/i,
    /\.com(\?|$|#)/i,
    /\.pif(\?|$|#)/i,
    /\.vbs(\?|$|#)/i,

    // Webhook patterns
    /discord(?:app)?\.com\/api\/webhooks/i,
    /webhook/i
];

// URL pattern to detect links
const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;

// Function to check if URL is safe
async function checkUrlSafety(url) {
    try {
        const parsedUrl = new URL(url);
        const domain = parsedUrl.hostname.toLowerCase();
        const fullUrl = url.toLowerCase();
        const urlPath = parsedUrl.pathname.toLowerCase();

        // Priority Check 0: Whitelist legitimate Discord domains first
        const isLegitimateDiscord = legitimateDiscordDomains.some(legitDomain => {
            return domain === legitDomain || domain.endsWith('.' + legitDomain);
        });

        if (isLegitimateDiscord) {
            // Check if it's a webhook URL (still dangerous even on legitimate domains)
            if (fullUrl.includes('/api/webhooks')) {
                return {
                    safe: false,
                    reason: '🚨 Discord webhook detected - HIGH RISK token grabber!',
                    category: 'Token Grabber'
                };
            }
            
            // All other legitimate Discord URLs are safe
            return {
                safe: true,
                reason: '✅ Legitimate Discord domain - safe to use',
                category: 'Official Discord'
            };
        }

        // Priority Check 1: Discord webhook URLs on any domain (immediate threat)
        if (fullUrl.includes('discord.com/api/webhooks') || fullUrl.includes('discordapp.com/api/webhooks')) {
            return {
                safe: false,
                reason: '🚨 Discord webhook detected - HIGH RISK token grabber!',
                category: 'Token Grabber'
            };
        }

        // Priority Check 2: Known malicious domains
        for (const maliciousDomain of maliciousDomains) {
            if (domain.includes(maliciousDomain) || domain === maliciousDomain) {
                return {
                    safe: false,
                    reason: `🚨 Known malicious domain: ${maliciousDomain}`,
                    category: domain.includes('grab') || domain.includes('logger') ? 'Token Grabber' : 'Malicious Domain'
                };
            }
        }

        // Priority Check 3: Token grabber and malware patterns
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(fullUrl) || pattern.test(urlPath)) {
                const patternStr = pattern.toString();
                let category = 'Suspicious Content';

                if (patternStr.includes('token') || patternStr.includes('grab') || patternStr.includes('steal')) {
                    category = 'Token Grabber';
                } else if (patternStr.includes('malware') || patternStr.includes('trojan') || patternStr.includes('keylog')) {
                    category = 'Malware';
                } else if (patternStr.includes('phish') || patternStr.includes('scam')) {
                    category = 'Phishing/Scam';
                }

                return {
                    safe: false,
                    reason: `🚨 Dangerous pattern detected: ${category.toLowerCase()} indicators`,
                    category: category
                };
            }
        }

        // Check 4: Suspicious file extensions
        const dangerousExts = ['.exe', '.scr', '.bat', '.com', '.pif', '.vbs', '.jar', '.app', '.dmg'];
        if (dangerousExts.some(ext => urlPath.includes(ext))) {
            return {
                safe: false,
                reason: '⚠️ Potentially dangerous file extension detected',
                category: 'Malware Risk'
            };
        }

        // Check 5: URL shorteners (high risk for hiding malicious content)
        const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'short.link', 'cutt.ly', 'rb.gy', 'ow.ly', 'is.gd', 'buff.ly'];
        if (shorteners.some(shortener => domain.includes(shortener))) {
            return {
                safe: false,
                reason: '⚠️ URL shortener detected - cannot verify destination safety',
                category: 'URL Shortener Risk'
            };
        }

        // Check 6: Suspicious TLD patterns
        const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.000webhostapp.com'];
        if (suspiciousTlds.some(tld => domain.endsWith(tld))) {
            return {
                safe: false,
                reason: '⚠️ Suspicious domain extension - often used for malicious sites',
                category: 'Suspicious Domain'
            };
        }

        // Check 7: Try to analyze the actual website
        try {
            const response = await axios.head(url, { 
                timeout: 8000,
                maxRedirects: 3,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                validateStatus: function (status) {
                    return status < 500;
                }
            });

            // Check response headers for suspicious content
            const contentType = response.headers['content-type'] || '';
            const serverHeader = response.headers['server'] || '';

            // Suspicious content type checks
            if (contentType.includes('application/octet-stream') && !domain.includes('github.com')) {
                return {
                    safe: false,
                    reason: '⚠️ Suspicious file download detected',
                    category: 'Malware Risk'
                };
            }

            if (contentType.includes('application/javascript') && 
                !domain.includes('github.com') && 
                !domain.includes('jsdelivr.net') && 
                !domain.includes('cdnjs.com') &&
                !domain.includes('unpkg.com')) {
                return {
                    safe: false,
                    reason: '⚠️ Suspicious JavaScript content from untrusted source',
                    category: 'Suspicious Content'
                };
            }

        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
                return {
                    safe: false,
                    reason: '❌ Website unreachable or blocked - potentially malicious',
                    category: 'Inaccessible/Blocked'
                };
            }

            if (error.code === 'ETIMEDOUT') {
                return {
                    safe: false,
                    reason: '⚠️ Website timeout - potentially suspicious behavior',
                    category: 'Suspicious Behavior'
                };
            }
        }

        // If all security checks pass, mark as safe
        return {
            safe: true,
            reason: '✅ No malicious indicators found - appears safe',
            category: 'Verified Safe'
        };

    } catch (error) {
        return {
            safe: false,
            reason: '❌ Invalid or malformed URL',
            category: 'Invalid URL'
        };
    }
}

// Function to create safety embed
function createSafetyEmbed(url, safetyResult) {
    const embed = new EmbedBuilder()
        .setTimestamp();

    // Only set URL if it's a valid, well-formed URL
    try {
        const testUrl = new URL(url);
        if (testUrl.protocol === 'http:' || testUrl.protocol === 'https:') {
            embed.setURL(url);
        }
    } catch (error) {
        // Don't set URL if it's malformed
        console.log(`Skipping malformed URL in embed: ${url}`);
    }

    if (safetyResult.safe) {
        embed
            .setTitle('✅ Link Safety Check - SAFE')
            .setColor(0x00FF00)
            .setDescription(`**Link:** \`${url}\`\n**Status:** This link appears to be safe to click.`)
            .addFields(
                { name: 'Security Status', value: safetyResult.category, inline: true },
                { name: 'Verification Result', value: safetyResult.reason, inline: true }
            );
    } else {
        let dangerLevel = '⚠️ CAUTION';
        let color = 0xFF6B00; // Orange for medium risk

        // Set danger level based on threat type
        if (safetyResult.category.includes('Token Grabber') || 
            safetyResult.category.includes('Malware') ||
            safetyResult.reason.includes('🚨')) {
            dangerLevel = '🚨 EXTREME DANGER';
            color = 0xFF0000; // Red for high risk
        } else if (safetyResult.category.includes('Phishing') || 
                   safetyResult.category.includes('Malicious')) {
            dangerLevel = '⚠️ HIGH RISK';
            color = 0xFF3300; // Dark red for high risk
        }

        embed
            .setTitle(`${dangerLevel} - DO NOT CLICK`)
            .setColor(color)
            .setDescription(`**🔗 Link:** \`${url}\`\n\n**🛑 SECURITY ALERT:** This link has been flagged as potentially dangerous!`)
            .addFields(
                { name: '🚨 Threat Type', value: safetyResult.category, inline: true },
                { name: '🔍 Detection Reason', value: safetyResult.reason, inline: true },
                { name: '⚠️ **IMPORTANT WARNING**', value: '**DO NOT CLICK THIS LINK!**\n\nThis link may:\n• Steal your Discord token\n• Install malware on your device\n• Phish your login credentials\n• Compromise your accounts', inline: false }
            )
            .setFooter({ text: '🔒 Stay safe! Report suspicious links to server administrators.' });
    }

    return embed;
}

client.on('ready', async () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🔍 Monitoring ${client.guilds.cache.size} servers for link safety`);
    console.log(`📊 Tracking user levels and XP!`);
    console.log(`🗑️ Auto-deleting blacklisted content (match requests, self-promo, game spam)!`);

    // Set custom bot status
    try {
        await client.user.setPresence({
            activities: [{
                name: 'made with love by script 💖',
                type: 0 // 0 = PLAYING, 1 = STREAMING, 2 = LISTENING, 3 = WATCHING, 5 = COMPETING
            }],
            status: 'online' // 'online', 'idle', 'dnd', 'invisible'
        });
        console.log('✅ Bot status set successfully!');
    } catch (error) {
        console.error('❌ Error setting bot status:', error);
    }

    // Clean up any leftover temp voice channels from previous sessions
    console.log('🧹 Cleaning up temporary voice channels...');
    for (const guild of client.guilds.cache.values()) {
        const channelsToCheck = guild.channels.cache.filter(channel => 
            channel.type === 2 && channel.name.toLowerCase().includes('temp')
        );
        
        for (const channel of channelsToCheck.values()) {
            // If it's an old temp channel, remove it
            if (tempVoiceChannels[channel.id] && Date.now() > tempVoiceChannels[channel.id].deleteAt) {
                try {
                    // Clear any pending timeouts
                    if (tempVoiceChannels[channel.id].timeout) {
                        clearTimeout(tempVoiceChannels[channel.id].timeout);
                    }
                    
                    await channel.delete('Expired temporary VC cleanup');
                    delete tempVoiceChannels[channel.id];
                    console.log(`🗑️ Cleaned up expired temp VC: ${channel.name}`);
                } catch (error) {
                    console.log(`Could not clean up temp VC ${channel.name}:`, error.message);
                }
            }
        }
    }

    // Register slash commands
    const commands = [
        {
            name: 'embed',
            description: 'Create and send custom embeds',
            options: [
                {
                    name: 'message',
                    description: 'The message content for the embed',
                    type: 3, // STRING
                    required: true
                },
                {
                    name: 'channel',
                    description: 'Channel to send the embed to',
                    type: 7, // CHANNEL
                    required: false
                },
                {
                    name: 'style',
                    description: 'Embed style/color',
                    type: 3, // STRING
                    required: false,
                    choices: [
                        { name: '📝 Basic (Black)', value: 'basic' },
                        { name: '✅ Success (Green)', value: 'success' },
                        { name: '❌ Error (Red)', value: 'error' },
                        { name: '⚠️ Warning (Yellow)', value: 'warning' },
                        { name: 'ℹ️ Information (Blue)', value: 'info' },
                        { name: '💖 Cute (Pink)', value: 'cute' },
                        { name: '📢 Announcement (Purple)', value: 'announcement' }
                    ]
                },
                {
                    name: 'image',
                    description: 'Image URL for the embed',
                    type: 3, // STRING
                    required: false
                },
                {
                    name: 'thumbnail',
                    description: 'Thumbnail URL for the embed',
                    type: 3, // STRING
                    required: false
                },
                {
                    name: 'video',
                    description: 'Video URL for the embed',
                    type: 3, // STRING
                    required: false
                },
                {
                    name: 'author_name',
                    description: 'Author name for the embed',
                    type: 3, // STRING
                    required: false
                },
                {
                    name: 'author_icon',
                    description: 'Author icon URL for the embed',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        // Information Commands (Owner Only)
        {
            name: 'show-admins',
            description: '[OWNER] Show server administrators'
        },
        {
            name: 'show-owner',
            description: '[OWNER] Show server owner information'
        },
        {
            name: 'show-roles',
            description: '[OWNER] Show all server roles'
        },
        {
            name: 'show-active',
            description: '[OWNER] Show all active server members'
        },
        // Message Management Commands (Owner Only)
        {
            name: 'delete-mes-channel',
            description: '[OWNER] Auto-delete messages in a channel',
            options: [
                {
                    name: 'channel',
                    description: 'Channel to delete messages from',
                    type: 7, // CHANNEL
                    required: true
                },
                {
                    name: 'duration',
                    description: 'How long to keep deleting messages',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: '5 minutes', value: '5m' },
                        { name: '15 minutes', value: '15m' },
                        { name: '30 minutes', value: '30m' },
                        { name: '1 hour', value: '1h' },
                        { name: '2 hours', value: '2h' },
                        { name: '6 hours', value: '6h' },
                        { name: '12 hours', value: '12h' },
                        { name: '24 hours', value: '24h' }
                    ]
                }
            ]
        },
        {
            name: 'purge-spam-user',
            description: '[OWNER] Remove messages from a specific user',
            options: [
                {
                    name: 'user',
                    description: 'User whose messages to delete',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'days',
                    description: 'How many days back to delete messages',
                    type: 4, // INTEGER
                    required: true,
                    choices: [
                        { name: '1 day', value: 1 },
                        { name: '2 days', value: 2 },
                        { name: '3 days', value: 3 },
                        { name: '4 days', value: 4 },
                        { name: '5 days', value: 5 },
                        { name: '6 days', value: 6 },
                        { name: '7 days', value: 7 }
                    ]
                },
                {
                    name: 'channel',
                    description: 'Specific channel to purge from (all channels if not specified)',
                    type: 7, // CHANNEL
                    required: false
                }
            ]
        },
        {
            name: 'purge-links',
            description: '[OWNER] Delete messages containing links',
            options: [
                {
                    name: 'channel',
                    description: 'Channel to purge links from',
                    type: 7, // CHANNEL
                    required: false
                },
                {
                    name: 'user',
                    description: 'Only delete links from this user',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'amount',
                    description: 'Number of messages to check (default 100)',
                    type: 4, // INTEGER
                    required: false
                }
            ]
        },
        {
            name: 'move-message',
            description: '[OWNER] Move a message to another channel',
            options: [
                {
                    name: 'message_id',
                    description: 'ID of the message to move',
                    type: 3, // STRING
                    required: true
                },
                {
                    name: 'target_channel',
                    description: 'Channel to move the message to',
                    type: 7, // CHANNEL
                    required: true
                },
                {
                    name: 'source_channel',
                    description: 'Channel where the message is located',
                    type: 7, // CHANNEL
                    required: false
                }
            ]
        },
        // Enhanced Voice Management Commands
        {
            name: 'voice-mute-all',
            description: '[OWNER] Mute all users in a voice channel',
            options: [
                {
                    name: 'channel',
                    description: 'Voice channel to mute all users in',
                    type: 7, // CHANNEL
                    required: true
                }
            ]
        },
        {
            name: 'voice-unmute-all',
            description: '[OWNER] Unmute all users in a voice channel',
            options: [
                {
                    name: 'channel',
                    description: 'Voice channel to unmute all users in',
                    type: 7, // CHANNEL
                    required: true
                }
            ]
        },
        {
            name: 'voice-mute-users',
            description: '[OWNER] Mute specific users in voice',
            options: [
                {
                    name: 'user1',
                    description: 'First user to mute',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'user2',
                    description: 'Second user to mute',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'user3',
                    description: 'Third user to mute',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'user4',
                    description: 'Fourth user to mute',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'user5',
                    description: 'Fifth user to mute',
                    type: 6, // USER
                    required: false
                }
            ]
        },
        {
            name: 'voice-unmute-users',
            description: '[OWNER] Unmute specific users in voice',
            options: [
                {
                    name: 'user1',
                    description: 'First user to unmute',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'user2',
                    description: 'Second user to unmute',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'user3',
                    description: 'Third user to unmute',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'user4',
                    description: 'Fourth user to unmute',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'user5',
                    description: 'Fifth user to unmute',
                    type: 6, // USER
                    required: false
                }
            ]
        },
        {
            name: 'move-all-voice',
            description: '[OWNER] Move all or specific users to a voice channel',
            options: [
                {
                    name: 'target_channel',
                    description: 'Voice channel to move users to',
                    type: 7, // CHANNEL
                    channel_types: [2], // Only voice channels
                    required: true
                },
                {
                    name: 'user1',
                    description: 'Specific user to move (leave empty to move all)',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'user2',
                    description: 'Second user to move',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'user3',
                    description: 'Third user to move',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'user4',
                    description: 'Fourth user to move',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'user5',
                    description: 'Fifth user to move',
                    type: 6, // USER
                    required: false
                }
            ]
        },
        // Nickname Management
        {
            name: 'set-nick',
            description: '[OWNER] Set prefix nickname for all server members',
            options: [
                {
                    name: 'prefix',
                    description: 'Prefix to add before usernames',
                    type: 3, // STRING
                    required: true
                }
            ]
        },
        // Moderation Commands (Owner Only)
        {
            name: 'ban',
            description: '[OWNER] Ban a user from the server',
            options: [
                {
                    name: 'user',
                    description: 'The user to ban',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for the ban',
                    type: 3, // STRING
                    required: false
                },
                {
                    name: 'delete_days',
                    description: 'Days of messages to delete (0-7)',
                    type: 4, // INTEGER
                    required: false,
                    choices: [
                        { name: 'Don\'t delete any messages', value: 0 },
                        { name: '1 day', value: 1 },
                        { name: '2 days', value: 2 },
                        { name: '3 days', value: 3 },
                        { name: '7 days', value: 7 }
                    ]
                }
            ]
        },
        {
            name: 'unban',
            description: '[OWNER] Unban a user from the server',
            options: [
                {
                    name: 'user_id',
                    description: 'The user ID to unban',
                    type: 3, // STRING
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for the unban',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'kick',
            description: '[OWNER] Kick a user from the server',
            options: [
                {
                    name: 'user',
                    description: 'The user to kick',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for the kick',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'timeout',
            description: '[OWNER] Timeout/mute a user',
            options: [
                {
                    name: 'user',
                    description: 'The user to timeout',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'duration',
                    description: 'Duration of the timeout',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: '1 minute', value: '1m' },
                        { name: '5 minutes', value: '5m' },
                        { name: '10 minutes', value: '10m' },
                        { name: '1 hour', value: '1h' },
                        { name: '1 day', value: '1d' },
                        { name: '1 week', value: '1w' }
                    ]
                },
                {
                    name: 'reason',
                    description: 'Reason for the timeout',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'untimeout',
            description: '[OWNER] Remove timeout from a user',
            options: [
                {
                    name: 'user',
                    description: 'The user to remove timeout from',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for removing timeout',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'warn',
            description: '[OWNER] Warn a user',
            options: [
                {
                    name: 'user',
                    description: 'The user to warn',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for the warning',
                    type: 3, // STRING
                    required: true
                }
            ]
        },
        {
            name: 'clear',
            description: '[OWNER] Clear messages from a channel',
            options: [
                {
                    name: 'amount',
                    description: 'Number of messages to delete (1-100)',
                    type: 4, // INTEGER
                    required: true
                },
                {
                    name: 'user',
                    description: 'Only delete messages from this user',
                    type: 6, // USER
                    required: false
                }
            ]
        },
        {
            name: 'slowmode',
            description: '[OWNER] Set channel slowmode',
            options: [
                {
                    name: 'seconds',
                    description: 'Slowmode delay in seconds (0-21600)',
                    type: 4, // INTEGER
                    required: true
                },
                {
                    name: 'channel',
                    description: 'Channel to set slowmode for',
                    type: 7, // CHANNEL
                    required: false
                }
            ]
        },
        {
            name: 'nick',
            description: '[OWNER] Change a user\'s nickname',
            options: [
                {
                    name: 'user',
                    description: 'The user to change nickname for',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'nickname',
                    description: 'New nickname (leave empty to reset)',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        // Voice Management Commands
        {
            name: 'voice-move',
            description: '[OWNER] Move a user to another voice channel',
            options: [
                {
                    name: 'user',
                    description: 'The user to move',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'channel',
                    description: 'Voice channel to move user to',
                    type: 7, // CHANNEL
                    channel_types: [2], // Only voice channels
                    required: true
                }
            ]
        },
        {
            name: 'move-user',
            description: '[OWNER] Rapidly move user between voice channels',
            options: [
                {
                    name: 'user',
                    description: 'User to move rapidly between voice channels',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'speed',
                    description: 'Speed of movement between channels',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: 'Fast (2 seconds)', value: 'fast' },
                        { name: 'Ultra Fast (1 second)', value: 'ultra_fast' },
                        { name: 'Extreme Fast (0.5 seconds)', value: 'extreme_fast' },
                        { name: 'Hang Phone (0.2 seconds)', value: 'hang_phone' }
                    ]
                },
                {
                    name: 'duration',
                    description: 'How long to keep moving the user',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: '7 seconds', value: '7s' },
                        { name: '20 seconds', value: '20s' },
                        { name: '50 seconds', value: '50s' },
                        { name: '1 minute', value: '1m' },
                        { name: 'No stop (until manually stopped)', value: 'no_stop' }
                    ]
                }
            ]
        },
        {
            name: 'move-user-stop',
            description: '[OWNER] Stop rapid user movement',
            options: [
                {
                    name: 'user',
                    description: 'User to stop moving',
                    type: 6, // USER
                    required: true
                }
            ]
        },
        {
            name: 'voice-kick',
            description: '[OWNER] Disconnect a user from voice channel',
            options: [
                {
                    name: 'user',
                    description: 'The user to disconnect',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for disconnecting',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'voice-mute',
            description: '[OWNER] Server mute a user in voice',
            options: [
                {
                    name: 'user',
                    description: 'The user to mute',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for muting',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'voice-unmute',
            description: '[OWNER] Remove server mute from user in voice',
            options: [
                {
                    name: 'user',
                    description: 'The user to unmute',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for unmuting',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'voice-deafen',
            description: '[OWNER] Server deafen a user in voice',
            options: [
                {
                    name: 'user',
                    description: 'The user to deafen',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for deafening',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        {
            name: 'voice-undeafen',
            description: '[OWNER] Remove server deafen from user in voice',
            options: [
                {
                    name: 'user',
                    description: 'The user to undeafen',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'Reason for undeafening',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        // Role Management Commands
        {
            name: 'role-add',
            description: '[OWNER] Add a role to a user',
            options: [
                {
                    name: 'user',
                    description: 'The user to add role to',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'role',
                    description: 'The role to add',
                    type: 8, // ROLE
                    required: true
                }
            ]
        },
        {
            name: 'role-remove',
            description: '[OWNER] Remove a role from a user',
            options: [
                {
                    name: 'user',
                    description: 'The user to remove role from',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'role',
                    description: 'The role to remove',
                    type: 8, // ROLE
                    required: true
                }
            ]
        },
        // Message Management Commands
        {
            name: 'delete',
            description: '[OWNER] Delete a specific message by ID',
            options: [
                {
                    name: 'message_id',
                    description: 'The message ID to delete',
                    type: 3, // STRING
                    required: true
                },
                {
                    name: 'channel',
                    description: 'Channel where the message is located',
                    type: 7, // CHANNEL
                    required: false
                }
            ]
        },
        {
            name: 'say',
            description: '[OWNER] Send a message as the bot',
            options: [
                {
                    name: 'message',
                    description: 'The message to send',
                    type: 3, // STRING
                    required: true
                },
                {
                    name: 'channel',
                    description: 'Channel to send the message to',
                    type: 7, // CHANNEL
                    required: false
                }
            ]
        },
        {
            name: 'hide-message',
            description: '[OWNER] Send a message visible only to specific roles',
            options: [
                {
                    name: 'message',
                    description: 'The message to send',
                    type: 3, // STRING
                    required: true
                },
                {
                    name: 'role1',
                    description: 'First role that can see the message',
                    type: 8, // ROLE
                    required: true
                },
                {
                    name: 'role2',
                    description: 'Second role that can see the message',
                    type: 8, // ROLE
                    required: false
                },
                {
                    name: 'role3',
                    description: 'Third role that can see the message',
                    type: 8, // ROLE
                    required: false
                },
                {
                    name: 'channel',
                    description: 'Channel to send the message to',
                    type: 7, // CHANNEL
                    required: false
                }
            ]
        },
        // Temporary Voice Channel Command
        {
            name: 'temp-vc',
            description: '[OWNER] Create a temporary voice channel',
            options: [
                {
                    name: 'name',
                    description: 'Name of the voice channel',
                    type: 3, // STRING
                    required: true
                },
                {
                    name: 'duration',
                    description: 'How long before auto-deletion',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: '15 minutes', value: '15m' },
                        { name: '30 minutes', value: '30m' },
                        { name: '1 hour', value: '1h' },
                        { name: '2 hours', value: '2h' },
                        { name: '6 hours', value: '6h' },
                        { name: '12 hours', value: '12h' },
                        { name: '24 hours', value: '24h' }
                    ]
                },
                {
                    name: 'visibility',
                    description: 'Who can see the voice channel',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: 'Show to all', value: 'public' },
                        { name: 'Hide from all', value: 'private' },
                        { name: 'Invite specific members', value: 'invite' }
                    ]
                },
                {
                    name: 'category',
                    description: 'Category to create the channel in',
                    type: 7, // CHANNEL
                    channel_types: [4], // Only category channels
                    required: false
                },
                {
                    name: 'members',
                    description: 'Members to invite (if using invite visibility)',
                    type: 3, // STRING
                    required: false
                }
            ]
        },
        // Ping Command
        {
            name: 'ping',
            description: '[OWNER] Check bot latency and status'
        },
        // Utility Commands
        {
            name: 'userinfo',
            description: '[OWNER] Get detailed information about a user',
            options: [
                {
                    name: 'user',
                    description: 'The user to get info about',
                    type: 6, // USER
                    required: false
                }
            ]
        },
        {
            name: 'serverinfo',
            description: '[OWNER] Get detailed server information'
        },
        {
            name: 'modlogs',
            description: '[OWNER] View recent moderation actions',
            options: [
                {
                    name: 'user',
                    description: 'Filter by specific user',
                    type: 6, // USER
                    required: false
                },
                {
                    name: 'action',
                    description: 'Filter by action type',
                    type: 3, // STRING
                    required: false,
                    choices: [
                        { name: 'Ban', value: 'ban' },
                        { name: 'Kick', value: 'kick' },
                        { name: 'Timeout', value: 'timeout' },
                        { name: 'Warn', value: 'warn' },
                        { name: 'Voice Action', value: 'voice' }
                    ]
                }
            ]
        }
    ];

    try {
        console.log('🔄 Registering slash commands...');

        // Register commands globally
        await client.application.commands.set(commands);

        console.log('✅ Slash commands registered successfully!');
    } catch (error) {
        console.error('❌ Error registering slash commands:', error);
    }
});

// Function to split long messages into chunks
function splitMessage(message, maxLength = 1900) {
    if (message.length <= maxLength) {
        return [message];
    }

    const chunks = [];
    let currentChunk = '';
    const words = message.split(' ');

    for (const word of words) {
        // If adding this word would exceed the limit
        if ((currentChunk + ' ' + word).length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = word;
            } else {
                // Word itself is too long, split it
                const longWord = word;
                for (let i = 0; i < longWord.length; i += maxLength) {
                    chunks.push(longWord.slice(i, i + maxLength));
                }
            }
        } else {
            currentChunk += (currentChunk ? ' ' : '') + word;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

// Function to create embed preview
function createEmbedPreview(data, isMultiPart = false, partNumber = 1, totalParts = 1) {
    // Build the full message
    let displayMessage = data.message;

    // For preview, show truncated version if too long and not multi-part
    if (displayMessage.length > 1900 && !isMultiPart) {
        displayMessage = displayMessage.slice(0, 1897) + '...';
    }

    const embed = new EmbedBuilder()
        .setTimestamp();

    // Set embed style based on type
    let title = '📝 Message';
    let color = 0x000000;

    switch (data.embedType) {
        case 'success':
            color = 0x00FF00;
            title = '✅ Success';
            break;
        case 'error':
            color = 0xFF0000;
            title = '❌ Error';
            break;
        case 'warning':
            color = 0xFFFF00;
            title = '⚠️ Warning';
            break;
        case 'info':
            color = 0x0099FF;
            title = 'ℹ️ Information';
            break;
        case 'cute':
            color = 0xFF69B4;
            title = '💖 Cute Message';
            break;
        case 'announcement':
            color = 0x9932CC;
            title = '📢 Announcement';
            break;
        default:
            color = 0x000000;
            title = '📝 Message';
    }

    embed.setColor(color);

    // Add part indicator for multi-part messages
    if (totalParts > 1) {
        title += ` (${partNumber}/${totalParts})`;
    }
    embed.setTitle(title);

    // Set description
    if (displayMessage.trim()) {
        embed.setDescription(displayMessage);
    }

    // Only add image to first embed in multi-part messages
    if (data.image && partNumber === 1) {
        try {
            embed.setImage(data.image);
        } catch (error) {
            console.error('Error setting image:', error);
        }
    }

    // Only add thumbnail to first embed in multi-part messages  
    if (data.thumbnail && partNumber === 1) {
        try {
            embed.setThumbnail(data.thumbnail);
        } catch (error) {
            console.error('Error setting thumbnail:', error);
        }
    }

    // Only add author to first embed in multi-part messages
    if (data.authorName && partNumber === 1) {
        try {
            if (data.authorIcon) {
                embed.setAuthor({ name: data.authorName, iconURL: data.authorIcon });
            } else {
                embed.setAuthor({ name: data.authorName });
            }
        } catch (error) {
            console.error('Error setting author:', error);
            // Fallback: set without icon
            embed.setAuthor({ name: data.authorName });
        }
    }

    // Add video URL as a field to the last embed
    if (data.video && partNumber === totalParts) {
        embed.addFields({ 
            name: '🎥 Video', 
            value: `[Click to watch](${data.video})`, 
            inline: false 
        });
    }

    return embed;
}

// Function to create multiple embeds for long messages
function createMultipleEmbeds(data) {
    const fullMessage = data.message;

    if (fullMessage.length <= 1900) {
        return [createEmbedPreview(data)];
    }

    const messageChunks = splitMessage(data.message, 1800);
    const embeds = [];

    for (let i = 0; i < messageChunks.length; i++) {
        const tempData = { ...data };
        tempData.message = messageChunks[i];

        const embed = createEmbedPreview(tempData, true, i + 1, messageChunks.length);
        embeds.push(embed);
    }

    return embeds;
}

// Handle interactions (slash commands)
client.on('interactionCreate', async (interaction) => {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        // Check if user is bot owner for all commands
        if (interaction.user.id !== BOT_OWNER_ID) {
            return interaction.reply({ content: `❌ Only **script** can use these commands. I am assisting only for script.`, ephemeral: true });
        }

        if (interaction.commandName === 'embed') {

            await interaction.deferReply({ ephemeral: true });

            // Get all the options
            const embedMessage = interaction.options.getString('message');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const embedStyle = interaction.options.getString('style') || 'basic';
            const imageUrl = interaction.options.getString('image');
            const thumbnailUrl = interaction.options.getString('thumbnail');
            const videoUrl = interaction.options.getString('video');
            const authorName = interaction.options.getString('author_name');
            const authorIcon = interaction.options.getString('author_icon');

            // Validate channel permissions
            if (!targetChannel.isTextBased() || targetChannel.isThread()) {
                return interaction.editReply({
                    content: '❌ **Invalid channel!** Please select a text channel.'
                });
            }

            const botPermissions = targetChannel.permissionsFor(interaction.guild.members.me);
            if (!botPermissions || !botPermissions.has(['SendMessages', 'EmbedLinks', 'ViewChannel'])) {
                return interaction.editReply({
                    content: `❌ **Missing permissions!** I need "Send Messages" and "Embed Links" permissions in ${targetChannel}.`
                });
            }

            // Validate URLs if provided
            const urlValidation = (url, type) => {
                if (!url) return { valid: true };
                try {
                    new URL(url);
                    const isValidImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url) || 
                                       /^https:\/(i\.imgur\.com|cdn\.discordapp\.com|media\.giphy\.com|i\.gyazo\.com|prnt\.sc)/i.test(url);

                    if ((type === 'image' || type === 'thumbnail' || type === 'author_icon') && !isValidImage) {
                        return { valid: false, message: `Invalid ${type} URL! Use a direct image link.` };
                    }
                    return { valid: true };
                } catch (error) {
                    return { valid: false, message: `Invalid ${type} URL format!` };
                }
            };

            // Validate all URLs
            const imageValidation = urlValidation(imageUrl, 'image');
            const thumbnailValidation = urlValidation(thumbnailUrl, 'thumbnail');
            const authorIconValidation = urlValidation(authorIcon, 'author_icon');
            const videoValidation = urlValidation(videoUrl, 'video');

            if (!imageValidation.valid) {
                return interaction.editReply({ content: `❌ ${imageValidation.message}` });
            }
            if (!thumbnailValidation.valid) {
                return interaction.editReply({ content: `❌ ${thumbnailValidation.message}` });
            }
            if (!authorIconValidation.valid) {
                return interaction.editReply({ content: `❌ ${authorIconValidation.message}` });
            }
            if (!videoValidation.valid) {
                return interaction.editReply({ content: `❌ ${videoValidation.message}` });
            }

            // Build embed data
            const embedData = {
                message: embedMessage,
                image: imageUrl,
                video: videoUrl,
                embedType: embedStyle,
                targetChannel: targetChannel.id,
                authorId: interaction.user.id,
                thumbnail: thumbnailUrl,
                authorName: authorName,
                authorIcon: authorIcon
            };

            // Create embeds
            const finalEmbeds = createMultipleEmbeds(embedData);
            const messageLength = embedMessage.length;

            if (finalEmbeds.length === 0) {
                return interaction.editReply({
                    content: '❌ **Cannot create empty embed!** Please provide content.'
                });
            }

            try {
                let sentMessages = 0;
                let totalEmbedsSent = 0;

                // Send embeds in batches (Discord limit: 10 embeds per message)
                for (let i = 0; i < finalEmbeds.length; i += 10) {
                    const embedBatch = finalEmbeds.slice(i, i + 10);

                    // Validate each embed in the batch
                    const validEmbeds = [];
                    for (const embed of embedBatch) {
                        try {
                            // Test if embed is valid by converting to JSON
                            JSON.stringify(embed.toJSON());
                            validEmbeds.push(embed);
                        } catch (embedError) {
                            console.error('Invalid embed detected:', embedError);
                        }
                    }

                    if (validEmbeds.length > 0) {
                        const sentMessage = await targetChannel.send({ embeds: validEmbeds });
                        sentMessages++;
                        totalEmbedsSent += validEmbeds.length;

                        // Small delay between messages to prevent rate limiting
                        if (i + 10 < finalEmbeds.length) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }

                if (sentMessages > 0) {
                    // Create summary embed
                    const summaryEmbed = new EmbedBuilder()
                        .setTitle('🚀 Embed Sent Successfully!')
                        .setDescription(`Your embed has been sent to ${targetChannel}`)
                        .addFields(
                            { name: '📍 Channel', value: `${targetChannel}`, inline: true },
                            { name: '📊 Message Length', value: `${messageLength} characters`, inline: true },
                            { name: '📄 Embeds Created', value: `${totalEmbedsSent}`, inline: true },
                            { name: '💌 Messages Sent', value: `${sentMessages}`, inline: true },
                            { name: '🎨 Style', value: `${embedStyle}`, inline: true },
                            { name: '✅ Status', value: 'Complete', inline: true }
                        )
                        .setColor(0x00FF00)
                        .setTimestamp()
                        .setFooter({ text: '✨ Created with slash commands!' });

                    // Add feature summary
                    let features = [];
                    if (imageUrl) features.push('🖼️ Image');
                    if (thumbnailUrl) features.push('🖼️ Thumbnail');
                    if (videoUrl) features.push('🎥 Video');
                    if (authorName) features.push('👤 Author');

                    if (features.length > 0) {
                        summaryEmbed.addFields({ name: '✨ Features Used', value: features.join(', '), inline: false });
                    }

                    await interaction.editReply({ embeds: [summaryEmbed] });
                } else {
                    await interaction.editReply({
                        content: '❌ **Failed to send embed!** All embeds were invalid or corrupted.'
                    });
                }

            } catch (error) {
                console.error('Error sending embed:', error);
                let errorMessage = '❌ **Failed to send embed!**\n';

                if (error.code === 50013) {
                    errorMessage += '**Reason:** Missing permissions in target channel';
                } else if (error.code === 50035) {
                    errorMessage += '**Reason:** Invalid embed content (too long or malformed)';
                } else if (error.code === 50001) {
                    errorMessage += '**Reason:** Missing access to target channel';
                } else {
                    errorMessage += `**Reason:** ${error.message || 'Unknown error'}`;
                }

                await interaction.editReply({ content: errorMessage });
            }

            return;
        }

        // BAN COMMAND
        if (interaction.commandName === 'ban') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const deleteDays = interaction.options.getInteger('delete_days') || 0;

            try {
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                
                if (member && member.id === interaction.guild.ownerId) {
                    return interaction.editReply('❌ Cannot ban the server owner!');
                }

                if (member && member.id === client.user.id) {
                    return interaction.editReply('❌ I cannot ban myself!');
                }

                // Try to send DM before banning
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('🔨 You have been banned')
                        .setDescription(`You have been banned from **${interaction.guild.name}**`)
                        .addFields(
                            { name: 'Reason', value: reason, inline: false },
                            { name: 'Moderator', value: interaction.user.tag, inline: false }
                        )
                        .setColor(0xFF0000)
                        .setTimestamp();
                    
                    await user.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.log(`Could not DM user ${user.tag} about ban`);
                }

                // Perform the ban
                await interaction.guild.members.ban(user, {
                    reason: `${reason} | Banned by ${interaction.user.tag}`,
                    deleteMessageDays: deleteDays
                });

                // Log the action
                addModerationLog('ban', interaction.user, user, reason, { deleteDays });

                const successEmbed = new EmbedBuilder()
                    .setTitle('🔨 User Banned')
                    .setDescription(`Successfully banned **${user.tag}**`)
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Messages Deleted', value: `${deleteDays} days`, inline: true }
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Ban command error:', error);
                await interaction.editReply(`❌ Failed to ban user: ${error.message}`);
            }
            return;
        }

        // UNBAN COMMAND
        if (interaction.commandName === 'unban') {
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.options.getString('user_id');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                // Check if user is banned
                const bans = await interaction.guild.bans.fetch();
                const bannedUser = bans.get(userId);

                if (!bannedUser) {
                    return interaction.editReply('❌ User is not banned or invalid user ID!');
                }

                // Perform the unban
                await interaction.guild.members.unban(userId, `${reason} | Unbanned by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('unban', interaction.user, bannedUser.user, reason);

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ User Unbanned')
                    .setDescription(`Successfully unbanned **${bannedUser.user.tag}**`)
                    .addFields(
                        { name: 'User', value: `${bannedUser.user.tag} (${bannedUser.user.id})`, inline: true },
                        { name: 'Reason', value: reason, inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Unban command error:', error);
                await interaction.editReply(`❌ Failed to unban user: ${error.message}`);
            }
            return;
        }

        // KICK COMMAND
        if (interaction.commandName === 'kick') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (member.id === interaction.guild.ownerId) {
                    return interaction.editReply('❌ Cannot kick the server owner!');
                }

                if (member.id === client.user.id) {
                    return interaction.editReply('❌ I cannot kick myself!');
                }

                // Try to send DM before kicking
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('👢 You have been kicked')
                        .setDescription(`You have been kicked from **${interaction.guild.name}**`)
                        .addFields(
                            { name: 'Reason', value: reason, inline: false },
                            { name: 'Moderator', value: interaction.user.tag, inline: false }
                        )
                        .setColor(0xFF6600)
                        .setTimestamp();
                    
                    await user.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.log(`Could not DM user ${user.tag} about kick`);
                }

                // Perform the kick
                await member.kick(`${reason} | Kicked by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('kick', interaction.user, user, reason);

                const successEmbed = new EmbedBuilder()
                    .setTitle('👢 User Kicked')
                    .setDescription(`Successfully kicked **${user.tag}**`)
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Reason', value: reason, inline: true }
                    )
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Kick command error:', error);
                await interaction.editReply(`❌ Failed to kick user: ${error.message}`);
            }
            return;
        }

        // TIMEOUT COMMAND
        if (interaction.commandName === 'timeout') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const duration = interaction.options.getString('duration');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                const member = await interaction.guild.members.fetch(user.id);
                const timeoutMs = parseDuration(duration);

                if (!timeoutMs) {
                    return interaction.editReply('❌ Invalid duration format!');
                }

                if (member.id === interaction.guild.ownerId) {
                    return interaction.editReply('❌ Cannot timeout the server owner!');
                }

                // Perform the timeout
                await member.timeout(timeoutMs, `${reason} | Timed out by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('timeout', interaction.user, user, reason, { duration });

                const successEmbed = new EmbedBuilder()
                    .setTitle('⏰ User Timed Out')
                    .setDescription(`Successfully timed out **${user.tag}**`)
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Duration', value: duration, inline: true },
                        { name: 'Reason', value: reason, inline: true }
                    )
                    .setColor(0xFFA500)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Timeout command error:', error);
                await interaction.editReply(`❌ Failed to timeout user: ${error.message}`);
            }
            return;
        }

        // UNTIMEOUT COMMAND
        if (interaction.commandName === 'untimeout') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (!member.communicationDisabledUntil) {
                    return interaction.editReply('❌ User is not currently timed out!');
                }

                // Remove the timeout
                await member.timeout(null, `${reason} | Timeout removed by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('untimeout', interaction.user, user, reason);

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Timeout Removed')
                    .setDescription(`Successfully removed timeout from **${user.tag}**`)
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Reason', value: reason, inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Untimeout command error:', error);
                await interaction.editReply(`❌ Failed to remove timeout: ${error.message}`);
            }
            return;
        }

        // WARN COMMAND
        if (interaction.commandName === 'warn') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            try {
                // Add warning to user's record
                if (!userWarnings[user.id]) {
                    userWarnings[user.id] = [];
                }

                const warning = {
                    id: Date.now().toString(),
                    reason,
                    moderator: interaction.user.tag,
                    timestamp: new Date().toISOString()
                };

                userWarnings[user.id].push(warning);
                saveUserWarnings();

                // Log the action
                addModerationLog('warn', interaction.user, user, reason);

                // Try to send DM to user
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('⚠️ You have been warned')
                        .setDescription(`You have received a warning in **${interaction.guild.name}**`)
                        .addFields(
                            { name: 'Reason', value: reason, inline: false },
                            { name: 'Moderator', value: interaction.user.tag, inline: false },
                            { name: 'Total Warnings', value: userWarnings[user.id].length.toString(), inline: false }
                        )
                        .setColor(0xFFFF00)
                        .setTimestamp();
                    
                    await user.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.log(`Could not DM user ${user.tag} about warning`);
                }

                const successEmbed = new EmbedBuilder()
                    .setTitle('⚠️ User Warned')
                    .setDescription(`Successfully warned **${user.tag}**`)
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Total Warnings', value: userWarnings[user.id].length.toString(), inline: true }
                    )
                    .setColor(0xFFFF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Warn command error:', error);
                await interaction.editReply(`❌ Failed to warn user: ${error.message}`);
            }
            return;
        }

        // CLEAR COMMAND
        if (interaction.commandName === 'clear') {
            await interaction.deferReply({ ephemeral: true });

            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('user');

            if (amount < 1 || amount > 100) {
                return interaction.editReply('❌ Amount must be between 1 and 100!');
            }

            try {
                const messages = await interaction.channel.messages.fetch({ limit: amount + 1 });
                let messagesToDelete;

                if (targetUser) {
                    messagesToDelete = messages.filter(msg => msg.author.id === targetUser.id);
                    if (messagesToDelete.size === 0) {
                        return interaction.editReply(`❌ No messages found from ${targetUser.tag} in the last ${amount} messages!`);
                    }
                } else {
                    messagesToDelete = messages;
                }

                await interaction.channel.bulkDelete(messagesToDelete, true);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🗑️ Messages Cleared')
                    .setDescription(`Successfully deleted ${messagesToDelete.size} messages`)
                    .addFields(
                        { name: 'Channel', value: interaction.channel.toString(), inline: true },
                        { name: 'Target User', value: targetUser ? targetUser.tag : 'All users', inline: true }
                    )
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

                // Auto-delete the confirmation after 5 seconds
                setTimeout(async () => {
                    try {
                        await interaction.deleteReply();
                    } catch (error) {
                        console.log('Could not delete clear confirmation message');
                    }
                }, 5000);

            } catch (error) {
                console.error('Clear command error:', error);
                await interaction.editReply(`❌ Failed to clear messages: ${error.message}`);
            }
            return;
        }

        // SLOWMODE COMMAND
        if (interaction.commandName === 'slowmode') {
            await interaction.deferReply({ ephemeral: true });

            const seconds = interaction.options.getInteger('seconds');
            const channel = interaction.options.getChannel('channel') || interaction.channel;

            if (seconds < 0 || seconds > 21600) {
                return interaction.editReply('❌ Slowmode must be between 0 and 21600 seconds (6 hours)!');
            }

            try {
                await channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🐌 Slowmode Updated')
                    .setDescription(`Successfully set slowmode to **${seconds} seconds** in ${channel}`)
                    .setColor(0x00AAFF)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Slowmode command error:', error);
                await interaction.editReply(`❌ Failed to set slowmode: ${error.message}`);
            }
            return;
        }

        // NICKNAME COMMAND
        if (interaction.commandName === 'nick') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const nickname = interaction.options.getString('nickname');

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (member.id === interaction.guild.ownerId) {
                    return interaction.editReply('❌ Cannot change the server owner\'s nickname!');
                }

                const oldNick = member.displayName;
                await member.setNickname(nickname, `Nickname changed by ${interaction.user.tag}`);

                const successEmbed = new EmbedBuilder()
                    .setTitle('📝 Nickname Changed')
                    .setDescription(`Successfully changed **${user.tag}**'s nickname`)
                    .addFields(
                        { name: 'Old Nickname', value: oldNick, inline: true },
                        { name: 'New Nickname', value: nickname || 'Reset to username', inline: true }
                    )
                    .setColor(0x00AAFF)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Nickname command error:', error);
                await interaction.editReply(`❌ Failed to change nickname: ${error.message}`);
            }
            return;
        }

        // VOICE MANAGEMENT COMMANDS
        if (interaction.commandName === 'voice-move') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const channel = interaction.options.getChannel('channel');

            if (!channel || channel.type !== 2) { // 2 = Voice channel
                return interaction.editReply('❌ Target channel must be a voice channel!');
            }

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (!member.voice.channel) {
                    return interaction.editReply('❌ User is not in a voice channel!');
                }

                await member.voice.setChannel(channel, `Moved by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('voice-move', interaction.user, user, `Moved to ${channel.name}`);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🔀 User Moved')
                    .setDescription(`Successfully moved **${user.tag}** to ${channel}`)
                    .setColor(0x00AAFF)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Voice move command error:', error);
                await interaction.editReply(`❌ Failed to move user: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'voice-kick') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (!member.voice.channel) {
                    return interaction.editReply('❌ User is not in a voice channel!');
                }

                await member.voice.disconnect(`${reason} | Disconnected by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('voice-kick', interaction.user, user, reason);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🔇 User Disconnected')
                    .setDescription(`Successfully disconnected **${user.tag}** from voice`)
                    .addFields({ name: 'Reason', value: reason, inline: false })
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Voice kick command error:', error);
                await interaction.editReply(`❌ Failed to disconnect user: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'voice-mute') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (!member.voice.channel) {
                    return interaction.editReply('❌ User is not in a voice channel!');
                }

                await member.voice.setMute(true, `${reason} | Muted by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('voice-mute', interaction.user, user, reason);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🔇 User Voice Muted')
                    .setDescription(`Successfully muted **${user.tag}** in voice`)
                    .addFields({ name: 'Reason', value: reason, inline: false })
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Voice mute command error:', error);
                await interaction.editReply(`❌ Failed to mute user: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'voice-unmute') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (!member.voice.channel) {
                    return interaction.editReply('❌ User is not in a voice channel!');
                }

                await member.voice.setMute(false, `${reason} | Unmuted by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('voice-unmute', interaction.user, user, reason);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🔊 User Voice Unmuted')
                    .setDescription(`Successfully unmuted **${user.tag}** in voice`)
                    .addFields({ name: 'Reason', value: reason, inline: false })
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Voice unmute command error:', error);
                await interaction.editReply(`❌ Failed to unmute user: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'voice-deafen') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (!member.voice.channel) {
                    return interaction.editReply('❌ User is not in a voice channel!');
                }

                await member.voice.setDeaf(true, `${reason} | Deafened by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('voice-deafen', interaction.user, user, reason);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🔇 User Voice Deafened')
                    .setDescription(`Successfully deafened **${user.tag}** in voice`)
                    .addFields({ name: 'Reason', value: reason, inline: false })
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Voice deafen command error:', error);
                await interaction.editReply(`❌ Failed to deafen user: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'voice-undeafen') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (!member.voice.channel) {
                    return interaction.editReply('❌ User is not in a voice channel!');
                }

                await member.voice.setDeaf(false, `${reason} | Undeafened by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('voice-undeafen', interaction.user, user, reason);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🔊 User Voice Undeafened')
                    .setDescription(`Successfully undeafened **${user.tag}** in voice`)
                    .addFields({ name: 'Reason', value: reason, inline: false })
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Voice undeafen command error:', error);
                await interaction.editReply(`❌ Failed to undeafen user: ${error.message}`);
            }
            return;
        }

        // ROLE MANAGEMENT COMMANDS
        if (interaction.commandName === 'role-add') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (member.roles.cache.has(role.id)) {
                    return interaction.editReply(`❌ **${user.tag}** already has the role **${role.name}**!`);
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.editReply('❌ Cannot add this role - it\'s higher than my highest role!');
                }

                await member.roles.add(role, `Role added by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('role-add', interaction.user, user, `Added role: ${role.name}`);

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Role Added')
                    .setDescription(`Successfully added **${role.name}** to **${user.tag}**`)
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Role', value: `${role.name} (${role.id})`, inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Role add command error:', error);
                await interaction.editReply(`❌ Failed to add role: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'role-remove') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (!member.roles.cache.has(role.id)) {
                    return interaction.editReply(`❌ **${user.tag}** doesn't have the role **${role.name}**!`);
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.editReply('❌ Cannot remove this role - it\'s higher than my highest role!');
                }

                await member.roles.remove(role, `Role removed by ${interaction.user.tag}`);

                // Log the action
                addModerationLog('role-remove', interaction.user, user, `Removed role: ${role.name}`);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🗑️ Role Removed')
                    .setDescription(`Successfully removed **${role.name}** from **${user.tag}**`)
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Role', value: `${role.name} (${role.id})`, inline: true }
                    )
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Role remove command error:', error);
                await interaction.editReply(`❌ Failed to remove role: ${error.message}`);
            }
            return;
        }

        // MESSAGE MANAGEMENT COMMANDS
        if (interaction.commandName === 'delete') {
            await interaction.deferReply({ ephemeral: true });

            const messageId = interaction.options.getString('message_id');
            const channel = interaction.options.getChannel('channel') || interaction.channel;

            try {
                const message = await channel.messages.fetch(messageId);
                
                if (!message) {
                    return interaction.editReply('❌ Message not found in the specified channel!');
                }

                const messageInfo = {
                    content: message.content || '[No text content]',
                    author: message.author.tag,
                    channel: channel.name,
                    timestamp: message.createdAt.toISOString()
                };

                await message.delete();

                // Log the action
                addModerationLog('message-delete', interaction.user, message.author, 'Message deleted via command', { messageId, channel: channel.name });

                const successEmbed = new EmbedBuilder()
                    .setTitle('🗑️ Message Deleted')
                    .setDescription(`Successfully deleted message from **${messageInfo.author}**`)
                    .addFields(
                        { name: 'Channel', value: `#${messageInfo.channel}`, inline: true },
                        { name: 'Message ID', value: messageId, inline: true },
                        { name: 'Content Preview', value: messageInfo.content.length > 100 ? messageInfo.content.substring(0, 100) + '...' : messageInfo.content, inline: false }
                    )
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Delete command error:', error);
                await interaction.editReply(`❌ Failed to delete message: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'say') {
            await interaction.deferReply({ ephemeral: true });

            const message = interaction.options.getString('message');
            const channel = interaction.options.getChannel('channel') || interaction.channel;

            try {
                if (!channel.isTextBased()) {
                    return interaction.editReply('❌ Can only send messages to text channels!');
                }

                const permissions = channel.permissionsFor(interaction.guild.members.me);
                if (!permissions || !permissions.has(['SendMessages', 'ViewChannel'])) {
                    return interaction.editReply(`❌ Missing permissions to send messages in ${channel}!`);
                }

                await channel.send(message);

                const successEmbed = new EmbedBuilder()
                    .setTitle('📢 Message Sent')
                    .setDescription(`Successfully sent message to ${channel}`)
                    .addFields(
                        { name: 'Channel', value: channel.toString(), inline: true },
                        { name: 'Message', value: message.length > 100 ? message.substring(0, 100) + '...' : message, inline: false }
                    )
                    .setColor(0x00AAFF)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Say command error:', error);
                await interaction.editReply(`❌ Failed to send message: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'hide-message') {
            await interaction.deferReply({ ephemeral: true });

            const message = interaction.options.getString('message');
            const role1 = interaction.options.getRole('role1');
            const role2 = interaction.options.getRole('role2');
            const role3 = interaction.options.getRole('role3');
            const channel = interaction.options.getChannel('channel') || interaction.channel;

            try {
                if (!channel.isTextBased()) {
                    return interaction.editReply('❌ Can only send messages to text channels!');
                }

                // Collect all valid roles
                const allowedRoles = [role1];
                if (role2) allowedRoles.push(role2);
                if (role3) allowedRoles.push(role3);

                // Create permission overwrites
                const permissionOverwrites = [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: ['ViewChannel']
                    },
                    {
                        id: interaction.guild.members.me.id,
                        allow: ['ViewChannel', 'SendMessages']
                    },
                    {
                        id: BOT_OWNER_ID,
                        allow: ['ViewChannel', 'SendMessages']
                    }
                ];

                // Add permissions for specified roles
                allowedRoles.forEach(role => {
                    permissionOverwrites.push({
                        id: role.id,
                        allow: ['ViewChannel']
                    });
                });

                // Create temporary thread or send with role mentions
                const roleList = allowedRoles.map(role => `<@&${role.id}>`).join(', ');
                const hiddenMessage = `**🔒 Private Message for ${allowedRoles.map(r => r.name).join(', ')}:**\n\n${message}`;

                await channel.send(hiddenMessage);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🔒 Hidden Message Sent')
                    .setDescription(`Successfully sent private message to ${channel}`)
                    .addFields(
                        { name: 'Channel', value: channel.toString(), inline: true },
                        { name: 'Visible to Roles', value: allowedRoles.map(r => r.name).join(', '), inline: true },
                        { name: 'Message', value: message.length > 100 ? message.substring(0, 100) + '...' : message, inline: false }
                    )
                    .setColor(0x9932CC)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Hide message command error:', error);
                await interaction.editReply(`❌ Failed to send hidden message: ${error.message}`);
            }
            return;
        }

        // TEMPORARY VOICE CHANNEL COMMAND
        if (interaction.commandName === 'temp-vc') {
            await interaction.deferReply({ ephemeral: true });

            const name = interaction.options.getString('name');
            const duration = interaction.options.getString('duration');
            const category = interaction.options.getChannel('category');
            const visibility = interaction.options.getString('visibility');
            const membersString = interaction.options.getString('members');

            try {
                // Parse duration to milliseconds
                const durationMs = parseDuration(duration);
                if (!durationMs) {
                    return interaction.editReply('❌ Invalid duration format!');
                }

                // Create channel options
                const channelOptions = {
                    name: name,
                    type: 2, // Voice channel
                    reason: `Temporary VC created by ${interaction.user.tag}`
                };

                if (category && category.type === 4) { // Category channel
                    channelOptions.parent = category.id;
                }

                // Set permissions based on visibility
                if (visibility === 'private') {
                    channelOptions.permissionOverwrites = [
                        {
                            id: interaction.guild.roles.everyone,
                            deny: ['ViewChannel', 'Connect']
                        },
                        {
                            id: interaction.guild.members.me.id,
                            allow: ['ViewChannel', 'Connect', 'ManageChannels']
                        },
                        {
                            id: BOT_OWNER_ID,
                            allow: ['ViewChannel', 'Connect', 'ManageChannels']
                        }
                    ];
                } else if (visibility === 'invite' && membersString) {
                    const mentionMatches = membersString.match(/<@!?(\d+)>/g);
                    if (!mentionMatches) {
                        return interaction.editReply('❌ Invalid member mentions! Use @user format.');
                    }

                    const memberIds = mentionMatches.map(mention => mention.replace(/<@!?(\d+)>/, '$1'));

                    channelOptions.permissionOverwrites = [
                        {
                            id: interaction.guild.roles.everyone,
                            deny: ['ViewChannel', 'Connect']
                        },
                        {
                            id: interaction.guild.members.me.id,
                            allow: ['ViewChannel', 'Connect', 'ManageChannels']
                        },
                        {
                            id: BOT_OWNER_ID,
                            allow: ['ViewChannel', 'Connect', 'ManageChannels']
                        }
                    ];

                    // Add permissions for invited members
                    memberIds.forEach(memberId => {
                        channelOptions.permissionOverwrites.push({
                            id: memberId,
                            allow: ['ViewChannel', 'Connect']
                        });
                    });
                }

                // Create the voice channel
                const voiceChannel = await interaction.guild.channels.create(channelOptions);

                // Store temp channel info
                tempVoiceChannels[voiceChannel.id] = {
                    createdBy: interaction.user.id,
                    createdAt: Date.now(),
                    deleteAt: Date.now() + durationMs,
                    duration: duration,
                    timeout: null // Store timeout reference
                };

                // Schedule deletion by duration
                const durationTimeout = setTimeout(async () => {
                    try {
                        const channelToDelete = interaction.guild.channels.cache.get(voiceChannel.id);
                        if (channelToDelete) {
                            await channelToDelete.delete('Temporary VC expired');
                            delete tempVoiceChannels[voiceChannel.id];
                            console.log(`🗑️ Auto-deleted temp VC "${name}" - duration expired`);
                        }
                    } catch (error) {
                        console.error('Error deleting temp VC by duration:', error);
                    }
                }, durationMs);

                // Store the timeout reference
                tempVoiceChannels[voiceChannel.id].timeout = durationTimeout;

                const successEmbed = new EmbedBuilder()
                    .setTitle('🎤 Temporary Voice Channel Created')
                    .setDescription(`Successfully created **${name}**`)
                    .addFields(
                        { name: 'Channel', value: voiceChannel.toString(), inline: true },
                        { name: 'Duration', value: duration, inline: true },
                        { name: 'Visibility', value: visibility, inline: true },
                        { name: 'Category', value: category ? category.name : 'None', inline: true },
                        { name: 'Auto-Delete', value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`, inline: true },
                        { name: '🔄 Smart Delete', value: 'Will also delete when empty', inline: true }
                    )
                    .setColor(0x00AAFF)
                    .setTimestamp();

                if (visibility === 'invite' && membersString) {
                    successEmbed.addFields({ name: 'Invited Members', value: membersString, inline: false });
                }

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Temp VC command error:', error);
                await interaction.editReply(`❌ Failed to create temporary voice channel: ${error.message}`);
            }
            return;
        }

        // PING COMMAND
        if (interaction.commandName === 'ping') {
            await interaction.deferReply({ ephemeral: true });

            const start = Date.now();
            await interaction.editReply('🏓 Pinging...');
            const end = Date.now();

            const pingEmbed = new EmbedBuilder()
                .setTitle('🏓 Pong!')
                .addFields(
                    { name: '📶 Bot Latency', value: `${end - start}ms`, inline: true },
                    { name: '💓 API Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true },
                    { name: '⚡ Status', value: 'Online & Ready', inline: true },
                    { name: '🕐 Uptime', value: `${Math.floor(client.uptime / 1000 / 60)} minutes`, inline: true },
                    { name: '🏠 Servers', value: `${client.guilds.cache.size}`, inline: true },
                    { name: '👥 Users', value: `${client.users.cache.size}`, inline: true }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.editReply({ content: '', embeds: [pingEmbed] });
            return;
        }

        // UTILITY COMMANDS
        if (interaction.commandName === 'userinfo') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user') || interaction.user;

            try {
                const member = await interaction.guild.members.fetch(user.id);
                const userWarningCount = userWarnings[user.id] ? userWarnings[user.id].length : 0;

                const embed = new EmbedBuilder()
                    .setTitle(`👤 User Information - ${user.tag}`)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: '🆔 User ID', value: user.id, inline: true },
                        { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
                        { name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
                        { name: '👑 Highest Role', value: member.roles.highest.toString(), inline: true },
                        { name: '⚠️ Warnings', value: userWarningCount.toString(), inline: true },
                        { name: '🤖 Bot?', value: user.bot ? 'Yes' : 'No', inline: true },
                        { name: '🎮 Status', value: member.presence?.status || 'offline', inline: true },
                        { name: '📱 Platform', value: member.presence?.clientStatus ? Object.keys(member.presence.clientStatus).join(', ') : 'Unknown', inline: true },
                        { name: '🎯 Activity', value: member.presence?.activities[0]?.name || 'None', inline: true }
                    )
                    .setColor(member.displayHexColor || 0x000000)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Userinfo command error:', error);
                await interaction.editReply(`❌ Failed to get user info: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'serverinfo') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const guild = interaction.guild;
                const owner = await guild.fetchOwner();

                const embed = new EmbedBuilder()
                    .setTitle(`🏠 Server Information - ${guild.name}`)
                    .setThumbnail(guild.iconURL({ dynamic: true }))
                    .addFields(
                        { name: '🆔 Server ID', value: guild.id, inline: true },
                        { name: '👑 Owner', value: owner.user.tag, inline: true },
                        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
                        { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
                        { name: '💬 Channels', value: guild.channels.cache.size.toString(), inline: true },
                        { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
                        { name: '😀 Emojis', value: guild.emojis.cache.size.toString(), inline: true },
                        { name: '🔒 Verification Level', value: guild.verificationLevel.toString(), inline: true },
                        { name: '🛡️ Moderation Level', value: guild.explicitContentFilter.toString(), inline: true }
                    )
                    .setColor(0x000000)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Serverinfo command error:', error);
                await interaction.editReply(`❌ Failed to get server info: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'modlogs') {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('user');
            const actionFilter = interaction.options.getString('action');

            try {
                let filteredLogs = [...moderationLogs];

                if (targetUser) {
                    filteredLogs = filteredLogs.filter(log => log.target.id === targetUser.id);
                }

                if (actionFilter) {
                    filteredLogs = filteredLogs.filter(log => log.action.toLowerCase().includes(actionFilter.toLowerCase()));
                }

                if (filteredLogs.length === 0) {
                    return interaction.editReply('❌ No moderation logs found with the specified filters!');
                }

                const logsToShow = filteredLogs.slice(0, 10); // Show last 10 logs

                const embed = new EmbedBuilder()
                    .setTitle('📋 Moderation Logs')
                    .setDescription(`Showing ${logsToShow.length} of ${filteredLogs.length} logs`)
                    .setColor(0x000000)
                    .setTimestamp();

                for (const log of logsToShow) {
                    const timestamp = new Date(log.timestamp).toLocaleString();
                    embed.addFields({
                        name: `${log.action.toUpperCase()} - ${timestamp}`,
                        value: `**Target:** ${log.target.tag}\n**Moderator:** ${log.moderator.tag}\n**Reason:** ${log.reason}`,
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Modlogs command error:', error);
                await interaction.editReply(`❌ Failed to get moderation logs: ${error.message}`);
            }
            return;
        }

        // INFORMATION COMMANDS
        if (interaction.commandName === 'show-admins') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const admins = interaction.guild.members.cache.filter(member => 
                    member.permissions.has('Administrator') && !member.user.bot
                );

                if (admins.size === 0) {
                    return interaction.editReply('❌ No administrators found in this server!');
                }

                const adminList = admins.map(admin => 
                    `• **${admin.displayName}** (${admin.user.tag})\n  └ ID: ${admin.id}`
                ).join('\n');

                const embed = new EmbedBuilder()
                    .setTitle('👑 Server Administrators')
                    .setDescription(adminList)
                    .addFields({ name: '📊 Total Count', value: admins.size.toString(), inline: true })
                    .setColor(0xFFD700)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Show admins command error:', error);
                await interaction.editReply(`❌ Failed to show administrators: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'show-owner') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const owner = await interaction.guild.fetchOwner();

                const embed = new EmbedBuilder()
                    .setTitle('👑 Server Owner')
                    .setThumbnail(owner.user.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: '👤 Username', value: owner.user.tag, inline: true },
                        { name: '📝 Display Name', value: owner.displayName, inline: true },
                        { name: '🆔 User ID', value: owner.id, inline: true },
                        { name: '📅 Account Created', value: `<t:${Math.floor(owner.user.createdTimestamp / 1000)}:F>`, inline: true },
                        { name: '📅 Joined Server', value: `<t:${Math.floor(owner.joinedTimestamp / 1000)}:F>`, inline: true },
                        { name: '🎮 Status', value: owner.presence?.status || 'offline', inline: true }
                    )
                    .setColor(0xFFD700)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Show owner command error:', error);
                await interaction.editReply(`❌ Failed to show server owner: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'show-roles') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const roles = interaction.guild.roles.cache
                    .filter(role => role.name !== '@everyone')
                    .sort((a, b) => b.position - a.position);

                if (roles.size === 0) {
                    return interaction.editReply('❌ No roles found in this server!');
                }

                const roleList = roles.map(role => 
                    `• ${role} - Members: ${role.members.size} | Position: ${role.position}`
                ).join('\n');

                // Split into chunks if too long
                const chunks = [];
                let currentChunk = '';
                
                for (const line of roleList.split('\n')) {
                    if ((currentChunk + line + '\n').length > 1900) {
                        chunks.push(currentChunk);
                        currentChunk = line + '\n';
                    } else {
                        currentChunk += line + '\n';
                    }
                }
                if (currentChunk) chunks.push(currentChunk);

                for (let i = 0; i < chunks.length; i++) {
                    const embed = new EmbedBuilder()
                        .setTitle(`🎭 Server Roles ${chunks.length > 1 ? `(${i + 1}/${chunks.length})` : ''}`)
                        .setDescription(chunks[i])
                        .addFields({ name: '📊 Total Roles', value: roles.size.toString(), inline: true })
                        .setColor(0x9932CC)
                        .setTimestamp();

                    if (i === 0) {
                        await interaction.editReply({ embeds: [embed] });
                    } else {
                        await interaction.followUp({ embeds: [embed], ephemeral: true });
                    }
                }

            } catch (error) {
                console.error('Show roles command error:', error);
                await interaction.editReply(`❌ Failed to show roles: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'show-active') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const activeMembers = interaction.guild.members.cache.filter(member => 
                    !member.user.bot && 
                    member.presence?.status && 
                    member.presence.status !== 'offline'
                );

                if (activeMembers.size === 0) {
                    return interaction.editReply('❌ No active members found!');
                }

                const memberList = activeMembers.map(member => {
                    const status = member.presence?.status || 'offline';
                    const activity = member.presence?.activities[0]?.name || 'None';
                    return `• **${member.displayName}** - ${status}\n  └ Activity: ${activity}`;
                }).join('\n');

                const embed = new EmbedBuilder()
                    .setTitle('🟢 Active Server Members')
                    .setDescription(memberList.length > 1900 ? memberList.substring(0, 1897) + '...' : memberList)
                    .addFields({ name: '📊 Active Count', value: activeMembers.size.toString(), inline: true })
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Show active command error:', error);
                await interaction.editReply(`❌ Failed to show active members: ${error.message}`);
            }
            return;
        }

        // MESSAGE MANAGEMENT COMMANDS
        if (interaction.commandName === 'delete-mes-channel') {
            await interaction.deferReply({ ephemeral: true });

            const channel = interaction.options.getChannel('channel');
            const duration = interaction.options.getString('duration');

            try {
                if (!channel.isTextBased()) {
                    return interaction.editReply('❌ Can only auto-delete in text channels!');
                }

                const durationMs = parseDuration(duration);
                if (!durationMs) {
                    return interaction.editReply('❌ Invalid duration format!');
                }

                const endTime = Date.now() + durationMs;

                // Start auto-deletion interval
                const deletionInterval = setInterval(async () => {
                    if (Date.now() >= endTime) {
                        clearInterval(deletionInterval);
                        return;
                    }

                    try {
                        const messages = await channel.messages.fetch({ limit: 10 });
                        const messagesToDelete = messages.filter(msg => Date.now() - msg.createdTimestamp < 1209600000); // 14 days old max
                        
                        if (messagesToDelete.size > 0) {
                            await channel.bulkDelete(messagesToDelete, true);
                        }
                    } catch (error) {
                        console.error('Auto-delete error:', error);
                    }
                }, 30000); // Check every 30 seconds

                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Auto-Delete Activated')
                    .setDescription(`Auto-deletion started in ${channel}`)
                    .addFields(
                        { name: 'Duration', value: duration, inline: true },
                        { name: 'Ends At', value: `<t:${Math.floor(endTime / 1000)}:F>`, inline: true }
                    )
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Delete-mes-channel command error:', error);
                await interaction.editReply(`❌ Failed to start auto-deletion: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'purge-spam-user') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const days = interaction.options.getInteger('days');
            const specificChannel = interaction.options.getChannel('channel');

            try {
                const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
                let totalDeleted = 0;
                const channels = specificChannel ? [specificChannel] : interaction.guild.channels.cache.filter(ch => ch.isTextBased());

                for (const channel of channels.values()) {
                    try {
                        let lastMessageId;
                        let hasMore = true;

                        while (hasMore) {
                            const fetchOptions = { limit: 100 };
                            if (lastMessageId) fetchOptions.before = lastMessageId;

                            const messages = await channel.messages.fetch(fetchOptions);
                            if (messages.size === 0) break;

                            const userMessages = messages.filter(msg => 
                                msg.author.id === user.id && 
                                msg.createdTimestamp >= cutoffTime
                            );

                            if (userMessages.size > 0) {
                                await channel.bulkDelete(userMessages, true);
                                totalDeleted += userMessages.size;
                            }

                            lastMessageId = messages.last().id;
                            
                            // Check if oldest message is beyond our cutoff
                            if (messages.last().createdTimestamp < cutoffTime) {
                                hasMore = false;
                            }
                        }
                    } catch (channelError) {
                        console.error(`Error purging in channel ${channel.name}:`, channelError);
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Spam User Purged')
                    .setDescription(`Successfully deleted **${totalDeleted}** messages from **${user.tag}**`)
                    .addFields(
                        { name: 'Time Range', value: `Last ${days} days`, inline: true },
                        { name: 'Target', value: specificChannel ? specificChannel.toString() : 'All channels', inline: true }
                    )
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Purge spam user command error:', error);
                await interaction.editReply(`❌ Failed to purge user messages: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'purge-links') {
            await interaction.deferReply({ ephemeral: true });

            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const user = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount') || 100;

            try {
                const messages = await channel.messages.fetch({ limit: Math.min(amount, 100) });
                let messagesWithLinks = messages.filter(msg => urlPattern.test(msg.content));

                if (user) {
                    messagesWithLinks = messagesWithLinks.filter(msg => msg.author.id === user.id);
                }

                if (messagesWithLinks.size === 0) {
                    return interaction.editReply('❌ No messages with links found!');
                }

                await channel.bulkDelete(messagesWithLinks, true);

                const embed = new EmbedBuilder()
                    .setTitle('🔗 Links Purged')
                    .setDescription(`Successfully deleted **${messagesWithLinks.size}** messages containing links`)
                    .addFields(
                        { name: 'Channel', value: channel.toString(), inline: true },
                        { name: 'User Filter', value: user ? user.tag : 'All users', inline: true }
                    )
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Purge links command error:', error);
                await interaction.editReply(`❌ Failed to purge links: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'move-message') {
            await interaction.deferReply({ ephemeral: true });

            const messageId = interaction.options.getString('message_id');
            const targetChannel = interaction.options.getChannel('target_channel');
            const sourceChannel = interaction.options.getChannel('source_channel') || interaction.channel;

            try {
                const message = await sourceChannel.messages.fetch(messageId);
                
                if (!message) {
                    return interaction.editReply('❌ Message not found in the source channel!');
                }

                // Create embed with original message content
                const moveEmbed = new EmbedBuilder()
                    .setAuthor({ 
                        name: message.author.displayName, 
                        iconURL: message.author.displayAvatarURL() 
                    })
                    .setDescription(message.content || '[No text content]')
                    .addFields(
                        { name: 'Original Channel', value: sourceChannel.toString(), inline: true },
                        { name: 'Message ID', value: messageId, inline: true },
                        { name: 'Sent At', value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`, inline: true }
                    )
                    .setColor(0x00AAFF)
                    .setTimestamp();

                // Add attachments if any
                if (message.attachments.size > 0) {
                    const attachmentUrls = message.attachments.map(att => att.url).join('\n');
                    moveEmbed.addFields({ name: 'Attachments', value: attachmentUrls, inline: false });
                }

                await targetChannel.send({ embeds: [moveEmbed] });
                await message.delete();

                const successEmbed = new EmbedBuilder()
                    .setTitle('📤 Message Moved')
                    .setDescription(`Successfully moved message to ${targetChannel}`)
                    .addFields(
                        { name: 'From', value: sourceChannel.toString(), inline: true },
                        { name: 'To', value: targetChannel.toString(), inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Move message command error:', error);
                await interaction.editReply(`❌ Failed to move message: ${error.message}`);
            }
            return;
        }

        // ENHANCED VOICE MANAGEMENT COMMANDS
        if (interaction.commandName === 'voice-mute-all') {
            await interaction.deferReply({ ephemeral: true });

            const channel = interaction.options.getChannel('channel');

            if (!channel.isVoiceBased()) {
                return interaction.editReply('❌ Please select a voice channel!');
            }

            try {
                const members = channel.members;
                let mutedCount = 0;

                for (const [id, member] of members) {
                    try {
                        await member.voice.setMute(true, `Mass mute by ${interaction.user.tag}`);
                        mutedCount++;
                    } catch (error) {
                        console.error(`Failed to mute ${member.displayName}:`, error);
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔇 All Users Muted')
                    .setDescription(`Successfully muted **${mutedCount}** users in ${channel}`)
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Voice mute all command error:', error);
                await interaction.editReply(`❌ Failed to mute all users: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'voice-unmute-all') {
            await interaction.deferReply({ ephemeral: true });

            const channel = interaction.options.getChannel('channel');

            if (!channel.isVoiceBased()) {
                return interaction.editReply('❌ Please select a voice channel!');
            }

            try {
                const members = channel.members;
                let unmutedCount = 0;

                for (const [id, member] of members) {
                    try {
                        await member.voice.setMute(false, `Mass unmute by ${interaction.user.tag}`);
                        unmutedCount++;
                    } catch (error) {
                        console.error(`Failed to unmute ${member.displayName}:`, error);
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔊 All Users Unmuted')
                    .setDescription(`Successfully unmuted **${unmutedCount}** users in ${channel}`)
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Voice unmute all command error:', error);
                await interaction.editReply(`❌ Failed to unmute all users: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'voice-mute-users') {
            await interaction.deferReply({ ephemeral: true });

            const users = [
                interaction.options.getUser('user1'),
                interaction.options.getUser('user2'),
                interaction.options.getUser('user3'),
                interaction.options.getUser('user4'),
                interaction.options.getUser('user5')
            ].filter(user => user !== null);

            try {
                let mutedCount = 0;
                const results = [];

                for (const user of users) {
                    try {
                        const member = await interaction.guild.members.fetch(user.id);
                        
                        if (!member.voice.channel) {
                            results.push(`❌ ${user.tag} - Not in voice`);
                            continue;
                        }

                        await member.voice.setMute(true, `Selective mute by ${interaction.user.tag}`);
                        results.push(`✅ ${user.tag} - Muted`);
                        mutedCount++;
                    } catch (error) {
                        results.push(`❌ ${user.tag} - Failed to mute`);
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔇 Users Muted')
                    .setDescription(results.join('\n'))
                    .addFields({ name: 'Total Muted', value: mutedCount.toString(), inline: true })
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Voice mute users command error:', error);
                await interaction.editReply(`❌ Failed to mute users: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'voice-unmute-users') {
            await interaction.deferReply({ ephemeral: true });

            const users = [
                interaction.options.getUser('user1'),
                interaction.options.getUser('user2'),
                interaction.options.getUser('user3'),
                interaction.options.getUser('user4'),
                interaction.options.getUser('user5')
            ].filter(user => user !== null);

            try {
                let unmutedCount = 0;
                const results = [];

                for (const user of users) {
                    try {
                        const member = await interaction.guild.members.fetch(user.id);
                        
                        if (!member.voice.channel) {
                            results.push(`❌ ${user.tag} - Not in voice`);
                            continue;
                        }

                        await member.voice.setMute(false, `Selective unmute by ${interaction.user.tag}`);
                        results.push(`✅ ${user.tag} - Unmuted`);
                        unmutedCount++;
                    } catch (error) {
                        results.push(`❌ ${user.tag} - Failed to unmute`);
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔊 Users Unmuted')
                    .setDescription(results.join('\n'))
                    .addFields({ name: 'Total Unmuted', value: unmutedCount.toString(), inline: true })
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Voice unmute users command error:', error);
                await interaction.editReply(`❌ Failed to unmute users: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'move-all-voice') {
            await interaction.deferReply({ ephemeral: true });

            const targetChannel = interaction.options.getChannel('target_channel');
            const specificUsers = [
                interaction.options.getUser('user1'),
                interaction.options.getUser('user2'),
                interaction.options.getUser('user3'),
                interaction.options.getUser('user4'),
                interaction.options.getUser('user5')
            ].filter(user => user !== null);

            if (!targetChannel.isVoiceBased()) {
                return interaction.editReply('❌ Target must be a voice channel!');
            }

            try {
                let movedCount = 0;
                const results = [];

                if (specificUsers.length > 0) {
                    // Move specific users
                    for (const user of specificUsers) {
                        try {
                            const member = await interaction.guild.members.fetch(user.id);
                            
                            if (!member.voice.channel) {
                                results.push(`❌ ${user.tag} - Not in voice`);
                                continue;
                            }

                            await member.voice.setChannel(targetChannel, `Moved by ${interaction.user.tag}`);
                            results.push(`✅ ${user.tag} - Moved`);
                            movedCount++;
                        } catch (error) {
                            results.push(`❌ ${user.tag} - Failed to move`);
                        }
                    }
                } else {
                    // Move all users from all voice channels
                    const voiceChannels = interaction.guild.channels.cache.filter(ch => ch.isVoiceBased());
                    
                    for (const [id, channel] of voiceChannels) {
                        if (channel.id === targetChannel.id) continue; // Skip target channel
                        
                        for (const [memberId, member] of channel.members) {
                            try {
                                await member.voice.setChannel(targetChannel, `Mass move by ${interaction.user.tag}`);
                                movedCount++;
                            } catch (error) {
                                console.error(`Failed to move ${member.displayName}:`, error);
                            }
                        }
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔀 Voice Users Moved')
                    .setDescription(specificUsers.length > 0 ? results.join('\n') : `Moved **${movedCount}** users to ${targetChannel}`)
                    .addFields({ name: 'Total Moved', value: movedCount.toString(), inline: true })
                    .setColor(0x00AAFF)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Move all voice command error:', error);
                await interaction.editReply(`❌ Failed to move users: ${error.message}`);
            }
            return;
        }

        // RAPID USER MOVEMENT COMMANDS
        if (interaction.commandName === 'move-user') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const speed = interaction.options.getString('speed');
            const duration = interaction.options.getString('duration');

            try {
                const member = await interaction.guild.members.fetch(user.id);

                if (!member.voice.channel) {
                    return interaction.editReply('❌ User is not in a voice channel!');
                }

                // Stop any existing movement for this user
                if (rapidMoveIntervals[user.id]) {
                    clearInterval(rapidMoveIntervals[user.id].interval);
                    if (rapidMoveIntervals[user.id].timeout) {
                        clearTimeout(rapidMoveIntervals[user.id].timeout);
                    }
                    // Unmute user from previous session
                    try {
                        await member.voice.setMute(false, 'Stopping previous rapid movement');
                    } catch (error) {
                        console.log('Could not unmute user from previous session');
                    }
                }

                // Get all voice channels in the server
                const voiceChannels = Array.from(interaction.guild.channels.cache
                    .filter(ch => ch.type === 2 && ch.members.size >= 0) // Voice channels
                    .values());

                if (voiceChannels.length < 2) {
                    return interaction.editReply('❌ Need at least 2 voice channels to move user between!');
                }

                // Mute the user during rapid movement
                await member.voice.setMute(true, `Rapid movement started by ${interaction.user.tag}`);

                // Set movement speed intervals
                const speeds = {
                    'fast': 2000,
                    'ultra_fast': 1000,
                    'extreme_fast': 500,
                    'hang_phone': 200
                };

                const intervalTime = speeds[speed];
                let currentChannelIndex = 0;

                // Start rapid movement
                const moveInterval = setInterval(async () => {
                    try {
                        const targetChannel = voiceChannels[currentChannelIndex];
                        if (targetChannel && member.voice.channel) {
                            await member.voice.setChannel(targetChannel, 'Rapid movement');
                        }
                        currentChannelIndex = (currentChannelIndex + 1) % voiceChannels.length;
                    } catch (error) {
                        console.error('Error during rapid movement:', error);
                        clearInterval(moveInterval);
                        delete rapidMoveIntervals[user.id];
                        // Try to unmute on error
                        try {
                            await member.voice.setMute(false, 'Rapid movement ended due to error');
                        } catch (unmuteError) {
                            console.log('Could not unmute user after error');
                        }
                    }
                }, intervalTime);

                // Store interval info
                rapidMoveIntervals[user.id] = {
                    interval: moveInterval,
                    startTime: Date.now(),
                    speed: speed,
                    duration: duration
                };

                // Set timeout if not "no_stop"
                if (duration !== 'no_stop') {
                    const durationMs = parseDuration(duration);
                    
                    const stopTimeout = setTimeout(async () => {
                        clearInterval(moveInterval);
                        delete rapidMoveIntervals[user.id];
                        
                        // Unmute user when done
                        try {
                            const finalMember = await interaction.guild.members.fetch(user.id);
                            await finalMember.voice.setMute(false, 'Rapid movement duration ended');
                        } catch (error) {
                            console.log('Could not unmute user after duration ended');
                        }
                    }, durationMs);

                    rapidMoveIntervals[user.id].timeout = stopTimeout;
                }

                // Log the action
                addModerationLog('rapid-move-start', interaction.user, user, `Speed: ${speed}, Duration: ${duration}`);

                const embed = new EmbedBuilder()
                    .setTitle('🌀 Rapid Movement Started')
                    .setDescription(`Started rapid movement for **${user.tag}**`)
                    .addFields(
                        { name: '⚡ Speed', value: speed.replace('_', ' '), inline: true },
                        { name: '⏰ Duration', value: duration === 'no_stop' ? 'Until manually stopped' : duration, inline: true },
                        { name: '🔇 Status', value: 'User muted during movement', inline: true },
                        { name: '🎯 Channels', value: `Moving between ${voiceChannels.length} voice channels`, inline: false }
                    )
                    .setColor(0xFF6600)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Move user command error:', error);
                await interaction.editReply(`❌ Failed to start rapid movement: ${error.message}`);
            }
            return;
        }

        if (interaction.commandName === 'move-user-stop') {
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');

            try {
                if (!rapidMoveIntervals[user.id]) {
                    return interaction.editReply('❌ This user is not currently being moved!');
                }

                // Stop the movement
                clearInterval(rapidMoveIntervals[user.id].interval);
                if (rapidMoveIntervals[user.id].timeout) {
                    clearTimeout(rapidMoveIntervals[user.id].timeout);
                }

                const moveData = rapidMoveIntervals[user.id];
                const runTime = Math.floor((Date.now() - moveData.startTime) / 1000);

                // Clean up tracking
                delete rapidMoveIntervals[user.id];

                // Unmute user
                try {
                    const member = await interaction.guild.members.fetch(user.id);
                    await member.voice.setMute(false, `Rapid movement stopped by ${interaction.user.tag}`);
                } catch (error) {
                    console.log('Could not unmute user after stopping movement');
                }

                // Log the action
                addModerationLog('rapid-move-stop', interaction.user, user, `Manually stopped after ${runTime} seconds`);

                const embed = new EmbedBuilder()
                    .setTitle('⏹️ Rapid Movement Stopped')
                    .setDescription(`Stopped rapid movement for **${user.tag}**`)
                    .addFields(
                        { name: '⏰ Runtime', value: `${runTime} seconds`, inline: true },
                        { name: '⚡ Speed', value: moveData.speed.replace('_', ' '), inline: true },
                        { name: '🔊 Status', value: 'User unmuted', inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Move user stop command error:', error);
                await interaction.editReply(`❌ Failed to stop rapid movement: ${error.message}`);
            }
            return;
        }

        // NICKNAME MANAGEMENT
        if (interaction.commandName === 'set-nick') {
            await interaction.deferReply({ ephemeral: true });

            const prefix = interaction.options.getString('prefix');

            try {
                let changedCount = 0;
                const members = await interaction.guild.members.fetch();

                for (const [id, member] of members) {
                    if (member.user.bot) continue; // Skip bots
                    if (member.id === interaction.guild.ownerId) continue; // Skip server owner

                    try {
                        const newNickname = `${prefix} ${member.user.username.toLowerCase()}`;
                        await member.setNickname(newNickname, `Mass nickname change by ${interaction.user.tag}`);
                        changedCount++;
                    } catch (error) {
                        console.error(`Failed to change nickname for ${member.displayName}:`, error);
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('📝 Mass Nickname Change')
                    .setDescription(`Successfully changed **${changedCount}** nicknames`)
                    .addFields(
                        { name: 'Prefix Used', value: prefix, inline: true },
                        { name: 'Format', value: `${prefix} [lowercase username]`, inline: true }
                    )
                    .setColor(0x00AAFF)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Set nick command error:', error);
                await interaction.editReply(`❌ Failed to change nicknames: ${error.message}`);
            }
            return;
        }
    }
});

client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Skip if not in a guild
    if (!message.guild) return;

    // Check for blacklisted content first (before adding XP)
    const blacklistCheck = checkBlacklistedContent(message.content, message.author.id, message.guild);
    
    if (blacklistCheck.isBlacklisted) {
        try {
            // Create compact warning embed that persists
            const warningEmbed = new EmbedBuilder()
                .setTitle('🚫 Server Rules Violation')
                .setColor(0xFF4444)
                .setDescription(`${message.author} Your message violates server guidelines!`)
                .addFields(
                    { name: '⚠️ Violation Type', value: blacklistCheck.category, inline: true },
                    { name: '🔒 Permission Level', value: 'Owner/Server Owner Only', inline: true },
                    { name: '📝 Rule Broken', value: blacklistCheck.reason, inline: false },
                    { name: '✅ What\'s Allowed', value: 'Normal conversations, questions, discussions\n❌ No promotions, match requests, or game content unless you\'re the owner', inline: false }
                )
                .setFooter({ text: '🤖 This warning stays until manually deleted by owner/admin' })
                .setTimestamp();
            
            // Send persistent warning that tags the user
            try {
                const permissions = message.channel.permissionsFor(message.guild.members.me);
                if (permissions && permissions.has(['SendMessages', 'EmbedLinks'])) {
                    const warningMessage = await message.channel.send({ 
                        content: `${message.author}`,
                        embeds: [warningEmbed] 
                    });
                    
                    // Track this warning message for auto-deletion
                    violationWarnings[message.id] = warningMessage.id;
                    
                    console.log(`⚠️ Sent persistent warning for blacklisted content from ${message.author.tag} in ${message.guild.name}#${message.channel.name}`);
                    console.log(`📂 Category: ${blacklistCheck.category} | Content: "${message.content.substring(0, 50)}..."`);
                }
            } catch (sendError) {
                console.log(`Could not send warning in ${message.channel.name}:`, sendError.message);
            }
            
            // Try to send DM notification to the user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Server Rules Violation')
                    .setColor(0xFF6B00)
                    .setDescription(`Your message in **${message.guild.name}** violates server guidelines.`)
                    .addFields(
                        { name: '📂 Violation Type', value: blacklistCheck.category, inline: true },
                        { name: '📍 Channel', value: `#${message.channel.name}`, inline: true },
                        { name: '🚫 Specific Reason', value: blacklistCheck.reason, inline: false },
                        { name: '💬 Your Message', value: message.content.length > 150 ? message.content.substring(0, 150) + '...' : message.content, inline: false },
                        { name: '🚫 What\'s Not Allowed', value: '• Discord server promotions\n• Social media/content promotion\n• Game match requests\n• Custom game invites\n• Instagram/YouTube advertising\n• Any promotional content', inline: false },
                        { name: '✅ What\'s Allowed', value: '• Normal conversations\n• Questions and answers\n• General discussions\n• Help and support', inline: false },
                        { name: '👑 Special Permissions', value: 'Only **Server Owner** and **Bot Owner** can promote content', inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: '🤖 Automatic content moderation - Keep discussions normal!' });
                
                await message.author.send({ embeds: [dmEmbed] });
                console.log(`📨 Sent comprehensive DM notification to ${message.author.tag}`);
            } catch (dmError) {
                console.log(`Could not send DM to ${message.author.tag}:`, dmError.message);
            }
            
            return; // Exit early, don't process further or add XP
            
        } catch (error) {
            console.error(`❌ Error processing blacklisted message from ${message.author.tag}:`, error);
        }
    }

    // Add XP for message (with cooldown to prevent spam) - only for non-blacklisted messages
    const leveledUp = await addMessageXP(message.author.id, message.guild);

    // Send random cute GIF with message (10% chance for normal messages, 100% for level ups)
    const shouldSendGif = leveledUp || Math.random() < 0.1;
    
    if (shouldSendGif) {
        try {
            const randomGif = getRandomCuteGif();
            
            // Send level up message if user leveled up
            if (leveledUp) {
                await message.channel.send('🎉 **Level Up Celebration!** 🎉');
            }
            
            // Send GIF directly without embed
            await message.channel.send(randomGif);
            console.log(`✨ Sent cute GIF to ${message.guild.name}#${message.channel.name} ${leveledUp ? '(Level Up!)' : '(Random)'}`);
        } catch (error) {
            console.error('Error sending cute GIF:', error);
        }
    }

    // Check if someone mentioned the owner and owner is AFK
    if (afkData.isAFK && message.mentions.users.has(BOT_OWNER_ID) && message.author.id !== BOT_OWNER_ID) {
        const timeSince = Math.floor((Date.now() - afkData.timestamp) / 1000);
        const timeString = formatTime(timeSince);
        
        const afkEmbed = new EmbedBuilder()
            .setDescription(`💤 **<@${BOT_OWNER_ID}>** is AFK • ${timeString}\n📝 ${afkData.message || 'No message left'}`)
            .setColor(0xFFD700);
        
        const afkReply = await message.reply({ embeds: [afkEmbed] });
        
        // Auto-delete after 10 seconds
        setTimeout(async () => {
            try {
                await afkReply.delete();
            } catch (error) {
                console.log('Could not delete AFK message:', error.message);
            }
        }, 10000);
        
        return;
    }

    // Check if owner sent a message while AFK (auto-remove AFK)
    if (afkData.isAFK && message.author.id === BOT_OWNER_ID && !message.content.toLowerCase().startsWith('afk ')) {
        const timeSince = Math.floor((Date.now() - afkData.timestamp) / 1000);
        const timeString = formatTime(timeSince);
        
        // Remove AFK status
        afkData.isAFK = false;
        afkData.message = '';
        afkData.timestamp = null;
        
        const welcomeBackEmbed = new EmbedBuilder()
            .setDescription(`👋 **${message.author.displayName}** is back • Away for ${timeString}`)
            .setColor(0x00FF00);
        
        const welcomeReply = await message.reply({ embeds: [welcomeBackEmbed] });
        
        // Auto-delete after 10 seconds
        setTimeout(async () => {
            try {
                await welcomeReply.delete();
            } catch (error) {
                console.log('Could not delete welcome back message:', error.message);
            }
        }, 10000);
        
        return;
    }

    // Check for AFK command (owner only)
    if (message.content.toLowerCase().startsWith('afk ')) {
        if (message.author.id !== BOT_OWNER_ID) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Access Denied')
                .setDescription('Only **script** can use the AFK command. I am assisting only for script.')
                .setColor(0xFF0000);
            
            return message.reply({ embeds: [errorEmbed] });
        }

        // Extract AFK message
        const afkMessage = message.content.slice(4).trim(); // Remove 'afk ' prefix

        if (!afkMessage) {
            return message.reply('❌ Please provide an AFK message! Example: `afk I\'m sleeping`');
        }

        // Set AFK status
        afkData.isAFK = true;
        afkData.message = afkMessage;
        afkData.timestamp = Date.now();

        const afkSetEmbed = new EmbedBuilder()
            .setDescription(`💤 **${message.author.displayName}** is now AFK\n📝 ${afkMessage}`)
            .setColor(0xFFD700);

        const afkSetReply = await message.reply({ embeds: [afkSetEmbed] });
        
        // Auto-delete after 10 seconds
        setTimeout(async () => {
            try {
                await afkSetReply.delete();
            } catch (error) {
                console.log('Could not delete AFK set message:', error.message);
            }
        }, 10000);
        
        return;
    }

    // Check for text commands (owner only)
    if (message.content.toLowerCase().startsWith('lvl ') || message.content.toLowerCase() === 'levels') {
        if (message.author.id !== BOT_OWNER_ID) {
            const restrictedEmbed = new EmbedBuilder()
                .setTitle('❌ Access Denied')
                .setDescription('Only **script** can use these commands. I am assisting only for script.')
                .setColor(0xFF0000);
            
            return message.reply({ embeds: [restrictedEmbed] });
        }

        if (message.content.toLowerCase() === 'levels') {
            // Show top 10 users by XP and level
            const sortedUsers = Object.entries(userData)
                .sort(([,a], [,b]) => b.totalXP - a.totalXP)
                .slice(0, 10);

            const leaderboard = sortedUsers.map(([userId, data], index) => {
                const member = message.guild.members.cache.get(userId);
                const name = member?.displayName || 'Unknown User';
                const nextLevelXP = getXPRequiredForLevel(data.level + 1);
                const currentLevelXP = getXPRequiredForLevel(data.level);
                const progress = data.totalXP - currentLevelXP;
                const needed = nextLevelXP - currentLevelXP;
                return `${index + 1}. **${name}** - Lv.${data.level} | ${data.totalXP.toLocaleString()} XP\n   └ Progress: ${progress}/${needed} XP to next level`;
            }).join('\n\n') || 'No users yet!';

            const embed = new EmbedBuilder()
                .setTitle('🏆 Server XP Leaderboard')
                .setDescription(leaderboard)
                .addFields(
                    { name: '💡 XP System', value: `**Messages:** Start at 125 XP, +25 XP every 10 messages\n**Voice:** 200 XP per minute`, inline: false }
                )
                .setColor(0x000000) // Pure black
                .setTimestamp();

            return message.reply({ 
                embeds: [embed]
            });
        }

        if (message.content.toLowerCase().startsWith('lvl ')) {
            const parts = message.content.split(' ');

            // Check if it's a level set command (lvl @user number)
            if (parts.length === 3) {
                const mentionMatch = parts[1].match(/<@!?(\d+)>/);
                const levelNumber = parseInt(parts[2]);

                if (!mentionMatch || isNaN(levelNumber) || levelNumber < 1) {
                    return message.reply('❌ Invalid command! Use: `lvl @user <level>` or `lvl @user` to check level');
                }

                const targetUserId = mentionMatch[1];
                const targetMember = message.guild.members.cache.get(targetUserId);

                if (!targetMember) {
                    return message.reply('❌ User not found in this server!');
                }

                // Initialize or update user data
                const user = initUser(targetUserId);
                const oldLevel = user.level;
                const oldXP = user.totalXP;

                // Set XP to the minimum required for the target level
                const requiredXP = getXPRequiredForLevel(levelNumber);
                user.totalXP = requiredXP;
                user.level = levelNumber;

                saveUserData();

                const embed = new EmbedBuilder()
                    .setDescription(`🔧 **${targetMember.displayName}** • ${oldLevel} ➜ **${levelNumber}** • +${(user.totalXP - oldXP).toLocaleString()} XP • By ${message.author.displayName}`)
                    .setColor(0x000000); // Pure black

                return message.reply({ 
                    embeds: [embed]
                });
            }

            // Regular level check (lvl @user)
            else if (parts.length === 2) {
                const mentionMatch = parts[1].match(/<@!?(\d+)>/);
                if (!mentionMatch) {
                    return message.reply('Please mention a user! Example: `lvl @user` or `lvl @user 1000`');
                }

                const targetUserId = mentionMatch[1];
                const targetMember = message.guild.members.cache.get(targetUserId);
                const user = userData[targetUserId] || { level: 1, totalXP: 0, totalMessages: 0, totalVoiceMinutes: 0 };

                const nextLevelXP = getXPRequiredForLevel(user.level + 1);
                const currentLevelXP = getXPRequiredForLevel(user.level);
                const progress = user.totalXP - currentLevelXP;
                const needed = nextLevelXP - currentLevelXP;
                const progressPercent = Math.floor((progress / needed) * 100);

                const embed = new EmbedBuilder()
                    .setDescription(`**${targetMember?.displayName || 'Unknown User'}** • Lv.${user.level} • ${user.totalXP.toLocaleString()} XP\n📈 ${progress}/${needed} (${progressPercent}%) • 💬 ${user.totalMessages}m • 🎤 ${user.totalVoiceMinutes}m`)
                    .setColor(0x000000); // Pure black

                return message.reply({ 
                    embeds: [embed]
                });
            }

            else {
                return message.reply('❌ Invalid command! Use:\n• `lvl @user` - Check user level\n• `lvl @user <number>` - Set user level (owner only)\n• `levels` - Show leaderboard');
            }
        }
    }

    // Extract URLs from the message for link verification
    const urls = message.content.match(urlPattern);

    if (urls && urls.length > 0) {
        console.log(`🔍 Found ${urls.length} URL(s) in message from ${message.author.tag}`);

        for (let url of urls) {
            try {
                // Clean up the URL (remove trailing punctuation)
                url = url.replace(/[.,;!?)\]}]+$/, '');

                // Validate URL format before processing
                try {
                    new URL(url);
                } catch (urlError) {
                    console.log(`Skipping invalid URL: ${url}`);
                    continue;
                }

                // Check URL safety
                const safetyResult = await checkUrlSafety(url);

                // Create and send safety embed
                const embed = createSafetyEmbed(url, safetyResult);

                // Send the safety report (permanent)
                const safetyMessage = await message.reply({ embeds: [embed] });

                // Log the result
                console.log(`🔍 URL Check: ${url} - ${safetyResult.safe ? 'SAFE' : 'UNSAFE'} (${safetyResult.category})`);

                // If unsafe, also send a warning in DM to the message author
                if (!safetyResult.safe) {
                    try {
                        await message.author.send({
                            content: `⚠️ **Warning!** You shared a potentially dangerous link in **${message.guild?.name || 'a server'}**`,
                            embeds: [embed]
                        });
                    } catch (dmError) {
                        console.log(`Could not send DM warning to ${message.author.tag}`);
                    }
                }

            } catch (error) {
                console.error(`Error checking URL ${url}:`, error);

                // Send error message
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Link Safety Check - Error')
                    .setColor(0xFF6B00)
                    .setDescription(`**Link:** ${url}\n**Status:** Could not verify link safety`)
                    .addFields({ name: 'Error', value: 'Unable to analyze this link. Please exercise caution.', inline: false })
                    .setTimestamp();

                const errorMessage = await message.reply({ embeds: [errorEmbed] });
            }
        }
    }
});

client.on('guildCreate', (guild) => {
    console.log(`✅ Joined new server: ${guild.name} (${guild.memberCount} members)`);
    console.log(`🔍 Now monitoring ${client.guilds.cache.size} servers total`);

    // Try to send a welcome message to the system channel
    if (guild.systemChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🔒 Advanced Moderation Bot Activated!')
            .setColor(0x000000) // Pure black for elegant welcome message
            .setDescription('I will now automatically:\n🔍 Monitor all links for safety\n📈 Track user XP and levels\n🗑️ Remove blacklisted content!')
            .addFields(
                { name: '✅ Safe Links', value: 'Will be marked as safe to click', inline: true },
                { name: '⚠️ Unsafe Links', value: 'Will be flagged with warnings', inline: true },
                { name: '🗑️ Auto-Delete', value: 'Match requests, self-promo, game spam', inline: true },
                { name: '🌟 XP System', value: 'Messages: 125+ XP (increases every 10 msgs)\nVoice: 200 XP per minute', inline: false },
                { name: '🤖 Content Moderation', value: 'Automatically removes:\n• Match/game requests\n• Self-promotional content\n• Game-related spam/scams\n\nNormal conversations are welcome!', inline: false }
            )
            .setFooter({ text: 'Your server is now protected!' })
            .setTimestamp();

        guild.systemChannel.send({ 
            embeds: [welcomeEmbed]
        }).catch(console.error);
    }
});

client.on('guildDelete', (guild) => {
    console.log(`❌ Left server: ${guild.name}`);
    console.log(`🔍 Now monitoring ${client.guilds.cache.size} servers total`);
});

// Handle message deletions - auto-remove violation warning embeds
client.on('messageDelete', async (deletedMessage) => {
    // Check if this deleted message had a violation warning
    if (violationWarnings[deletedMessage.id]) {
        const warningMessageId = violationWarnings[deletedMessage.id];
        
        try {
            // Try to delete the warning message
            const warningMessage = await deletedMessage.channel.messages.fetch(warningMessageId);
            if (warningMessage) {
                await warningMessage.delete();
                console.log(`🗑️ Auto-deleted violation warning for manually deleted message from ${deletedMessage.author?.tag || 'Unknown'}`);
            }
        } catch (error) {
            console.log(`Could not delete violation warning: ${error.message}`);
        }
        
        // Remove from tracking
        delete violationWarnings[deletedMessage.id];
    }
});

// Clean up rapid movement intervals and temp VCs on shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Bot shutting down, cleaning up rapid movements and temp VCs...');
    
    // Clean up rapid movements
    for (const [userId, moveData] of Object.entries(rapidMoveIntervals)) {
        try {
            clearInterval(moveData.interval);
            if (moveData.timeout) {
                clearTimeout(moveData.timeout);
            }
            
            // Try to unmute users
            for (const guild of client.guilds.cache.values()) {
                try {
                    const member = await guild.members.fetch(userId);
                    if (member.voice.channel) {
                        await member.voice.setMute(false, 'Bot shutdown cleanup');
                    }
                } catch (error) {
                    // Ignore errors during shutdown
                }
            }
        } catch (error) {
            // Ignore errors during shutdown
        }
    }
    
    // Clean up temp VC timeouts
    for (const [channelId, tempData] of Object.entries(tempVoiceChannels)) {
        try {
            if (tempData.timeout) {
                clearTimeout(tempData.timeout);
            }
        } catch (error) {
            // Ignore errors during shutdown
        }
    }
    
    saveUserData();
    saveModerationLogs();
    saveUserWarnings();
    
    process.exit(0);
});

// Save user data periodically
setInterval(() => {
    saveUserData();
    saveModerationLogs();
    saveUserWarnings();
}, 300000); // Save every 5 minutes

// Error handling
client.on('error', console.error);

// Login with bot token
client.login(process.env.DISCORD_BOT_TOKEN);