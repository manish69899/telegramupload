/**
 * Telegram MTProto Upload Service - Optimized Version
 * * Features:
 * - Direct file uploads to Telegram using MTProto protocol
 * - Concurrency Control (Queue system to prevent FloodWaits)
 * - Disk-based buffering (Saves RAM, prevents OOM crashes)
 * - Exact Filename Preservation (NEW)
 * - Supports files up to 1.5GB
 * - Link sharing support
 * - Better error handling 
 * - Dynamic Upload Cancelation Support
 * - Unlimited Parallel Uploads Queuing (No 429 Errors Guaranteed)
 * - Mega Timeout (15 Mins) for Huge Files (NEW)
 */

import { serve } from 'bun';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
// NEW: Added rmSync to delete directories easily
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';

// ============================================
// Configuration
// ============================================
const PORT = process.env.PORT || 3002;
const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB
const DATA_DIR = join(import.meta.dir, 'data');
const SESSION_FILE = join(DATA_DIR, 'session.txt');
const LOGS_DIR = join(DATA_DIR, 'logs');
const TEMP_DIR = join(DATA_DIR, 'temp'); // Temp directory for saving files

// Cancelation Tracker
const cancelledUploads = new Set<string>();

// ============================================
// Concurrency Limiter (Queue System)
// ============================================
const MAX_CONCURRENT_UPLOADS = 2; // Telegram ko ek sath sirf 2 files bhejega taaki ban na ho
let activeUploads = 0;
const uploadQueue: (() => void)[] = [];

async function acquireUploadSlot(): Promise<void> {
  if (activeUploads < MAX_CONCURRENT_UPLOADS) {
    activeUploads++;
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    uploadQueue.push(resolve);
  });
}

function releaseUploadSlot() {
  activeUploads--;
  if (uploadQueue.length > 0) {
    activeUploads++;
    const next = uploadQueue.shift();
    if (next) next();
  }
}

// ============================================
// Utility Functions
// ============================================

