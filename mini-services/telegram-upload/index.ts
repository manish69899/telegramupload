/**
 * Telegram MTProto Upload Service - Super Fast Version
 * 
 * Features:
 * - Parallel uploads (configurable concurrency)
 * - Handles 500+ files at once
 * - Queue-based processing
 * - Auto-retry on failure
 * - Real-time progress tracking
 * - No rate limiting for uploads
 */

import { serve } from 'bun';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================
// Configuration
// ============================================
const PORT = 3002;
const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB
const DATA_DIR = join(import.meta.dir, 'data');
const SESSION_FILE = join(DATA_DIR, 'session.txt');
const LOGS_DIR = join(DATA_DIR, 'logs');

// Upload Configuration - OPTIMIZED FOR SPEED
const MAX_CONCURRENT_UPLOADS = 20; // Upload 20 files at once
const RETRY_ATTEMPTS = 3; // Retry failed uploads 3 times
const RETRY_DELAY = 2000; // 2 second delay between retries

// ============================================
// Types
// ============================================
interface UploadJob {
  id: string;
  file: File;
  fileName: string;
  caption: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  attempts: number;
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface UploadQueue {
  jobs: Map<string, UploadJob>;
  pending: string[];
  active: number;
  completed: number;
  failed: number;
  total: number;
}

// ============================================
// Global State
// ============================================
const uploadQueue: UploadQueue = {
  jobs: new Map(),
  pending: [],
  active: 0,
  completed: 0,
  failed: 0,
  total: 0,
};

// Track batch uploads
const batches = new Map<string, {
  total: number;
  completed: number;
  failed: number;
  startTime: number;
}>();

// ============================================
// Utility Functions
// ============================================

function ensureDirectories() {
  [DATA_DIR, LOGS_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

function log(level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}`;
  
  console.log(logLine);
  
  try {
    const logFile = join(LOGS_DIR, `service-${new Date().toISOString().split('T')[0]}.log`);
    const existing = existsSync(logFile) ? readFileSync(logFile, 'utf-8') : '';
    writeFileSync(logFile, existing + logLine + '\n');
  } catch {
    // Ignore log file errors
  }
}

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

function saveSession(session: string) {
  writeFileSync(SESSION_FILE, session);
  log('INFO', '✅ Session saved');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ============================================
// HTTP Helpers
// ============================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Id, X-Client-Id, X-Batch-Id',
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

const config = {
  apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
  apiHash: process.env.TELEGRAM_API_HASH || '',
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  channelId: process.env.TELEGRAM_CHANNEL_ID || '',
  session: '',
};

async function initializeClient(): Promise<boolean> {
  if (initPromise) return initPromise;
  if (client && isInitialized) return true;

  initPromise = (async () => {
    try {
      log('INFO', '🚀 Initializing Telegram client...');
      
      config.session = loadSession();
      
      if (!config.apiId || !config.apiHash || !config.botToken || !config.channelId) {
        log('ERROR', '❌ Missing configuration');
        return false;
      }

      const session = new StringSession(config.session);
      
      client = new TelegramClient(session, config.apiId, config.apiHash, {
        connectionRetries: 10,
        timeout: 60000,
        autoReconnect: true,
        useWSS: false, // Faster for large uploads
      });

      log('INFO', '🔌 Connecting to Telegram...');
      await client.start({ botAuthToken: config.botToken });

      const sessionString = client.session.save() as unknown as string;
      if (sessionString) {
        saveSession(sessionString);
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
// Upload Processor - PARALLEL UPLOADS
// ============================================
async function processUploadJob(job: UploadJob): Promise<boolean> {
  try {
    job.status = 'uploading';
    job.startTime = Date.now();
    uploadQueue.jobs.set(job.id, job);

    // Convert to Buffer
    const arrayBuffer = await job.file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Create CustomFile for exact filename
    const fileToUpload = new CustomFile(job.fileName, fileBuffer.byteLength, '', fileBuffer);

    // Upload to Telegram
    await client!.sendFile(config.channelId, {
      file: fileToUpload,
      caption: job.caption || undefined,
      forceDocument: true,
    });

    job.status = 'completed';
    job.endTime = Date.now();
    uploadQueue.completed++;
    uploadQueue.jobs.set(job.id, job);
    
    const duration = ((job.endTime - job.startTime!) / 1000).toFixed(2);
    log('INFO', `✅ Uploaded: ${job.fileName}`, { duration: `${duration}s` });
    
    return true;
  } catch (error) {
    job.attempts++;
    job.error = error instanceof Error ? error.message : 'Unknown error';
    
    if (job.attempts < RETRY_ATTEMPTS) {
      log('WARN', `⚠️ Retry ${job.attempts}/${RETRY_ATTEMPTS}: ${job.fileName}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return processUploadJob(job);
    }
    
    job.status = 'failed';
    uploadQueue.failed++;
    uploadQueue.jobs.set(job.id, job);
    log('ERROR', `❌ Failed after ${RETRY_ATTEMPTS} attempts: ${job.fileName}`, error);
    return false;
  }
}

