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
                .setTitle(`🎉 Level ${newLevel} Unlocked!`)
                .setDescription(`🌟 **${member?.displayName || 'Someone'}** • ${oldLevel} ➜ **${newLevel}** • +${xpGained} XP`)
                .addFields(
                    { name: '📊 Stats', value: `${user.totalXP.toLocaleString()} XP • ${user.totalMessages} msgs • ${user.totalVoiceMinutes}m voice`, inline: true },
                    { name: '📈 Progress', value: `${progressXP}/${neededXP} XP (${Math.floor((progressXP/neededXP)*100)}%)`, inline: true }
                )
                .setColor(0xFFD700) // Gold color for level ups
                .setThumbnail(member?.displayAvatarURL() || null)
                .setTimestamp();

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
        if (interaction.commandName === 'embed') {
            // Only bot owner can use embed commands
            if (interaction.user.id !== BOT_OWNER_ID) {
                return interaction.reply({ content: `❌ <@${interaction.user.id}> can't use it only script can use it`, ephemeral: true });
            }

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
    await addMessageXP(message.author.id, message.guild);

    // Send a random cute GIF with every message (100% probability)
    try {
        const randomGif = getRandomCuteGif();
        
        // Send the GIF directly without embed
        await message.channel.send(randomGif);
        
        console.log(`💖 Sent random cute GIF to ${message.guild.name}#${message.channel.name} for ${message.author.tag}`);
    } catch (error) {
        console.error('❌ Error sending random cute GIF:', error);
    }

    // Check for text commands (owner only)
    if (message.content.toLowerCase().startsWith('lvl ') || message.content.toLowerCase() === 'levels') {
        if (message.author.id !== BOT_OWNER_ID) {
            return; // Only bot owner can use these commands
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
                    .setTitle(`🔧 Level Modified • ${targetMember.displayName}`)
                    .setDescription(`${oldLevel} ➜ **${levelNumber}** • ${oldXP.toLocaleString()} ➜ ${user.totalXP.toLocaleString()} XP (+${(user.totalXP - oldXP).toLocaleString()})`)
                    .addFields(
                        { name: '🔨 Applied by', value: `${message.author.displayName}`, inline: true }
                    )
                    .setColor(0x000000) // Pure black
                    .setThumbnail(targetMember.displayAvatarURL())
                    .setTimestamp();

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
                    .setTitle(`📊 ${targetMember?.displayName || 'Unknown User'} • Level ${user.level}`)
                    .setDescription(`⚡ ${user.totalXP.toLocaleString()} XP • ${progressPercent}% to next level`)
                    .addFields(
                        { name: '📈 Progress', value: `${progress}/${needed} XP (${needed - progress} needed)`, inline: true },
                        { name: '💬 Activity', value: `${user.totalMessages} msgs • ${user.totalVoiceMinutes}m voice`, inline: true }
                    )
                    .setColor(0x000000) // Pure black
                    .setTimestamp();

                if (targetMember) {
                    embed.setThumbnail(targetMember.displayAvatarURL());
                }

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

// Save user data periodically
setInterval(saveUserData, 300000); // Save every 5 minutes

// Error handling
client.on('error', console.error);

// Login with bot token
client.login(process.env.DISCORD_BOT_TOKEN);