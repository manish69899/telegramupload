/**
 * Telegram MTProto Upload Service - Improved Version
 * 
 * Features:
 * - Direct file uploads to Telegram using MTProto protocol
 * - Supports files up to 1.5GB
 * - Link sharing support
 * - Better error handling
 * - Rate limiting
 * - Proper logging
 */

import { serve } from 'bun';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// ============================================
// Configuration
// ============================================
const PORT = process.env.PORT || 3002;
const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB
const DATA_DIR = join(import.meta.dir, 'data');
const SESSION_FILE = join(DATA_DIR, 'session.txt');
const LOGS_DIR = join(DATA_DIR, 'logs');

// Rate limiting
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window
const uploadRequests = new Map<string, number[]>();

// ============================================
// Utility Functions
// ============================================

// Ensure directories exist
function ensureDirectories() {
  [DATA_DIR, LOGS_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

// Logging with timestamp
function log(level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}`;
  
  console.log(logLine);
  
  // Also write to log file
  const logFile = join(LOGS_DIR, `service-${new Date().toISOString().split('T')[0]}.log`);
  try {
    const existing = existsSync(logFile) ? readFileSync(logFile, 'utf-8') : '';
    writeFileSync(logFile, existing + logLine + '\n');
  } catch {
    // Ignore log file errors
  }
}

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
    log('INFO', '✅ Loaded .env file');
  }
}

// Load saved session
function loadSession(): string {
  if (existsSync(SESSION_FILE)) {
    const session = readFileSync(SESSION_FILE, 'utf-8').trim();
    if (session) {
      log('INFO', '✅ Loaded saved session');
      return session;
    }
  }
  return '';
}

// Save session locally
function saveSession(session: string) {
  writeFileSync(SESSION_FILE, session);
  log('INFO', '✅ Session saved');
}

// Rate limit check
function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const requests = uploadRequests.get(clientId) || [];
  
  // Filter old requests
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT_MAX) {
    return false; // Rate limited
  }
  
  recentRequests.push(now);
  uploadRequests.set(clientId, recentRequests);
  return true;
}

// Clean old rate limit entries
setInterval(() => {
  const now = Date.now();
  uploadRequests.forEach((requests, clientId) => {
    const recent = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
    if (recent.length === 0) {
      uploadRequests.delete(clientId);
    } else {
      uploadRequests.set(clientId, recent);
    }
  });
}, 60000);

// ============================================
// Initialize
// ============================================
ensureDirectories();
loadEnv();
const savedSession = loadSession();

const config = {
  apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
  apiHash: process.env.TELEGRAM_API_HASH || '',
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  channelId: process.env.TELEGRAM_CHANNEL_ID || '',
  session: process.env.TELEGRAM_SESSION || savedSession,
};

log('INFO', 'Config loaded', {
  apiId: config.apiId ? '✅' : '❌',
  apiHash: config.apiHash ? '✅' : '❌',
  botToken: config.botToken ? '✅' : '❌',
  channelId: config.channelId ? '✅' : '❌',
});

// ============================================
// HTTP Helpers
// ============================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Id, X-Client-Id',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function errorResponse(error: string, status = 500, details?: unknown): Response {
  log('ERROR', error, details);
  return jsonResponse({ success: false, error }, status);
}

// ============================================
// Telegram Client
// ============================================
let client: TelegramClient | null = null;
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

async function initializeClient(): Promise<boolean> {
  // If already initializing, wait for it
  if (initPromise) {
    return initPromise;
  }
  
  if (client && isInitialized) return true;

  initPromise = (async () => {
    try {
      log('INFO', '🚀 Initializing Telegram client...');
      
      if (!config.apiId || !config.apiHash || !config.botToken || !config.channelId) {
        log('ERROR', '❌ Missing configuration');
        return false;
      }

      const session = new StringSession(config.session);
      
      client = new TelegramClient(session, config.apiId, config.apiHash, {
        connectionRetries: 5,
        timeout: 30000,
        autoReconnect: true,
      });

      log('INFO', '🔌 Connecting to Telegram...');
      await client.start({ botAuthToken: config.botToken });

      // Save session
      const sessionString = client.session.save() as unknown as string;
      if (sessionString) {
        const isNewSession = !existsSync(SESSION_FILE);
        saveSession(sessionString);

        // Backup session to channel on first run
        if (isNewSession) {
          try {
            const sessionBuffer = Buffer.from(sessionString, 'utf-8');
            const sessionFile = new CustomFile('session.txt', sessionBuffer.byteLength, '', sessionBuffer);
            await client.sendFile(config.channelId, {
              file: sessionFile,
              caption: '🔐 Backup: Telegram String Session\n\n⚠️ Keep this file secure!',
              forceDocument: true,
            });
            log('INFO', '✅ Session backed up to channel');
          } catch (backupError) {
            log('WARN', 'Failed to backup session', backupError);
          }
        }
      }

      isInitialized = true;
      log('INFO', '✅ Telegram client ready');
      return true;
    } catch (error) {
      log('ERROR', 'Failed to initialize client', error);
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}

// ============================================
// Upload Handlers
// ============================================

// File upload
async function handleFileUpload(request: Request): Promise<Response> {
  const uploadId = request.headers.get('X-Upload-Id') || crypto.randomUUID();
  const clientId = request.headers.get('X-Client-Id') || 'anonymous';
  
  // Rate limit check
  if (!checkRateLimit(clientId)) {
    return errorResponse('Too many requests. Please wait a moment.', 429);
  }

  try {
    if (!client || !isInitialized) {
      const success = await initializeClient();
      if (!success) {
        return errorResponse('Service not ready. Please try again.', 503);
      }
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caption = (formData.get('caption') as string) || '';
    const fileName = (formData.get('fileName') as string) || file?.name || 'file';

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('File exceeds 1.5GB limit', 400);
    }

    log('INFO', `📤 Uploading file: ${fileName}`, { size: `${(file.size / 1024 / 1024).toFixed(2)} MB` });

    const startTime = Date.now();

    // Convert to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // CustomFile for exact filename
    const fileToUpload = new CustomFile(fileName, fileBuffer.byteLength, '', fileBuffer);

    // Upload to Telegram
    await client.sendFile(config.channelId, {
      file: fileToUpload,
      caption: caption || undefined,
      forceDocument: true,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('INFO', `✅ File uploaded: ${fileName}`, { duration: `${duration}s` });

    return jsonResponse({
      success: true,
      uploadId,
      fileName,
      fileSize: file.size,
      duration: parseFloat(duration),
    });

  } catch (error) {
    log('ERROR', 'File upload failed', error);
    return errorResponse('Upload failed. Please try again.', 500);
  }
}

// Link submission
async function handleLinkUpload(request: Request): Promise<Response> {
  const uploadId = request.headers.get('X-Upload-Id') || crypto.randomUUID();
  const clientId = request.headers.get('X-Client-Id') || 'anonymous';
  
  // Rate limit check
  if (!checkRateLimit(clientId)) {
    return errorResponse('Too many requests. Please wait a moment.', 429);
  }

  try {
    if (!client || !isInitialized) {
      const success = await initializeClient();
      if (!success) {
        return errorResponse('Service not ready. Please try again.', 503);
      }
    }

    const body = await request.json();
    const { url, caption } = body as { url?: string; caption?: string };

    if (!url) {
      return errorResponse('No URL provided', 400);
    }

    // Validate URL
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return errorResponse('Invalid URL protocol. Only HTTP/HTTPS allowed.', 400);
      }
    } catch {
      return errorResponse('Invalid URL format', 400);
    }

    log('INFO', `🔗 Processing link`, { url: url.substring(0, 50) + '...' });

    const startTime = Date.now();

    // Format message with link
    const message = caption || `📎 Shared Link\n\n🔗 URL: ${url}\n\n⏰ Submitted: ${new Date().toISOString()}`;

    // Send message to channel
    await client.sendMessage(config.channelId, {
      message,
      parseMode: 'html',
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('INFO', `✅ Link submitted`, { duration: `${duration}s` });

    return jsonResponse({
      success: true,
      uploadId,
      url,
      duration: parseFloat(duration),
    });

  } catch (error) {
    log('ERROR', 'Link submission failed', error);
    return errorResponse('Failed to submit link. Please try again.', 500);
  }
}

// Status check
async function handleStatus(): Promise<Response> {
  const initialized = client && isInitialized;
  return jsonResponse({
    success: true,
    status: initialized ? 'ready' : 'initializing',
    hasConfig: !!(config.apiId && config.apiHash && config.botToken && config.channelId),
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// Request Router
// ============================================
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Routes
  try {
    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return handleStatus();
    }

    // File upload
    if (url.pathname === '/upload' && method === 'POST') {
      return handleFileUpload(request);
    }

    // Link upload - NEW ENDPOINT
    if (url.pathname === '/upload-link' && method === 'POST') {
      return handleLinkUpload(request);
    }

    // Status
    if (url.pathname === '/status') {
      return handleStatus();
    }

    // 404
    return errorResponse('Not found', 404);

  } catch (error) {
    log('ERROR', 'Request handler error', error);
    return errorResponse('Internal server error', 500);
  }
}

// ============================================
// Start Server
// ============================================
log('INFO', `🚀 Starting Telegram Upload Service on port ${PORT}...`);

// Initialize client in background
initializeClient().then((success) => {
  if (success) {
    log('INFO', '✅ Service ready to accept uploads!');
  } else {
    log('WARN', '⚠️ Service started but Telegram not connected. Check .env file');
  }
});

// Start HTTP server
serve({
  port: PORT,
  fetch: handleRequest,
  error(error) {
    log('ERROR', 'Server error', error);
    return new Response('Internal Server Error', { status: 500 });
  },
});

log('INFO', `🌐 HTTP server listening on port ${PORT}`);