// Process queue with concurrency
async function processQueue(batchId: string) {
  const batch = batches.get(batchId);
  if (!batch) return;

  const processNext = async () => {
    while (uploadQueue.pending.length > 0 && uploadQueue.active < MAX_CONCURRENT_UPLOADS) {
      const jobId = uploadQueue.pending.shift();
      if (!jobId) break;

      const job = uploadQueue.jobs.get(jobId);
      if (!job) continue;

      uploadQueue.active++;
      
      // Process asynchronously (don't await)
      processUploadJob(job).then((success) => {
        uploadQueue.active--;
        if (success) {
          batch.completed++;
        } else {
          batch.failed++;
        }
        
        // Continue processing
        processNext();
      });
    }
  };

  // Start initial batch of uploads
  const initialCount = Math.min(MAX_CONCURRENT_UPLOADS, uploadQueue.pending.length);
  for (let i = 0; i < initialCount; i++) {
    processNext();
  }
}

// ============================================
// Request Handlers
// ============================================

// Single file upload
async function handleFileUpload(request: Request): Promise<Response> {
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

    const startTime = Date.now();
    log('INFO', `📤 Uploading: ${fileName}`, { size: `${(file.size / 1024 / 1024).toFixed(2)} MB` });

    // Convert to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const fileToUpload = new CustomFile(fileName, fileBuffer.byteLength, '', fileBuffer);

    // Upload
    await client.sendFile(config.channelId, {
      file: fileToUpload,
      caption: caption || undefined,
      forceDocument: true,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('INFO', `✅ Uploaded: ${fileName}`, { duration: `${duration}s` });

    return jsonResponse({
      success: true,
      fileName,
      fileSize: file.size,
      duration: parseFloat(duration),
    });

  } catch (error) {
    log('ERROR', 'Upload failed', error);
    return errorResponse('Upload failed. Please try again.', 500);
  }
}

// Batch upload - MULTIPLE FILES AT ONCE
async function handleBatchUpload(request: Request): Promise<Response> {
  try {
    if (!client || !isInitialized) {
      const success = await initializeClient();
      if (!success) {
        return errorResponse('Service not ready. Please try again.', 503);
      }
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const captionsRaw = formData.get('captions') as string;
    
    // Parse captions if provided
    let captions: Record<string, string> = {};
    if (captionsRaw) {
      try {
        captions = JSON.parse(captionsRaw);
      } catch {
        // Ignore parse errors
      }
    }

    if (!files || files.length === 0) {
      return errorResponse('No files provided', 400);
    }

    // Validate all files first
    const invalidFiles = files.filter(f => f.size > MAX_FILE_SIZE);
    if (invalidFiles.length > 0) {
      return errorResponse(`${invalidFiles.length} file(s) exceed 1.5GB limit`, 400);
    }

    const batchId = generateId();
    
    // Create batch tracking
    batches.set(batchId, {
      total: files.length,
      completed: 0,
      failed: 0,
      startTime: Date.now(),
    });

    log('INFO', `📦 Batch upload started: ${files.length} files`, { batchId });

    // Add all files to queue
    for (const file of files) {
      const jobId = generateId();
      const job: UploadJob = {
        id: jobId,
        file,
        fileName: file.name,
        caption: captions[file.name] || '',
        status: 'pending',
        attempts: 0,
      };
      
      uploadQueue.jobs.set(jobId, job);
      uploadQueue.pending.push(jobId);
      uploadQueue.total++;
    }

    // Start processing
    processQueue(batchId);

    // Return immediately with batch ID
    return jsonResponse({
      success: true,
      batchId,
      totalFiles: files.length,
      message: `Processing ${files.length} files. Check status with batch ID.`,
    });

  } catch (error) {
    log('ERROR', 'Batch upload failed', error);
    return errorResponse('Batch upload failed. Please try again.', 500);
  }
}

// Check batch status
async function handleBatchStatus(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const batchId = url.searchParams.get('batchId');

  if (!batchId) {
    return errorResponse('Batch ID required', 400);
  }

  const batch = batches.get(batchId);
  if (!batch) {
    return errorResponse('Batch not found', 404);
  }

  const isComplete = batch.completed + batch.failed >= batch.total;

  return jsonResponse({
    success: true,
    batchId,
    total: batch.total,
    completed: batch.completed,
    failed: batch.failed,
    pending: batch.total - batch.completed - batch.failed,
    isComplete,
    duration: isComplete ? ((Date.now() - batch.startTime) / 1000).toFixed(2) + 's' : null,
  });
}

// Link submission
async function handleLinkUpload(request: Request): Promise<Response> {
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

    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return errorResponse('Invalid URL protocol', 400);
      }
    } catch {
      return errorResponse('Invalid URL format', 400);
    }

    const message = caption || `📎 Shared Link\n\n🔗 URL: ${url}\n\n⏰ ${new Date().toISOString()}`;

    await client.sendMessage(config.channelId, {
      message,
      parseMode: 'html',
    });

    log('INFO', `✅ Link submitted: ${url.substring(0, 50)}...`);

    return jsonResponse({
      success: true,
      url,
    });

  } catch (error) {
    log('ERROR', 'Link submission failed', error);
    return errorResponse('Failed to submit link', 500);
  }
}

