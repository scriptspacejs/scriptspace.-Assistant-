
# Discord Security & Community Bot

A comprehensive Discord bot that provides link safety verification, XP leveling system, gaming content filtering, and cute GIF sharing to enhance your server's security and community engagement.

## 🌟 Features

### 🔐 Link Safety Verification
- **Automatic URL Scanning**: Monitors all messages for links and automatically checks their safety
- **Malicious Domain Detection**: Identifies known phishing, scam, and malware domains
- **Token Grabber Protection**: Specifically detects Discord webhook URLs and token-stealing attempts
- **Pattern Recognition**: Uses advanced regex patterns to identify suspicious content
- **Real-time Analysis**: Performs HTTP requests to analyze website headers and content
- **Safety Embeds**: Sends detailed safety reports with color-coded warnings
- **DM Warnings**: Privately alerts users who share dangerous links

### 📊 XP & Leveling System
- **Message XP**: Start with 125 XP per message, increases by 25 XP every 10 messages
- **Voice XP**: Earn 200 XP per minute spent in voice channels
- **Level Progression**: Exponential level requirements (1000 XP base, multiplied by 1.2^level)
- **Level Up Notifications**: Celebratory embeds with progress tracking
- **Leaderboard**: View top users with `levels` command
- **Individual Stats**: Check user progress with `lvl @user`
- **Admin Controls**: Bot owner can modify user levels with `lvl @user <level>`
- **Data Persistence**: All XP and level data saved to JSON file

### 🛡️ Gaming Content Filter
- **Smart Detection**: Identifies gaming-related messages and promotions
- **Context Analysis**: Recognizes patterns like "4v4", "custom match", "scrims & tournaments"
- **Promotion Blocking**: Filters Instagram account promotions and self-advertising
- **@everyone Protection**: Special handling for mass gaming invitations
- **Educational Responses**: Provides clear guidelines on acceptable content
- **Server Focus**: Keeps discussions centered on development and programming

### 🎀 Cute GIF System
- **Designated Channel**: Sends tiny, adorable GIFs in specific channel (ID: 1377703145941106738)
- **Curated Collection**: 30+ hand-picked small, cute animal GIFs
- **Special Level Up GIFs**: Celebration GIFs for level progression
- **Optimized Size**: Focus on tiny, lightweight GIFs for better performance
- **Random Selection**: Different cute GIF for every message

### ⚙️ Advanced Embed System
- **Slash Command Interface**: Modern `/embed` command with extensive options
- **Multiple Styles**: 7 different embed colors and themes
- **Rich Content Support**: Images, thumbnails, videos, custom authors
- **Auto-splitting**: Handles long messages by creating multiple embeds
- **Permission Validation**: Checks channel permissions before sending
- **URL Validation**: Verifies all provided URLs are valid and safe
- **Owner Restricted**: Only bot owner can create embeds

## 🚀 Setup Instructions

### 1. Prerequisites
- Node.js 20+ installed
- Discord Bot Token
- Discord Application with proper intents enabled

### 2. Installation
```bash
npm install discord.js axios dotenv node-cron url-parse
```

### 3. Environment Configuration
Create a `.env` file with:
```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
```

### 4. Discord Application Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Enable these Gateway Intents:
   - Guilds
   - Guild Messages
   - Message Content
   - Direct Messages
   - Guild Voice States

### 5. Bot Permissions
Ensure your bot has these permissions:
- Send Messages
- Embed Links
- View Channels
- Read Message History
- Use Slash Commands
- Connect (for voice tracking)

### 6. Configuration
Update these constants in `index.js`:
```javascript
const LEVEL_UP_CHANNEL = 'your_level_up_channel_id';
const BOT_OWNER_ID = 'your_discord_user_id';
const CUTE_GIF_CHANNEL = 'your_gif_channel_id';
```

## 📝 Commands

