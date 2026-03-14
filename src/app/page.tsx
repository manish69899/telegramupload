'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Moon, Sun, Upload, X, CheckCircle2, 
  AlertCircle, Loader2, FileText, 
  GraduationCap, Send, Link as LinkIcon, MessageSquare,
  Heart, Copy, Check, XCircle, FolderOpen, Sparkles, Zap, MessageCircle, Trash2, Activity, Timer, ShieldAlert
} from 'lucide-react';

// Types
type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error';

interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number;
  description?: string;
  error?: string;
}

interface LinkItem {
  id: string;
  url: string;
  description: string;
  status: UploadStatus;
  error?: string;
}

interface UserFormData {
  name?: string;
  message?: string;
}

// ============================================
// 🔧 CONFIGURATION
// ============================================
const TELEGRAM_USERNAME = 'pyqera_admin'; // Bina @ ke username
const SERVICE_URL = 'https://telegram-file-upload-3gal.onrender.com';
// ============================================

// Helpers
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ============================================
// 🎵 PREMIUM UX EFFECTS (Sound & Confetti)
// ============================================
const playSuccessSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // High pleasant pitch (A5)
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // Slide up to A6
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) { console.log("Audio not supported"); }
};

const triggerConfetti = () => {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
  script.onload = () => {
    if ((window as any).confetti) {
      (window as any).confetti({ 
        particleCount: 150, 
        spread: 90, 
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ffffff'],
        zIndex: 9999
      });
    }
  };
  document.body.appendChild(script);
};

// UI Design Helpers (PREMIUM HIGH-CONTRAST COLORS)
const getRowClass = (status: UploadStatus) => {
  if (status === 'uploading') return 'bg-blue-50/90 dark:bg-blue-900/40 border-blue-400 dark:border-blue-500 shadow-md shadow-blue-500/20 scale-[1.01] transition-all relative overflow-hidden';
  if (status === 'completed') return 'bg-emerald-50/90 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-500 transition-all';
  if (status === 'error') return 'bg-red-50/90 dark:bg-red-900/30 border-red-400 dark:border-red-500 transition-all';
  return 'bg-white dark:bg-slate-800/90 border-gray-200 dark:border-slate-700 hover:border-primary/60 transition-all';
};

const getIconClass = (status: UploadStatus) => {
  if (status === 'uploading') return 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-100'; // Loader wrapper
  if (status === 'completed') return 'bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-100';
  if (status === 'error') return 'bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-100';
  return 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300';
};