// Status check
async function handleStatus(): Promise<Response> {
  return jsonResponse({
    success: true,
    status: client && isInitialized ? 'ready' : 'initializing',
    queue: {
      pending: uploadQueue.pending.length,
      active: uploadQueue.active,
      completed: uploadQueue.completed,
      failed: uploadQueue.failed,
      total: uploadQueue.total,
    },
    config: {
      maxConcurrentUploads: MAX_CONCURRENT_UPLOADS,
      retryAttempts: RETRY_ATTEMPTS,
    },
  });
}

// Clear completed jobs
function clearCompletedJobs() {
  const toDelete: string[] = [];
  
  uploadQueue.jobs.forEach((job, id) => {
    if (job.status === 'completed' || job.status === 'failed') {
      toDelete.push(id);
    }
  });

  toDelete.forEach(id => uploadQueue.jobs.delete(id));
  uploadQueue.completed = 0;
  uploadQueue.failed = 0;
  uploadQueue.total = uploadQueue.pending.length + uploadQueue.active;

  log('INFO', `🧹 Cleared ${toDelete.length} completed jobs`);
}

// ============================================
// Request Router
// ============================================
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return handleStatus();
    }

    // Single file upload
    if (url.pathname === '/upload' && method === 'POST') {
      return handleFileUpload(request);
    }

    // Batch upload - NEW
    if (url.pathname === '/upload-batch' && method === 'POST') {
      return handleBatchUpload(request);
    }

    // Batch status - NEW
    if (url.pathname === '/batch-status' && method === 'GET') {
      return handleBatchStatus(request);
    }

    // Link upload
    if (url.pathname === '/upload-link' && method === 'POST') {
      return handleLinkUpload(request);
    }

    // Clear completed
    if (url.pathname === '/clear' && method === 'POST') {
      clearCompletedJobs();
      return jsonResponse({ success: true, message: 'Cleared completed jobs' });
    }

    // Status
    if (url.pathname === '/status') {
      return handleStatus();
    }

    return errorResponse('Not found', 404);

  } catch (error) {
    log('ERROR', 'Request handler error', error);
    return errorResponse('Internal server error', 500);
  }
}

// ============================================
// Start Server
// ============================================
ensureDirectories();
loadEnv();

// Update config after loading env
config.apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
config.apiHash = process.env.TELEGRAM_API_HASH || '';
config.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
config.channelId = process.env.TELEGRAM_CHANNEL_ID || '';

log('INFO', `🚀 Super Fast Upload Service starting on port ${PORT}...`);
log('INFO', `⚡ Config: ${MAX_CONCURRENT_UPLOADS} concurrent uploads, ${RETRY_ATTEMPTS} retries`);

// Initialize client
initializeClient().then((success) => {
  if (success) {
    log('INFO', '✅ Service ready for super fast uploads!');
  } else {
    log('WARN', '⚠️ Service started but Telegram not connected');
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
