# FileDrop - Telegram Direct Upload

A modern file upload application that uses Telegram MTProto for unlimited, free cloud storage. Upload files directly from browser to Telegram with up to 1.5GB per file.

## Features

- 🚀 **Direct Upload** - Files stream directly from browser to Telegram
- 📦 **Large Files** - Support for files up to 1.5GB
- 🔒 **Secure** - End-to-end encrypted transfer via MTProto
- 🌓 **Dark/Light Mode** - Automatic theme based on system preference
- 📱 **Responsive** - Works on all devices
- ⚡ **Real-time Progress** - Upload progress with speed and ETA
- 🔄 **Queue System** - Multiple file uploads with concurrency control

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Browser   │────▶│  Next.js Frontend │     │   Vercel    │
│  (Uploader) │     │   (Static UI)     │────▶│   Deploy    │
└─────────────┘     └──────────────────┘     └─────────────┘
       │                                            
       │ HTTP (Port 3002)                          
       ▼                                            
┌──────────────────┐     ┌─────────────┐          
│ Upload Service   │────▶│  Telegram   │          
│  (MTProto/Bun)   │     │   Channel   │          
└──────────────────┘     └─────────────┘          
```

**Why this architecture?**
- Vercel serverless functions have 60s timeout (unsuitable for large files)
- MTProto client runs in a separate mini-service for unlimited upload time
- Frontend streams files to mini-service, which handles Telegram upload
- Zero cost - uses Telegram as free cloud storage

## Quick Start

### 1. Get Telegram Credentials

1. Go to [my.telegram.org/apps](https://my.telegram.org/apps)
2. Create a new application
3. Note down your `API_ID` and `API_HASH`

### 2. Create a Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create a new bot with `/newbot`
3. Note down the `BOT_TOKEN`

### 3. Create a Channel

1. Create a new Telegram channel (private or public)
2. Add your bot as an administrator
3. Get the channel ID (format: `-1001234567890`)
   - Use [@userinfobot](https://t.me/userinfobot) to get channel ID

### 4. Configure Environment

Copy `.env.example` to `.env.local` and fill in your credentials:

```env
# Telegram API Credentials (from my.telegram.org)
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef

# Bot Token (from @BotFather)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Channel ID (with -100 prefix)
TELEGRAM_CHANNEL_ID=-1001234567890

# Session (auto-generated, leave empty initially)
TELEGRAM_SESSION=
```

### 5. Run Locally

```bash
# Install dependencies
bun install

# Start the upload service (in one terminal)
cd mini-services/telegram-upload && bun run dev

# Start the Next.js app (in another terminal)
bun run dev
```

The app will be available at `http://localhost:3000`

## Deployment

### Vercel + VPS/Railway

Since Vercel can't run the mini-service, you need to deploy it separately:

1. **Deploy Frontend to Vercel:**
   ```bash
   vercel --prod
   ```
   Add environment variables in Vercel dashboard

2. **Deploy Mini-Service:**
   - Use a VPS, Railway, or any Node.js hosting
   - Update the `UPLOAD_SERVICE_PORT` and URL in the frontend

### Alternative: All-in-One VPS

Deploy everything on a VPS with a reverse proxy:

```bash
# Start both services
bun run dev           # Next.js on port 3000
cd mini-services/telegram-upload && bun run dev  # Service on port 3002
```

Use Nginx/Caddy to route:
- `/` → localhost:3000
- `/upload`, `/status`, `/health` → localhost:3002

## Project Structure

```
├── src/
│   ├── app/
│   │   └── page.tsx          # Main upload page
│   ├── components/
│   │   └── upload/           # Upload components
│   │       ├── file-drop-zone.tsx
│   │       ├── file-list.tsx
│   │       ├── upload-form.tsx
│   │       └── upload-actions.tsx
│   ├── hooks/
│   │   └── use-file-upload.ts
│   ├── lib/
│   │   └── telegram/
│   │       └── config.ts     # Telegram utilities
│   └── types/
│       └── upload.ts         # TypeScript types
├── mini-services/
│   └── telegram-upload/      # MTProto upload service
│       ├── index.ts
│       └── package.json
├── .env.example              # Environment template
└── .env.local                # Your credentials (git-ignored)
```

## API Endpoints

### Mini-Service (Port 3002)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service status |
| `/health` | GET | Health check |
| `/upload` | POST | Upload file |
| `/status?uploadId=xxx` | GET | Get upload progress |

## Limitations

- Maximum file size: 1.5 GB (Telegram MTProto limit)
- Requires the mini-service to be running
- Bot must be admin in the target channel
- Session may expire and need re-initialization

## Troubleshooting

**"Service not configured" error:**
- Check your `.env.local` file has all required values
- Restart the mini-service after updating environment

**Upload fails:**
- Verify bot is admin in the channel
- Check channel ID format (should start with `-100`)
- Check Telegram API credentials are correct

**Slow uploads:**
- Upload speed depends on your internet connection
- Telegram servers are fast, but large files take time

## License

MIT