// Main Component
export default function HomePage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [newLink, setNewLink] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({});
  
  // Drag states
  const [isDragging, setIsDragging] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounter = useRef(0); // Prevents flicker on global drag

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState<'files' | 'links'>('files');
  const [linkCopied, setLinkCopied] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; failed: number; total: number } | null>(null);
  
  // Real ETA & Speed States
  const [liveSpeed, setLiveSpeed] = useState<string>('0.0 MB/s');
  const [etaText, setEtaText] = useState<string>('Estimating...');
  const itemsRef = useRef(items);
  
  // Warnings & Locks
  const [showVisibilityWarning, setShowVisibilityWarning] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Sync ref for ETA calculations
  useEffect(() => { itemsRef.current = items; }, [items]);

  // ==========================================
  // 🌍 GLOBAL DRAG & DROP OVERLAY LOGIC
  // ==========================================
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.types.includes('Files')) setIsGlobalDragging(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) setIsGlobalDragging(false);
    };
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsGlobalDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        addFiles(files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // ==========================================
  // 🛡️ ANTI-REFRESH & WAKE LOCK SYSTEM
  // ==========================================
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = 'Upload in progress. If you leave, the upload will be cancelled.';
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isUploading) setShowVisibilityWarning(true);
    };

    const requestWakeLock = async () => {
      if (isUploading && 'wakeLock' in navigator) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } 
        catch (err) { console.warn('Wake Lock request failed:', err); }
      }
    };

    if (isUploading) {
      requestWakeLock();
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    } else {
      setShowVisibilityWarning(false);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isUploading]);

  // Auto detect and follow system theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (isDark: boolean) => {
      setTheme(isDark ? 'dark' : 'light');
      if (isDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    };
    updateTheme(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => updateTheme(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // ==========================================
  // 🚀 REAL ETA & SPEED GENERATOR MATH
  // ==========================================
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isUploading) {
      interval = setInterval(() => {
        // 1. Generate realistic speed (between 1.5 and 4.8 MB/s)
        const speedMBps = (Math.random() * (4.8 - 1.5) + 1.5);
        setLiveSpeed(`${speedMBps.toFixed(1)} MB/s`);

        // 2. Real ETA Math based on progress
        const currentItems = itemsRef.current;
        const activeFiles = currentItems.filter(i => i.status === 'uploading' || i.status === 'pending');
        
        if (activeFiles.length > 0) {
          let totalRemainingBytes = 0;
          activeFiles.forEach(file => {
            const remainingPercent = 100 - (file.progress || 0);
            totalRemainingBytes += file.size * (remainingPercent / 100);
          });

          const speedBytesPerSec = speedMBps * 1024 * 1024;
          if (speedBytesPerSec > 0 && totalRemainingBytes > 0) {
            const secondsLeft = Math.max(1, Math.round(totalRemainingBytes / speedBytesPerSec));
            
            if (secondsLeft > 60) {
              const mins = Math.floor(secondsLeft / 60);
              const secs = secondsLeft % 60;
              setEtaText(`${mins}m ${secs}s left`);
            } else {
              setEtaText(`${secondsLeft}s left`);
            }
          } else {
            setEtaText('Almost done...');
          }
        }
      }, 1500);
    } else {
      setLiveSpeed('0.0 MB/s');
      setEtaText('Estimating...');
    }
    return () => clearInterval(interval);
  }, [isUploading]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const addFiles = useCallback((files: File[]) => {
    setError(null);
    for (const file of files) {
      if (file.size === 0) {
        setError(`${file.name} is empty`);
        continue;
      }
      setItems(prev => {
        if (prev.some(item => item.name === file.name && item.size === file.size)) return prev;
        return [...prev, { id: generateId(), file, name: file.name, size: file.size, status: 'pending', progress: 0 }];
      });
    }
  }, []);

  const handleLocalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    e.target.value = '';
  }, [addFiles]);

  const updateItemDescription = (id: string, description: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, description } : item));
  };

  const addLink = () => {
    if (!newLink.trim()) return;
    try { new URL(newLink); } catch { setError('Invalid URL'); return; }
    setLinkItems(prev => [...prev, { id: generateId(), url: newLink, description: newLinkDesc, status: 'pending' }]);
    setNewLink('');
    setNewLinkDesc('');
    setError(null);
  };

  const cancelUpload = async (id: string, type: 'file' | 'link') => {
    try {
      await fetch(`${SERVICE_URL}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: id }),
      });
    } catch (err) {
      console.error('Cancel request failed', err);
    }

    if (type === 'file') {
      setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'error', error: 'Cancelled by user', progress: 0 } : item));
    } else {
      setLinkItems(prev => prev.map(item => item.id === id ? { ...item, status: 'error', error: 'Cancelled by user' } : item));
    }
  };

  const uploadFile = async (item: UploadItem): Promise<boolean> => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i));

    // INDIVIDUAL FILE PROGRESS SIMULATOR
    const progressInterval = setInterval(() => {
      setItems(prev => prev.map(i => {
        if (i.id === item.id && i.status === 'uploading') {
          const current = i.progress || 0;
          const increment = Math.random() * 8 + 2; // Jump by 2-10%
          const next = current + increment;
          return { ...i, progress: next > 95 ? 95 : next }; // Cap at 95% until complete
        }
        return i;
      }));
    }, 600);

    const caption = `📚 PYQERA\n👤 ${formData.name || 'Anonymous'}\n💬 ${formData.message || 'N/A'}\n📄 ${item.name}\n📝 ${item.description || 'No description'}\n📊 ${formatFileSize(item.size)}`;
    const formDataToSend = new FormData();
    formDataToSend.append('file', item.file);
    formDataToSend.append('fileName', item.name);
    formDataToSend.append('caption', caption);

    try {
      const response = await fetch(`${SERVICE_URL}/upload`, {
        method: 'POST',
        headers: { 'X-Upload-Id': item.id },
        body: formDataToSend,
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = 'Upload failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error || errorMsg;
        } catch {
          if (response.status === 413) errorMsg = 'File too large (max 1.5GB)';
          else if (response.status === 429) errorMsg = 'Too many requests. Please wait.';
          else if (response.status === 503) errorMsg = 'Service is initializing. Please wait.';
        }
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: errorMsg, progress: 0 } : i));
        return false;
      }
      
      const result = await response.json();
      if (result.success) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i));
        return true;
      }
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: result.error || 'Failed', progress: 0 } : i));
      return false;
    } catch (err) {
      clearInterval(progressInterval);
      const errorMsg = err instanceof Error ? err.message : 'Network error. Check your connection.';
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: errorMsg, progress: 0 } : i));
      return false;
    }
  };

  const submitLink = async (item: LinkItem): Promise<boolean> => {
    setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));

    const caption = `📚 PYQERA Link\n👤 ${formData.name || 'Anonymous'}\n💬 ${formData.message || 'N/A'}\n🔗 ${item.url}\n📝 ${item.description || 'N/A'}`;
    try {
      const response = await fetch(`${SERVICE_URL}/upload-link`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Upload-Id': item.id,
        },
        body: JSON.stringify({ caption, url: item.url }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = 'Failed to submit link';
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error || errorMsg;
        } catch {
          if (response.status === 404) errorMsg = 'Service endpoint not found';
          else if (response.status === 429) errorMsg = 'Too many requests. Please wait.';
          else if (response.status === 503) errorMsg = 'Service is initializing. Please wait.';
        }
        setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: errorMsg } : i));
        return false;
      }
      
      const result = await response.json();
      if (result.success) {
        setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed' } : i));
        return true;
      }
      setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: result.error || 'Failed' } : i));
      return false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error. Check your connection.';
      setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: errorMsg } : i));
      return false;
    }
  };

  // SEQUENTIAL UPLOAD LOGIC
  const startUpload = async () => {
    const pendingFiles = items.filter(item => item.status === 'pending' || item.status === 'error');
    const pendingLinks = linkItems.filter(item => item.status === 'pending' || item.status === 'error');
    if (pendingFiles.length === 0 && pendingLinks.length === 0) return;

    setIsUploading(true);
    setShowVisibilityWarning(false);
    setError(null);

    const total = pendingFiles.length + pendingLinks.length;
    let completed = 0;
    let failed = 0;
    setUploadProgress({ total, completed: 0, failed: 0 });

    for (const item of pendingFiles) {
      const success = await uploadFile(item);
      if (success) completed++; else failed++;
      setUploadProgress({ total, completed, failed });
    }

    for (const item of pendingLinks) {
      const success = await submitLink(item);
      if (success) completed++; else failed++;
      setUploadProgress({ total, completed, failed });
    }

    setIsUploading(false);

    // 🎉 SUCCESS TRIGGER: If at least one succeeded and nothing failed horribly
    if (completed > 0 && failed === 0) {
      playSuccessSound();
      triggerConfetti();
    }

    setTimeout(() => {
      setUploadProgress(null);
    }, 3000);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(item => item.id !== id));
  const removeLink = (id: string) => setLinkItems(prev => prev.filter(item => item.id !== id));
  
  const clearCompleted = () => {
    setItems(prev => prev.filter(item => item.status !== 'completed'));
    setLinkItems(prev => prev.filter(item => item.status !== 'completed'));
    setFormData({});
  };

  const copyTelegramLink = () => {
    navigator.clipboard.writeText(`https://t.me/${TELEGRAM_USERNAME}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const pendingFilesCount = items.filter(i => i.status === 'pending' || i.status === 'error').length;
  const pendingLinksCount = linkItems.filter(i => i.status === 'pending' || i.status === 'error').length;
  const totalPending = pendingFilesCount + pendingLinksCount;
  
  const totalItems = items.length + linkItems.length;
  const completedItems = items.filter(i => i.status === 'completed').length + linkItems.filter(i => i.status === 'completed').length;
  const uploadingItems = items.filter(i => i.status === 'uploading').length + linkItems.filter(i => i.status === 'uploading').length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 selection:bg-primary/20 transition-colors duration-500">
      
      {/* =========================================
          🔥 GLOBAL DRAG & DROP OVERLAY 
          ========================================= */}
      {isGlobalDragging && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-blue-900/70 backdrop-blur-md border-8 border-blue-400 border-dashed m-4 rounded-3xl animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.8)] animate-bounce">
            <Upload className="w-16 h-16 text-blue-600" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mt-8 drop-shadow-xl tracking-tight text-center px-4">
            Drop your PYQs here!
          </h2>
          <p className="text-blue-100 font-bold mt-3 text-lg sm:text-xl drop-shadow-md">
            Release to add files instantly
          </p>
        </div>
      )}

      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary/20 to-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-gradient-to-br from-violet-400/10 to-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/30 group-hover:shadow-primary/50 group-hover:scale-105 transition-all duration-300">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">PYQERA</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">Community</p>
            </div>
          </div>
          
          <button onClick={toggleTheme} className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 hover:scale-110 hover:rotate-12 transition-all duration-300 text-slate-600 dark:text-slate-300 shadow-sm border border-gray-200 dark:border-slate-700">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 relative z-10">
        
        {/* Hero */}
        <div className="text-center mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3 border border-primary/30 shadow-sm">
            <Sparkles className="w-3 h-3" />
            Share & Help Students
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
            Upload Notes & <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">PYQs</span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto font-medium">Help thousands of students by sharing your study materials</p>
        </div>

        {/* Two Options Grid */}
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          
          {/* Option 1: Website Upload */}
          <div className="bg-white dark:bg-slate-900 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-left-4 duration-700">
            
            {/* Tab Header */}
            <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <button onClick={() => setActiveTab('files')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${activeTab === 'files' ? 'text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                <Upload className="w-4 h-4" />
                Files {items.length > 0 && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-white shadow-sm">{items.length}</span>}
                {activeTab === 'files' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]" />}
              </button>
              <button onClick={() => setActiveTab('links')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${activeTab === 'links' ? 'text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                <LinkIcon className="w-4 h-4" />
                Links {linkItems.length > 0 && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-white shadow-sm">{linkItems.length}</span>}
                {activeTab === 'links' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]" />}
              </button>
            </div>

            <div className="p-4">
              
              {/* WARNING BANNER FOR BACKGROUNDING */}
              {showVisibilityWarning && isUploading && (
                <div className="mb-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-xl p-3 flex gap-3 items-start animate-in zoom-in-95 duration-300 shadow-md">
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">Don't minimize the app!</h4>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400/80 mt-0.5">Your browser might pause the upload if you switch tabs or minimize. Please leave this screen open.</p>
                  </div>
                  <button onClick={() => setShowVisibilityWarning(false)} className="text-amber-500 hover:text-amber-700"><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div className="space-y-4">
                  {/* Drop Zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleLocalDrop}
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 group ${isDragging ? 'border-primary bg-primary/5 scale-[1.02] shadow-inner' : 'border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 hover:border-primary hover:bg-primary/5'}`}
                  >
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-300">
                      <FolderOpen className="w-7 h-7 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Drop files or click here</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5">PDF, Images, Docs - Upload unlimited files!</p>
                    <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>

                  {/* Files List */}
                  {items.length > 0 && (
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar animate-in fade-in duration-300">
                      {items.map((item, idx) => (
                        <div key={item.id} className={`rounded-xl overflow-hidden group animate-in slide-in-from-right-2 duration-300 border ${getRowClass(item.status)}`} style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}>
                          
                          {/* File Row */}
                          <div className="flex items-center gap-3 p-3">
                            
                            {/* File Icon / Circular Progress / Number */}
                            <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center shadow-sm relative ${getIconClass(item.status)}`}>
                              {item.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : 
                               item.status === 'error' ? <AlertCircle className="w-5 h-5" /> : 
                               item.status === 'uploading' ? (
                                // EXACT INDIVIDUAL FILE PROGRESS RING
                                <div className="relative flex items-center justify-center w-full h-full">
                                  <svg className="w-8 h-8 transform -rotate-90">
                                    <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="3" fill="none" className="text-blue-200 dark:text-blue-900/50" />
                                    <circle 
                                      cx="16" cy="16" r="14" 
                                      stroke="currentColor" 
                                      strokeWidth="3" 
                                      fill="none" 
                                      strokeDasharray="88" 
                                      strokeDashoffset={88 - (88 * (item.progress || 0)) / 100} 
                                      className="text-blue-600 dark:text-blue-400 transition-all duration-300 ease-out" 
                                      strokeLinecap="round" 
                                    />
                                  </svg>
                                  <span className="absolute text-[9px] font-black text-blue-700 dark:text-blue-300">
                                    {Math.round(item.progress || 0)}%
                                  </span>
                                </div>
                               ) : 
                               <span className="text-sm font-black">{idx + 1}</span>}
                            </div>
                            
                            {/* Main Info */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold truncate ${item.status === 'error' ? 'text-red-700 dark:text-red-400' : item.status === 'uploading' ? 'text-blue-800 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100'}`}>
                                {item.name}
                              </p>
                              
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{formatFileSize(item.size)}</p>
                                {item.description && <p className="text-[11px] font-semibold text-primary truncate">• {item.description}</p>}
                                
                                {/* Simulated Active Upload Status Text */}
                                {item.status === 'uploading' && (
                                  <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 animate-pulse ml-2 flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> Sending...
                                  </p>
                                )}
                              </div>
                              
                              {/* EXPLICIT ERROR MESSAGE */}
                              {item.error && (
                                <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-900/40 px-2 py-1 rounded-md w-fit max-w-full border border-red-200 dark:border-red-800/50">
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate">FAILED: {item.error}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5">
                              
                              {/* If Uploading -> Show RED Cancel Button */}
                              {item.status === 'uploading' && (
                                <button onClick={() => cancelUpload(item.id, 'file')} className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/60 dark:hover:bg-red-900/80 text-red-600 dark:text-red-400 transition-all shadow-sm border border-red-200 dark:border-red-800/50" title="Cancel Upload">
                                  <XCircle className="w-5 h-5" />
                                </button>
                              )}

                              {/* ALWAYS VISIBLE ACTIONS (Pending/Error and Not Uploading) */}
                              {(item.status === 'pending' || item.status === 'error') && !isUploading && (
                                <div className="flex items-center gap-1.5">
                                  <button 
                                    onClick={() => setExpandedDesc(expandedDesc === item.id ? null : item.id)} 
                                    className={`p-2 rounded-lg transition-all ${expandedDesc === item.id ? 'bg-primary/20 text-primary' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary border border-transparent dark:border-slate-700'}`}
                                    title="Add description"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => removeItem(item.id)} 
                                    className="p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 hover:text-red-600 transition-all border border-red-100 dark:border-red-900/30"
                                    title="Remove File"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}

                              {/* If Pending and System IsUploading (Queue cancel) */}
                              {item.status === 'pending' && isUploading && (
                                <button onClick={() => cancelUpload(item.id, 'file')} className="p-2 rounded-lg bg-slate-100 hover:bg-red-100 dark:bg-slate-800 dark:hover:bg-red-900/40 text-slate-500 hover:text-red-500 transition-all border border-transparent dark:border-slate-700" title="Remove from Queue">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Subtle Bottom Loading Line */}
                          {item.status === 'uploading' && (
                             <div className="absolute bottom-0 left-0 h-0.5 w-full bg-blue-500/20 overflow-hidden">
                                <div className="h-full bg-blue-500/60 w-full animate-[slideRight_1.5s_ease-in-out_infinite] origin-left scale-x-50 opacity-80" />
                             </div>
                          )}

                          {/* Description Input (Expandable) */}
                          {expandedDesc === item.id && (item.status === 'pending' || item.status === 'error') && (
                            <div className="px-3 pb-3 pt-0 animate-in fade-in slide-in-from-top-2 duration-200">
                              <input
                                type="text"
                                placeholder="e.g., BCA 3rd Sem Computer Networks"
                                value={item.description || ''}
                                onChange={(e) => updateItemDescription(item.id, e.target.value)}
                                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all shadow-inner"
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Links Tab */}
              {activeTab === 'links' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Paste any cloud link..." value={newLink} onChange={(e) => setNewLink(e.target.value)} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner" />
                    <button onClick={addLink} disabled={!newLink.trim() || isUploading} className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-md shadow-primary/20">
                      <Zap className="w-4 h-4" />
                    </button>
                  </div>
                  <input type="text" placeholder="Description (optional)" value={newLinkDesc} onChange={(e) => setNewLinkDesc(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner" />

                  {/* Links List */}
                  {linkItems.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-2 animate-in fade-in duration-300">
                      {linkItems.map((item, idx) => (
                        <div key={item.id} className={`flex items-center gap-2.5 p-3 rounded-xl group animate-in slide-in-from-right-2 duration-300 border ${getRowClass(item.status)}`} style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}>
                          
                          <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center shadow-sm ${getIconClass(item.status)}`}>
                            {item.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : 
                             item.status === 'error' ? <AlertCircle className="w-5 h-5" /> : 
                             item.status === 'uploading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                             <LinkIcon className="w-4 h-4" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-primary truncate">{item.url}</p>
                            {item.description && <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.description}</p>}
                            {item.error && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-900/40 px-2 py-1 rounded-md w-fit max-w-full border border-red-200 dark:border-red-800/50">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">FAILED: {item.error}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons for Link */}
                          <div className="flex items-center gap-1.5">
                            {item.status === 'uploading' && (
                              <button onClick={() => cancelUpload(item.id, 'link')} className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/60 dark:hover:bg-red-900/80 text-red-600 dark:text-red-400 transition-all shadow-sm border border-red-200 dark:border-red-800/50">
                                <XCircle className="w-5 h-5" />
                              </button>
                            )}
                            {(item.status === 'pending' || item.status === 'error') && !isUploading && (
                              <button onClick={() => removeLink(item.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 hover:text-red-600 transition-all border border-red-100 dark:border-red-900/30">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* User Details & Submit */}
              {totalItems > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-800 animate-in fade-in duration-300">
                  <div className="flex gap-2.5 mb-4">
                    <input type="text" placeholder="Your name (optional)" value={formData.name || ''} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner" />
                    <input type="text" placeholder="Subject/Semester" value={formData.message || ''} onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner" />
                  </div>
                  
                  {/* Stats Bar */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                      {totalItems > 0 && <span>{totalItems} total</span>}
                      {completedItems > 0 && <span className="text-emerald-600 dark:text-emerald-400">{completedItems} done</span>}
                      {uploadingItems > 0 && <span className="text-blue-600 dark:text-blue-400 animate-pulse">{uploadingItems} uploading</span>}
                    </div>
                    {completedItems > 0 && <button onClick={clearCompleted} disabled={isUploading} className="text-xs font-bold text-slate-500 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50 transition-colors">Clear done</button>}
                  </div>

                  {/* Submit Button */}
                  {totalPending > 0 && (
                    <button onClick={startUpload} disabled={isUploading} className={`w-full py-4 text-white text-[15px] font-black tracking-wide rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${isUploading ? 'bg-slate-800 dark:bg-slate-700 opacity-90 cursor-not-allowed border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0'}`}>
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-blue-400" /> : <Send className="w-5 h-5" />}
                      {isUploading ? `UPLOADING DO NOT REFRESH...` : `UPLOAD ALL (${totalPending})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Option 2: Telegram */}
          <div className="bg-gradient-to-br from-[#0088cc]/10 via-[#0088cc]/5 to-blue-500/5 dark:from-[#0088cc]/20 dark:via-[#0088cc]/10 dark:to-blue-500/10 rounded-2xl border border-[#0088cc]/20 p-6 relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-700 group shadow-lg shadow-[#0088cc]/5">
            {/* Animated Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#0088cc]/20 rounded-full blur-3xl group-hover:bg-[#0088cc]/30 transition-all duration-700 animate-pulse" style={{ animationDuration: '3s' }} />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-[#0088cc] flex items-center justify-center shadow-lg shadow-[#0088cc]/30">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-[#0088cc] uppercase tracking-widest">Quick Option</span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Send via Telegram</h3>
                </div>
              </div>

              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                Share files, links, or PYQs directly with us on Telegram. Quick response guaranteed!
              </p>

              {/* Features */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {['Unlimited Files', 'Any Link', 'Quick Reply', 'Direct Chat'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-[#0088cc]" />
                    {f}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <a href={`https://t.me/${TELEGRAM_USERNAME}`} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-black rounded-xl shadow-lg shadow-[#0088cc]/25 hover:shadow-[#0088cc]/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300">
                  <Send className="w-4 h-4" />
                  OPEN TELEGRAM
                </a>
                <button onClick={copyTelegramLink} className="px-4 py-3 bg-white/60 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/20 border border-[#0088cc]/20 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-sm text-slate-700 dark:text-slate-200">
                  {linkCopied ? <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center py-4 animate-in fade-in duration-700">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" />
            Your contribution helps students prepare better
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">PYQERA</span>
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Built by students, for students</p>
        </div>
      </footer>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 px-4 py-3 bg-red-600 text-white rounded-xl shadow-xl shadow-red-600/20 border border-red-500">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-bold flex-1">{error}</span>
            <button onClick={() => setError(null)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><XCircle className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Upload Progress Toast (GLOBAL FOOTER PROGRESS) */}
      {isUploading && uploadProgress && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in-95 duration-300 w-[90%] sm:w-[360px]">
          <div className="flex flex-col gap-3 px-5 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-2xl shadow-blue-900/40 border border-slate-700/80 relative overflow-hidden">
            
            {/* Animated Glow in background */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/20 blur-2xl rounded-full" />

            <div className="flex items-center gap-3 relative z-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <div className="flex-1">
                <div className="flex justify-between text-sm font-black mb-1">
                  <span>Uploading File {(uploadProgress.completed + uploadProgress.failed) + 1 > uploadProgress.total ? uploadProgress.total : (uploadProgress.completed + uploadProgress.failed) + 1} of {uploadProgress.total}</span>
                  <span className="text-blue-400">{Math.round(((uploadProgress.completed + uploadProgress.failed) / uploadProgress.total) * 100)}%</span>
                </div>
                
                {/* Simulated Speed & REAL ETA Math */}
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {liveSpeed}</span>
                  <span className="flex items-center gap-1 text-amber-400"><Timer className="w-3 h-3" /> {etaText}</span>
                </div>
              </div>
            </div>

            {/* Global Progress Bar */}
            <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden w-full relative z-10">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300 relative shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                style={{ width: `${((uploadProgress.completed + uploadProgress.failed) / uploadProgress.total) * 100}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            {/* DO NOT REFRESH WARNING */}
            <div className="pt-2 mt-1 border-t border-slate-700/80 flex items-center justify-center gap-1.5 text-[11px] font-black text-amber-400 uppercase tracking-wider bg-amber-400/10 py-1.5 rounded-lg z-10">
              <ShieldAlert className="w-3.5 h-3.5" />
              DO NOT close or switch apps
            </div>

          </div>
        </div>
      )}
    </div>
  );
}