### Slash Commands
- `/embed` - Create and send custom embeds (Owner only)
  - `message`: Embed content (required)
  - `channel`: Target channel (optional)
  - `style`: Embed style/color (optional)
  - `image`: Image URL (optional)
  - `thumbnail`: Thumbnail URL (optional)
  - `video`: Video URL (optional)
  - `author_name`: Author name (optional)
  - `author_icon`: Author icon URL (optional)
  - `emojis`: Add cute emojis (optional)

### Text Commands (Owner Only)
- `levels` - Display XP leaderboard
- `lvl @user` - Check user's level and stats
- `lvl @user <number>` - Set user's level

## 🔧 Technical Details

### XP Calculation
```javascript
// Message XP: Base 125 XP + (25 XP × (messageCount ÷ 10))
// Voice XP: 200 XP per minute
// Level Requirements: 1000 × (1.2 ^ (level - 2))
```

### Security Features
- **Malicious Domain Database**: 50+ known dangerous domains
- **Pattern Recognition**: 20+ suspicious URL patterns
- **File Extension Checking**: Blocks dangerous executable files
- **URL Shortener Detection**: Flags potentially hidden malicious links
- **Response Header Analysis**: Examines server responses for threats
- **Timeout Protection**: Handles unresponsive/suspicious websites

### Data Storage
- **User Data**: Stored in `userdata.json`
- **Auto-saving**: Data saved every 5 minutes
- **Backup System**: Persistent storage prevents data loss
- **Voice Tracking**: Real-time voice channel monitoring

## 🎨 Customization

### Adding New GIFs
Update the `cuteGifs` array with new tiny, cute GIF URLs:
```javascript
const cuteGifs = [
    'https://media.giphy.com/media/your_gif_id/giphy.gif',
    // Add more...
];
```

### Embed Styles
Modify embed colors and styles in the interaction handler:
```javascript
case 'custom':
    color = 0xYOURCOLOR;
    title = '🎨 Custom Style';
    break;
```

### Security Patterns
Add new malicious patterns to detect:
```javascript
const suspiciousPatterns = [
    /your_custom_pattern/i,
    // Add more patterns...
];
```

## 🛠️ Deployment on Replit

This bot is optimized for Replit deployment:

1. **Import Project**: Fork or import this repository to Replit
2. **Environment Variables**: Use Replit's Secrets tab to set `DISCORD_BOT_TOKEN`
3. **Auto-start**: The bot will automatically install dependencies
4. **Always On**: Enable "Always On" for 24/7 operation
5. **Monitoring**: Check console logs for real-time activity

### Replit-Specific Features
- **Nix Environment**: Uses Node.js 20 with optimal performance
- **Workflow Integration**: Configured run button for easy deployment
- **File Persistence**: Data automatically saved to Replit's filesystem
- **Error Handling**: Comprehensive error logging for debugging

## 📊 Statistics & Monitoring

The bot logs various activities:
- URL safety checks with results
- XP gains and level progressions
- Gaming content detections
- Command usage and errors
- Voice channel activity

## 🔒 Security & Privacy

- **No Token Storage**: Bot tokens stored securely in environment variables
- **Local Data Only**: All user data kept within your server
- **Permission Controlled**: Commands restricted to appropriate users
- **Safe Link Checking**: External API calls only for URL verification
- **Private Warnings**: Malicious link alerts sent via DM

## 🐛 Troubleshooting

### Common Issues
1. **Token Invalid**: Ensure `DISCORD_BOT_TOKEN` is correctly set in Secrets
2. **Missing Permissions**: Verify bot has required permissions in target channels
3. **Command Not Working**: Check if user has appropriate permissions
4. **XP Not Saving**: Ensure write permissions for `userdata.json`
5. **GIFs Not Sending**: Verify channel ID is correct and bot has embed permissions

### Debug Mode
Enable detailed logging by setting:
```javascript
console.log('Debug mode enabled');
```

## 📄 License

This project is open source. Feel free to modify and distribute according to your needs.

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For support or questions:
- Check the console logs for error details
- Verify all permissions and configuration
- Ensure Discord API limits aren't exceeded
- Test commands in a development server first

---

**Made with ❤️ by script - Keeping Discord servers safe and cute!**
