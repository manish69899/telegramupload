/**
 * Telegram MTProto Upload Service
 * * Direct file uploads to Telegram using MTProto protocol.
 * Supports files up to 1.5GB
 */

import { serve } from 'bun';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads'; // FIX: Ye import zaroori hai filenames ke liye
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Configuration
const PORT = 3002;
const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB
const SESSION_FILE = join(import.meta.dir, 'session.txt');

// Load .env file
function loadEnv() {
  const envPath = join(import.meta.dir, '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    console.log('[Service] ✅ Loaded .env file');
  }
}

// Load saved session
function loadSession(): string {
  if (existsSync(SESSION_FILE)) {
    const session = readFileSync(SESSION_FILE, 'utf-8').trim();
    if (session) {
      console.log('[Service] ✅ Loaded saved session');
      return session;
    }
  }
  return '';
}

// Save session locally
function saveSession(session: string) {
  writeFileSync(SESSION_FILE, session);
  console.log('[Service] ✅ Session saved to session.txt');
}

// Load env and session
loadEnv();
const savedSession = loadSession();

// Config
const config = {
  apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
  apiHash: process.env.TELEGRAM_API_HASH || '',
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  channelId: process.env.TELEGRAM_CHANNEL_ID || '',
  session: process.env.TELEGRAM_SESSION || savedSession,
};

// Debug
console.log('[Service] Config:', {
  apiId: config.apiId,
  apiHash: config.apiHash ? '✅' : '❌',
  botToken: config.botToken ? '✅' : '❌',
  channelId: config.channelId ? '✅' : '❌',
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Id',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Telegram client
let client: TelegramClient | null = null;
let isInitialized = false;

async function initializeClient(): Promise<boolean> {
  if (client && isInitialized) return true;

  try {
    console.log('[Service] Initializing Telegram client...');
    
    if (!config.apiId || !config.apiHash || !config.botToken || !config.channelId) {
      console.error('[Service] ❌ Missing configuration!');
      return false;
    }

    const session = new StringSession(config.session);
    
    client = new TelegramClient(session, config.apiId, config.apiHash, {
      connectionRetries: 5,
      timeout: 30000,
      autoReconnect: true,
    });

    console.log('[Service] Connecting to Telegram...');
    await client.start({ botAuthToken: config.botToken });

    // Save session for faster restart
    const sessionString = client.session.save() as unknown as string;
    if (sessionString) {
      const isNewSession = !existsSync(SESSION_FILE);
      saveSession(sessionString);

      // Naya feature: Naya session banne par channel me .txt bhejna
      if (isNewSession) {
        try {
          const sessionBuffer = Buffer.from(sessionString, 'utf-8');
          const sessionCustomFile = new CustomFile('session.txt', sessionBuffer.byteLength, '', sessionBuffer);
          await client.sendFile(config.channelId, {
            file: sessionCustomFile,
            caption: '🔐 Backup: Telegram String Session\nIs file ko secure rakhein!',
            forceDocument: true,
          });
          console.log('[Service] ✅ Session file backed up to Telegram Channel!');
        } catch (backupError) {
          console.error('[Service] ❌ Failed to backup session to channel:', backupError);
        }
      }
    }

    isInitialized = true;
    console.log('[Service] ✅ Telegram client ready!');
    return true;
  } catch (error) {
    console.error('[Service] ❌ Init error:', error);
    return false;
  }
}

// Handle upload
async function handleUpload(request: Request): Promise<Response> {
  const uploadId = request.headers.get('X-Upload-Id') || crypto.randomUUID();
  
  try {
    if (!client || !isInitialized) {
      return jsonResponse({ success: false, error: 'Service not ready', uploadId }, 503);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caption = formData.get('caption') as string || '';
    const fileName = formData.get('fileName') as string || file?.name || 'file';

    if (!file) {
      return jsonResponse({ success: false, error: 'No file provided', uploadId }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse({ success: false, error: 'File exceeds 1.5GB limit', uploadId }, 400);
    }

    console.log(`[Service] 📤 Uploading: ${fileName} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Convert to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const startTime = Date.now();

    // FIX: CustomFile use karna zaroori hai exact naam aur extension bhejne ke liye
    const fileToUpload = new CustomFile(fileName, fileBuffer.byteLength, '', fileBuffer);

    // Upload file
    await client.sendFile(config.channelId, {
      file: fileToUpload,
      caption: caption || undefined,
      forceDocument: true,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Service] ✅ Upload complete: ${fileName} in ${duration}s`);

    return jsonResponse({
      success: true,
      uploadId,
      fileName,
      fileSize: file.size,
      duration: parseFloat(duration),
    });

  } catch (error) {
    console.error('[Service] ❌ Upload error:', error);
    return jsonResponse({
      success: false,
      error: 'Upload failed. Please try again.',
      uploadId,
    }, 500);
  }
}

// Status check
async function checkStatus(): Promise<Response> {
  const initialized = await initializeClient();
  return jsonResponse({
    success: true,
    status: initialized ? 'ready' : 'initializing',
    hasConfig: !!(config.apiId && config.apiHash && config.botToken && config.channelId),
  });
}

// Request handler
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (url.pathname === '/health' || url.pathname === '/') {
    return checkStatus();
  }

  if (url.pathname === '/upload' && request.method === 'POST') {
    if (!isInitialized) await initializeClient();
    return handleUpload(request);
  }

  return jsonResponse({ success: false, error: 'Not found' }, 404);
}

// Start server
console.log(`[Service] 🚀 Starting on port ${PORT}...`);

initializeClient().then((success) => {
  if (success) {
    console.log('[Service] ✅ Ready to accept uploads!');
  } else {
    console.warn('[Service] ⚠️ Check your .env file');
  }
});

serve({ port: PORT, fetch: handleRequest });