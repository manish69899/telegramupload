# FileDrop Setup & Deployment Guide

## 📋 Prerequisites

- Node.js 18+ ya Bun installed
- Telegram Account
- Git installed

---

## 🔑 Step 1: Telegram Credentials Setup

### 1.1 Get API ID & API Hash

1. Open browser and go to: **https://my.telegram.org/apps**
2. Login with your Telegram phone number
3. Click **"Create new application"**
4. Fill details:
   - App title: `FileDrop`
   - Short name: `filedrop`
   - Platform: `Desktop`
5. Copy and save:
   ```
   API_ID: 12345678 (numbers only)
   API_HASH: abcdef1234567890abcdef... (32 characters)
   ```

### 1.2 Create Telegram Bot

1. Open Telegram app
2. Search **@BotFather** and open chat
3. Send command: `/newbot`
4. Enter bot name: `FileDrop Bot`
5. Enter bot username: `filedrop_yourname_bot`
6. Copy the **BOT_TOKEN**:
   ```
   BOT_TOKEN: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-123456
   ```

### 1.3 Create Telegram Channel

1. Open Telegram app
2. Create a **New Channel** (Private recommended)
3. Name it: `FileDrop Storage`
4. Go to Channel → Subscribers → Add Subscriber
5. Search your bot username and add it as **Administrator**
6. Give bot permission to **Post Messages**

### 1.4 Get Channel ID

**Method 1: Using @userinfobot**
1. Open Telegram, search **@userinfobot**
2. Forward any message from your channel to this bot
3. It will reply with Channel ID like: `-1001234567890`

**Method 2: Using Web Telegram**
1. Open https://web.telegram.org
2. Open your channel
3. Check URL: `https://web.telegram.org/#/im?p=c1234567890_...`
4. Add `-100` prefix: Channel ID = `-1001234567890`

---

## 💻 Step 2: Local Setup

### 2.1 Extract Project

```bash
# Extract the zip file
unzip FileDrop-Telegram-Upload.zip -d FileDrop

# Go to project folder
cd FileDrop
```

### 2.2 Configure Environment

Open `.env.local` file and add your credentials:

```env
# ==========================================
# TELEGRAM CREDENTIALS
# ==========================================

# From my.telegram.org/apps
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890

# From @BotFather
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Channel ID with -100 prefix
TELEGRAM_CHANNEL_ID=-1001234567890

# Leave empty (auto-generated on first run)
TELEGRAM_SESSION=
```

### 2.3 Install Dependencies

```bash
# Using Bun (recommended)
bun install

# OR using npm
npm install
```

### 2.4 Install Mini-Service Dependencies

```bash
cd mini-services/telegram-upload
bun install
cd ../..
```

---

## 🚀 Step 3: Run Locally

You need **TWO terminals** to run the project:

### Terminal 1: Start Mini-Service

```bash
cd mini-services/telegram-upload
bun run dev
```

**Expected output:**
```
[Service] Starting Telegram Upload Service on port 3002...
[Service] Initializing Telegram client...
[Service] Telegram client initialized successfully
[Service] Ready to accept uploads!
```

### Terminal 2: Start Next.js App

```bash
bun run dev
```

**Expected output:**
```
▲ Next.js 16.1.3
- Local:   http://localhost:3000
✓ Ready in 916ms
```

### 3.1 Test in Browser

1. Open: **http://localhost:3000**
2. You should see the FileDrop interface
3. Drag & drop a small test file
4. Fill optional details
5. Click **Upload**
6. Check your Telegram channel for the file

---

## 🌐 Step 4: Vercel Deployment

Since Vercel cannot run the mini-service, you need a **hybrid deployment**:

### Option A: Vercel + VPS (Recommended)

#### 4.1 Deploy Mini-Service on VPS

**Requirements:**
- A VPS (DigitalOcean, Linode, Hetzner, etc.)
- Ubuntu/Debian server