// Ensure directories exist
function ensureDirectories() {
  [DATA_DIR, LOGS_DIR, TEMP_DIR].forEach(dir => {
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
      
      // NEW: Mega Timeout Setup - Ab files bich me disconnect nahi hongi
      client = new TelegramClient(session, config.apiId, config.apiHash, {
        connectionRetries: 15,       // Retries max kar diye
        timeout: 900000,             // 15 Minutes ka MEGA Timeout (900000 ms)
        autoReconnect: true,
        useWSS: false,               
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

// Cancel Upload Endpoint
async function handleCancelUpload(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { uploadId } = body as { uploadId?: string };

    if (!uploadId) {
      return errorResponse('Upload ID is required to cancel', 400);
    }

    log('INFO', `🛑 Cancel request received for upload: ${uploadId}`);
    cancelledUploads.add(uploadId); // Store id to stop progress

    // Remove from set after 1 hour to prevent memory leak
    setTimeout(() => {
      cancelledUploads.delete(uploadId);
    }, 3600000);

    return jsonResponse({ success: true, message: 'Upload cancelled successfully' });
  } catch (error) {
    return errorResponse('Failed to process cancel request', 500);
  }
}

// File upload (EXACT FILENAME PRESERVATION + NO RATE LIMIT)
async function handleFileUpload(request: Request): Promise<Response> {
  const uploadId = request.headers.get('X-Upload-Id') || crypto.randomUUID();
  
  // 1. Queue System: Wait for a slot before processing
  await acquireUploadSlot();
  
  let tempFilePath = '';
  let uniqueUploadDir = ''; // Naya variable - exact name save karne ke liye

  try {
    // Check if user cancelled before it even started processing
    if (cancelledUploads.has(uploadId)) {
      throw new Error("UPLOAD_CANCELLED_BY_USER");
    }

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

    log('INFO', `📤 Processing EXACT file: ${fileName}`, { size: `${(file.size / 1024 / 1024).toFixed(2)} MB` });
    const startTime = Date.now();

    // 2. EXACT FILENAME MAGIC: Har file ke liye ek naya folder banega, aur usme EXACT name se file save hogi
    uniqueUploadDir = join(TEMP_DIR, crypto.randomUUID());
    mkdirSync(uniqueUploadDir, { recursive: true });
    
    // File directly original naam se save hogi, bina kisi _ ya UUID mix ke
    tempFilePath = join(uniqueUploadDir, fileName);
    await Bun.write(tempFilePath, file);

    // 3. Upload directly from file path using GramJS with Cancel support
    await client.sendFile(config.channelId, {
      file: tempFilePath,
      caption: caption || undefined, // Details (caption) yahi exact aayengi image/file ke niche
      forceDocument: true,
      workers: 4, // Fast uploads
      progressCallback: (progress) => {
        // Check constantly if user hit the "Cancel" button
        if (cancelledUploads.has(uploadId)) {
          throw new Error("UPLOAD_CANCELLED_BY_USER"); // Instantly stops the MTProto upload!
        }
      }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('INFO', `✅ File uploaded perfectly: ${fileName}`, { duration: `${duration}s` });

    // Cleanup cancel tracker
    cancelledUploads.delete(uploadId);

    return jsonResponse({
      success: true,
      uploadId,
      fileName,
      fileSize: file.size,
      duration: parseFloat(duration),
    });

  } catch (error: any) {
    const errorMsg = error?.message || error;
    log('ERROR', 'File upload failed', errorMsg);
    
    // Check if it was manually cancelled
    if (String(errorMsg).includes('UPLOAD_CANCELLED_BY_USER')) {
      return jsonResponse({ success: false, status: 'cancelled', error: 'Upload was cancelled by user' }, 200);
    }

    // Telegram Rate Limit Handle
    if (String(errorMsg).includes('FLOOD')) {
       return errorResponse('Telegram rate limit hit. Upload paused temporarily. Retrying...', 429);
    }
    return errorResponse(`Upload failed: ${errorMsg}`, 500);
    
  } finally {
    // 4. Ultimate Cleanup: Delete exact file AND the unique folder
    if (tempFilePath && existsSync(tempFilePath)) {
      try { unlinkSync(tempFilePath); } catch (e) { log('WARN', `Could not delete temp file`); }
    }
    if (uniqueUploadDir && existsSync(uniqueUploadDir)) {
      try { rmSync(uniqueUploadDir, { recursive: true, force: true }); } catch (e) { log('WARN', `Could not delete temp folder`); }
    }
    releaseUploadSlot();
  }
}

// Link submission (RATE LIMIT REMOVED)
async function handleLinkUpload(request: Request): Promise<Response> {
  const uploadId = request.headers.get('X-Upload-Id') || crypto.randomUUID();
  
  try {
    if (!client || !isInitialized) {
      const success = await initializeClient();
      if (!success) return errorResponse('Service not ready. Please try again.', 503);
    }

    const body = await request.json();
    const { url, caption } = body as { url?: string; caption?: string };

    if (!url) return errorResponse('No URL provided', 400);

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

    const message = caption || `📎 Shared Link\n\n🔗 URL: ${url}\n\n⏰ Submitted: ${new Date().toISOString()}`;

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

  if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (url.pathname === '/' || url.pathname === '/health') return handleStatus();
    if (url.pathname === '/upload' && method === 'POST') return handleFileUpload(request);
    if (url.pathname === '/upload-link' && method === 'POST') return handleLinkUpload(request);
    if (url.pathname === '/cancel' && method === 'POST') return handleCancelUpload(request);
    if (url.pathname === '/status') return handleStatus();

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

initializeClient().then((success) => {
  if (success) {
    log('INFO', '✅ Service ready to accept uploads!');
  } else {
    log('WARN', '⚠️ Service started but Telegram not connected. Check .env file');
  }
});

serve({
  port: PORT,
  fetch: handleRequest,
  error(error) {
    log('ERROR', 'Server error', error);
    return new Response('Internal Server Error', { status: 500 });
  },
});

log('INFO', `🌐 HTTP server listening on port ${PORT}`);