**Steps on VPS:**

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Upload project to VPS
scp -r FileDrop user@your-vps-ip:/home/user/

# SSH into VPS
ssh user@your-vps-ip

# Go to mini-service folder
cd /home/user/FileDrop/mini-services/telegram-upload

# Install dependencies
bun install

# Create .env file with your credentials
nano .env
```

Add in `.env`:
```env
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHANNEL_ID=-1001234567890
```

**Run with PM2 (keeps running always):**
```bash
# Install PM2
npm install -g pm2

# Start service
pm2 start "bun run dev" --name filedrop-service

# Save PM2 config
pm2 save
pm2 startup
```

Your mini-service will be available at: `http://your-vps-ip:3002`

#### 4.2 Update Frontend for VPS

Edit `src/hooks/use-file-upload.ts`:

```typescript
// Change this line:
const UPLOAD_SERVICE_PORT = 3002;

// To:
const UPLOAD_SERVICE_URL = 'https://your-vps-domain.com';
```

Update the fetch calls:
```typescript
// Change:
fetch(`/?XTransformPort=${UPLOAD_SERVICE_PORT}`)

// To:
fetch(`${UPLOAD_SERVICE_URL}/`)
```

#### 4.3 Deploy Frontend on Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

**Or use GitHub:**
1. Push code to GitHub
2. Go to https://vercel.com
3. Import repository
4. Add environment variables:
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHANNEL_ID`
5. Deploy

---

### Option B: All-in-One VPS Deployment

If you want everything on one server:

#### 4.4 Setup on VPS

```bash
# Install dependencies
sudo apt update
sudo apt install nginx

# Clone/upload project to /var/www/filedrop
sudo mkdir -p /var/www/filedrop
sudo chown -R $USER:$USER /var/www/filedrop
```

#### 4.5 Configure Nginx

Create `/etc/nginx/sites-available/filedrop`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Mini-Service API
    location ~ ^/(upload|status|health)$ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # For large file uploads
        client_max_body_size 2000M;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/filedrop /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### 4.6 Start Services with PM2

```bash
cd /var/www/filedrop

# Start Next.js
pm2 start "bun run dev" --name filedrop-frontend

# Start Mini-Service
cd mini-services/telegram-upload
pm2 start "bun run dev" --name filedrop-service

# Save
pm2 save
pm2 startup
```

#### 4.7 Setup SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## ✅ Step 5: Verify Deployment

### 5.1 Check Mini-Service

```bash
curl https://your-vps-domain.com/health
```

Expected response:
```json
{"success":true,"status":"ready","hasConfig":true}
```

### 5.2 Test Upload

1. Open your Vercel URL or domain
2. Upload a test file
3. Check Telegram channel for file
4. Verify caption has all details

---

## 🔧 Troubleshooting

### Problem: "Service not configured"

**Solution:** Check `.env.local` has all values correctly set

### Problem: "Bot is not admin in channel"

**Solution:** 
1. Open Telegram
2. Go to Channel → Subscribers
3. Find your bot and make it Admin
4. Enable "Post Messages" permission

### Problem: Upload stuck at 0%

**Solution:**
1. Check mini-service is running: `curl http://localhost:3002/`
2. Check console for errors
3. Restart mini-service

### Problem: "Session expired"

**Solution:** Restart mini-service, it will create new session

### Problem: File not appearing in Telegram

**Solution:**
1. Check channel ID format: `-100` prefix required
2. Verify bot is admin
3. Check mini-service logs

---

## 📊 Project URLs Summary

| Component | Local URL | Production URL |
|-----------|-----------|----------------|
| Frontend | http://localhost:3000 | https://yourapp.vercel.app |
| Mini-Service | http://localhost:3002 | https://api.yourdomain.com |
| Health Check | http://localhost:3002/health | https://api.yourdomain.com/health |

---

## 🎉 Done!

Your FileDrop is now live! Users can upload files up to 1.5GB directly to your Telegram channel.

**Need help?** Check README.md for more details.
