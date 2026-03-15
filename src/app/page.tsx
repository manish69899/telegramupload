'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Moon, Sun, Upload, X, CheckCircle2, 
  AlertCircle, Loader2, FileText, 
  GraduationCap, Send, Link as LinkIcon, MessageSquare,
  Heart, Copy, Check, XCircle, FolderOpen, Sparkles, Zap, MessageCircle, Trash2, Activity, Timer, ShieldAlert,
  FileBox, Image as ImageIcon, Archive, ChevronDown, ChevronUp, 
  RefreshCw, Share2, Coffee, Bell, Calendar, Award, Star, Crown,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Eye, Settings
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
  category?: string;
  preview?: string;
}

interface LinkItem {
  id: string;
  url: string;
  description: string;
  status: UploadStatus;
  error?: string;
  category?: string;
}

interface UserFormData {
  name?: string;
  message?: string;
}

interface ExamNotification {
  id: string;
  name: string;
  date: string;
  beforeMessage: string;
  dayMessage: string;
  enabled: boolean;
}

// ============================================
// 🔧 CONFIGURATION - SAB KUCH YAHAN SET KARO
// ============================================
const CONFIG = {
  TELEGRAM_USERNAME: 'pyqera_admin',
  SERVICE_URL: 'https://telegram-file-upload-3gal.onrender.com',
  MAX_FILE_BYTES: 1.5 * 1024 * 1024 * 1024,
  
  SHARE_TEXT: '📚 PYQERA - Free PYQs & Notes!\n\n✅ All subjects PYQs\n✅ Handwritten Notes\n✅ Study Materials\n\nJoin Now! 🚀',
  
  // Links - '#' = Hidden
  LINKS: {
    CHANNEL: 'https://t.me/pyqera',
    NOTES_CHANNEL: '#',
    DISCUSSION_GROUP: '#',
    INSTAGRAM: '#',
    YOUTUBE: '#',
    WHATSAPP: '#',
    WEBSITE: 'https://pyqera.pages.dev',
    SUPPORT: 'https://pyqerasupport.pages.dev',
  },
  

  
  // Exam Notifications - Admin set karega
  // ⚠️ IMPORTANT: Date must be FUTURE date (YYYY-MM-DD format)
  // Agar date beet chuki hai to exam show NAHI hoga!
  EXAMS: [
    {
      id: '1',
      name: 'BCA 3rd Sem Exams',
      date: '2025-07-15',                    // 👈 Future date dalna zaroori hai!
      beforeMessage: '📚 Exam is near! Start studying now. All the best! 🎯',
      dayMessage: '🎯 Best of luck for your exam! You got this! 💪',
      enabled: true,
    },
    {
      id: '2',
      name: 'B.Tech End Sem',
      date: '2025-07-25',                    // 👈 Future date dalna zaroori hai!
      beforeMessage: '📚 Exam is tomorrow! Last minute revision! 📖',
      dayMessage: '🎯 All the best for your exam today! 🍀',
      enabled: true,
    },
  ],
};
// ============================================

// Helper Functions
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

function getFileIcon(fileName: string, className: string = "w-5 h-5") {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext || '')) return <FileBox className={`${className} text-red-500`} />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <ImageIcon className={`${className} text-emerald-500`} />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return <Archive className={`${className} text-amber-500`} />;
  if (['doc', 'docx'].includes(ext || '')) return <FileText className={`${className} text-blue-500`} />;
  return <FileText className={`${className} text-slate-500`} />;
}

function isImage(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
}

function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

// Categories
const CATEGORIES = [
  { id: 'pyqs', label: '📚 PYQs (Previous Year Questions)', icon: '📚' },
  { id: 'notes', label: '📝 Notes & Study Material', icon: '📝' },
  { id: 'projects', label: '📊 Projects & Assignments', icon: '📊' },
  { id: 'videos', label: '🎥 Video Lectures', icon: '🎥' },
  { id: 'ebooks', label: '📖 E-Books & PDFs', icon: '📖' },
  { id: 'tips', label: '💡 Tips & Tricks', icon: '💡' },
];

const BOARD_CATEGORIES = [
  { id: '10th', label: '📖 10th Board', icon: '📖' },
  { id: '11th', label: '📘 11th Board', icon: '📘' },
  { id: '12th', label: '📕 12th Board', icon: '📕' },
  { id: 'bca', label: '🎓 BCA', icon: '🎓' },
  { id: 'mca', label: '🎓 MCA', icon: '🎓' },
  { id: 'btech', label: '⚙️ B.Tech', icon: '⚙️' },
  { id: 'other', label: '📚 Other', icon: '📚' },
];

// Motivational Messages
const MOTIVATIONAL_MESSAGES = [
  "🌟 Amazing! You're helping students ace their exams!",
  "🚀 Superhero alert! Your contribution matters!",
  "💪 You're making education accessible for everyone!",
  "🏆 Champion move! Students will thank you!",
  "⭐ Star contributor! Keep shining!",
  "🎯 Perfect shot! Knowledge shared is knowledge multiplied!",
  "❤️ Heart of gold! You're changing lives!",
  "🔥 On fire! Your generosity is unmatched!",
  "👑 Royalty status! You're a true leader!",
  "💎 Diamond quality! Premium content alert!",
];

const getMessage = () => MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];

// Badge System
const BADGES = [
  { count: 1, badge: '🤝 Helper', text: 'Started helping juniors!' },
  { count: 3, badge: '⭐ Rising Star', text: 'Helping juniors with generous hand!' },
  { count: 5, badge: '🌟 Star Contributor', text: 'Making a real difference!' },
  { count: 10, badge: '👑 Champion', text: 'True community leader!' },
  { count: 20, badge: '💎 Legend', text: 'Unstoppable force of good!' },
];

const getBadge = (count: number, hasName: boolean) => {
  if (!hasName || count < 1) return null;
  for (let i = BADGES.length - 1; i >= 0; i--) {
    if (count >= BADGES[i].count) return BADGES[i];
  }
  return null;
};

// Auto-detect category
const autoDetectCategory = (fileName: string): string => {
  const name = fileName.toLowerCase();
  if (name.includes('pyq') || name.includes('question') || name.includes('paper') || name.includes('exam')) return 'pyqs';
  if (name.includes('note') || name.includes('lecture') || name.includes('chapter')) return 'notes';
  if (name.includes('project') || name.includes('assignment') || name.includes('lab')) return 'projects';
  if (name.includes('video') || name.includes('mp4')) return 'videos';
  if (name.includes('book') || name.includes('ebook')) return 'ebooks';
  if (name.includes('tip') || name.includes('trick')) return 'tips';
  return 'notes';
};

// UI Helpers
const getRowClass = (status: UploadStatus, theme: string) => {
  const isDark = theme === 'dark';
  if (status === 'uploading') return `bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 shadow-lg shadow-blue-500/10`;
  if (status === 'completed') return `bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700`;
  if (status === 'error') return `bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700`;
  return `bg-white dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 hover:border-blue-400`;
};

const getIconClass = (status: UploadStatus) => {
  if (status === 'uploading') return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
  if (status === 'completed') return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400';
  if (status === 'error') return 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400';
  return 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300';
};

// Success Effects
const playSuccessSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
};

const triggerConfetti = () => {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
  script.onload = () => {
    if ((window as any).confetti) {
      (window as any).confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
        zIndex: 9999
      });
    }
  };
  document.body.appendChild(script);
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function HomePage() {
  // State
  const [items, setItems] = useState<UploadItem[]>([]);
  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [newLink, setNewLink] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  
  // Form data
  const [formData, setFormData] = useState<UserFormData>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pyqera_userdata');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  
  // Drag states
  const [isDragging, setIsDragging] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounter = useRef(0);

  // UI states
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState<'files' | 'links'>('files');
  const [linkCopied, setLinkCopied] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; failed: number; total: number } | null>(null);
  const [liveSpeed, setLiveSpeed] = useState('0.0 MB/s');
  const [etaText, setEtaText] = useState('Calculating...');
  const itemsRef = useRef(items);
  const [showVisibilityWarning, setShowVisibilityWarning] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Batch Operations
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [batchCategory, setBatchCategory] = useState('');
  const [batchDescription, setBatchDescription] = useState('');

  // File Preview
  const [previewItem, setPreviewItem] = useState<UploadItem | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [showPreview, setShowPreview] = useState(false);

  // Pull to Refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);

  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForItem, setCategoryForItem] = useState<string | null>(null);

  // Stats
  const [totalUploads, setTotalUploads] = useState(0);

  // Swipe
  const [swipeItem, setSwipeItem] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);

  // Toast timer
  const [toastTimer, setToastTimer] = useState<number | null>(null);

  // Sync ref
  useEffect(() => { itemsRef.current = items; }, [items]);

  // Save form data
  useEffect(() => {
    localStorage.setItem('pyqera_userdata', JSON.stringify(formData));
  }, [formData]);

  // Load total uploads
  useEffect(() => {
    const saved = localStorage.getItem('pyqera_total_uploads');
    if (saved) setTotalUploads(parseInt(saved));
  }, []);

  // Global Drag & Drop
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
      if (e.dataTransfer?.files?.length) addFiles(Array.from(e.dataTransfer.files));
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

  // Anti-refresh & Wake Lock
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = 'Upload in progress!';
      }
    };
    const handleVisibility = () => {
      if (document.hidden && isUploading) setShowVisibilityWarning(true);
    };

    if (isUploading) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibility);
      if ('wakeLock' in navigator) {
        (navigator as any).wakeLock.request('screen').then((lock: any) => { wakeLockRef.current = lock; }).catch(() => {});
      }
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isUploading]);

  // Theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (isDark: boolean) => {
      setTheme(isDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', isDark);
    };
    updateTheme(mediaQuery.matches);
    mediaQuery.addEventListener('change', (e) => updateTheme(e.matches));
    return () => mediaQuery.removeEventListener('change', () => {});
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Speed & ETA
  useEffect(() => {
    if (!isUploading) return;
    const interval = setInterval(() => {
      const speed = (Math.random() * 3.5 + 1.5).toFixed(1);
      setLiveSpeed(`${speed} MB/s`);

      const active = itemsRef.current.filter(i => i.status === 'uploading' || i.status === 'pending');
      if (active.length > 0) {
        let remaining = 0;
        active.forEach(f => remaining += f.size * ((100 - (f.progress || 0)) / 100));
        const secs = Math.max(1, Math.round(remaining / (parseFloat(speed) * 1024 * 1024)));
        setEtaText(secs > 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isUploading]);

  // Pull to Refresh
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current > 0 && window.scrollY === 0) {
        const distance = e.touches[0].clientY - touchStartY.current;
        if (distance > 0) setPullDistance(Math.min(distance, 100));
      }
    };
    const handleTouchEnd = () => {
      if (pullDistance > 80) {
        setIsRefreshing(true);
        setTimeout(() => { setIsRefreshing(false); setPullDistance(0); }, 1000);
      } else {
        setPullDistance(0);
      }
      touchStartY.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance]);

  // Notification permission & schedule
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // Don't auto-request, wait for user click
    }

    const checkExams = () => {
      if (Notification.permission !== 'granted') return;

      const now = new Date();
      CONFIG.EXAMS.forEach(exam => {
        if (!exam.enabled) return;
        const examDate = new Date(exam.date);
        const days = daysBetween(now, examDate);

        const lastNotif = localStorage.getItem(`notif_${exam.id}`);
        const today = now.toDateString();

        if (days === 1 && lastNotif !== `${today}_before`) {
          new Notification(`📚 ${exam.name}`, { body: exam.beforeMessage, icon: '/favicon.ico' });
          localStorage.setItem(`notif_${exam.id}`, `${today}_before`);
        } else if (days === 0 && lastNotif !== `${today}_day`) {
          new Notification(`🎯 ${exam.name}`, { body: exam.dayMessage, icon: '/favicon.ico' });
          localStorage.setItem(`notif_${exam.id}`, `${today}_day`);
        }
      });
    };

    checkExams();
    const interval = setInterval(checkExams, 3600000);
    return () => clearInterval(interval);
  }, []);

  // Add files
  const addFiles = useCallback((files: File[]) => {
    setError(null);
    files.forEach(file => {
      if (file.size > CONFIG.MAX_FILE_BYTES) {
        setError(`File too large: ${file.name}`);
        return;
      }
      if (file.size === 0) {
        setError(`Empty file: ${file.name}`);
        return;
      }

      let previewUrl: string | undefined;
      if (isImage(file)) previewUrl = URL.createObjectURL(file);
      const autoCat = autoDetectCategory(file.name);

      setItems(prev => {
        if (prev.some(i => i.name === file.name && i.size === file.size)) return prev;
        return [...prev, { id: generateId(), file, name: file.name, size: file.size, status: 'pending', progress: 0, category: autoCat, preview: previewUrl }];
      });
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  }, [addFiles]);

  // Update functions
  const updateItemDescription = (id: string, description: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, description } : i));
  };

  const updateItemCategory = (id: string, category: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, category } : i));
  };

  // Add link
  const addLink = () => {
    if (!newLink.trim()) return;
    try { new URL(newLink); } catch { setError('Invalid URL'); return; }
    setLinkItems(prev => [...prev, { id: generateId(), url: newLink, description: newLinkDesc, status: 'pending' }]);
    setNewLink('');
    setNewLinkDesc('');
    setError(null);
  };

  // Cancel upload
  const cancelUpload = async (id: string, type: 'file' | 'link') => {
    try {
      await fetch(`${CONFIG.SERVICE_URL}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: id }) });
    } catch {}

    if (type === 'file') {
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: 'Cancelled', progress: 0 } : i));
    } else {
      setLinkItems(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: 'Cancelled' } : i));
    }
  };

  // Upload file
  const uploadFile = async (item: UploadItem): Promise<boolean> => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i));

    const progressInterval = setInterval(() => {
      setItems(prev => prev.map(i => i.id === item.id && i.status === 'uploading' ? { ...i, progress: Math.min(95, (i.progress || 0) + Math.random() * 8 + 2) } : i));
    }, 500);

    const categoryLabel = CATEGORIES.find(c => c.id === item.category)?.label || 'General';
    const caption = `📚 PYQERA\n👤 ${formData.name || 'Anonymous'}\n💬 ${formData.message || 'N/A'}\n📄 ${item.name}\n📁 ${categoryLabel}\n📝 ${item.description || 'No description'}\n📊 ${formatFileSize(item.size)}`;
    const fd = new FormData();
    fd.append('file', item.file);
    fd.append('fileName', item.name);
    fd.append('caption', caption);

    try {
      const res = await fetch(`${CONFIG.SERVICE_URL}/upload`, { method: 'POST', headers: { 'X-Upload-Id': item.id }, body: fd });
      clearInterval(progressInterval);

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i));
          return true;
        }
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: result.error || 'Failed', progress: 0 } : i));
        return false;
      }

      let errorMsg = 'Upload failed';
      if (res.status === 413) errorMsg = 'File too large (max 1.5GB)';
      else if (res.status === 429) errorMsg = 'Too many requests';
      else if (res.status === 503) errorMsg = 'Service initializing';

      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: errorMsg, progress: 0 } : i));
      return false;
    } catch (err) {
      clearInterval(progressInterval);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: 'Network error', progress: 0 } : i));
      return false;
    }
  };

  // Submit link
  const submitLink = async (item: LinkItem): Promise<boolean> => {
    setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));

    try {
      const res = await fetch(`${CONFIG.SERVICE_URL}/upload-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Upload-Id': item.id },
        body: JSON.stringify({ caption: `📚 PYQERA Link\n👤 ${formData.name || 'Anonymous'}\n🔗 ${item.url}\n📝 ${item.description || 'N/A'}`, url: item.url }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed' } : i));
          return true;
        }
        setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: result.error || 'Failed' } : i));
        return false;
      }

      setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: 'Failed to submit' } : i));
      return false;
    } catch {
      setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: 'Network error' } : i));
      return false;
    }
  };

  // Start upload
  const startUpload = async () => {
    const pendingFiles = items.filter(i => i.status === 'pending' || i.status === 'error');
    const pendingLinks = linkItems.filter(i => i.status === 'pending' || i.status === 'error');
    if (pendingFiles.length === 0 && pendingLinks.length === 0) return;

    setIsUploading(true);
    setShowVisibilityWarning(false);
    setError(null);
    setSuccessMessage(null);

    const total = pendingFiles.length + pendingLinks.length;
    let completed = 0, failed = 0;
    setUploadProgress({ total, completed: 0, failed: 0 });

    for (const item of pendingFiles) {
      const success = await uploadFile(item);
      success ? completed++ : failed++;
      setUploadProgress({ total, completed, failed });
    }

    for (const item of pendingLinks) {
      const success = await submitLink(item);
      success ? completed++ : failed++;
      setUploadProgress({ total, completed, failed });
    }

    setIsUploading(false);

    if (completed > 0) {
      playSuccessSound();
      triggerConfetti();

      const newTotal = totalUploads + completed;
      setTotalUploads(newTotal);
      localStorage.setItem('pyqera_total_uploads', newTotal.toString());
      setSuccessCount(completed);

      const badge = getBadge(newTotal, !!formData.name);
      setSuccessMessage(badge ? `${badge.badge} ${badge.text} ${getMessage()}` : getMessage());

      if (toastTimer) clearTimeout(toastTimer);
      const timer = window.setTimeout(() => { setUploadProgress(null); setSuccessMessage(null); }, 5000);
      setToastTimer(timer);
    }

    setTimeout(() => setUploadProgress(null), 3000);
  };

  // Remove functions
  const removeItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item?.preview) URL.revokeObjectURL(item.preview);
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedItems(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const removeLink = (id: string) => setLinkItems(prev => prev.filter(i => i.id !== id));

  const clearCompleted = () => {
    setItems(prev => prev.filter(i => i.status !== 'completed'));
    setLinkItems(prev => prev.filter(i => i.status !== 'completed'));
    setSuccessMessage(null);
  };

  // Batch operations
  const toggleSelectAll = () => {
    const pendingIds = items.filter(i => i.status === 'pending').map(i => i.id);
    if (selectedItems.size === pendingIds.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(pendingIds));
  };

  const applyBatchCategory = () => {
    if (!batchCategory) return;
    setItems(prev => prev.map(i => selectedItems.has(i.id) ? { ...i, category: batchCategory } : i));
    setShowBatchPanel(false);
  };

  const applyBatchDescription = () => {
    if (!batchDescription) return;
    setItems(prev => prev.map(i => selectedItems.has(i.id) ? { ...i, description: batchDescription } : i));
    setShowBatchPanel(false);
    setBatchDescription('');
  };

  // Preview
  const openPreview = (item: UploadItem) => {
    if (!isImage(item.file)) return;
    setPreviewItem(item);
    setShowPreview(true);
    setPreviewZoom(1);
  };

  // Native share
  const nativeShare = async (item: UploadItem) => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: item.name, text: `Check out ${item.name}`, files: [item.file] });
    } catch {}
  };

  // Swipe handlers
  const handleSwipeStart = (e: React.TouchEvent, id: string) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipeItem(id);
  };

  const handleSwipeMove = (e: React.TouchEvent, id: string) => {
    if (swipeItem !== id) return;
    const diff = touchStartX.current - e.touches[0].clientX;
    setSwipeX(Math.max(0, diff));
  };

  const handleSwipeEnd = (id: string) => {
    if (swipeX > 80) removeItem(id);
    setSwipeX(0);
    setSwipeItem(null);
  };

  // Calculations
  const pendingCount = items.filter(i => i.status === 'pending' || i.status === 'error').length + linkItems.filter(i => i.status === 'pending' || i.status === 'error').length;
  const totalItems = items.length + linkItems.length;
  const completedCount = items.filter(i => i.status === 'completed').length + linkItems.filter(i => i.status === 'completed').length;
  const uploadingCount = items.filter(i => i.status === 'uploading').length + linkItems.filter(i => i.status === 'uploading').length;

  const currentBadge = useMemo(() => getBadge(totalUploads, !!formData.name), [totalUploads, formData.name]);

  // Link availability
  const hasChannel = CONFIG.LINKS.CHANNEL !== '#';
  const hasSocial = CONFIG.LINKS.INSTAGRAM !== '#' || CONFIG.LINKS.YOUTUBE !== '#' || CONFIG.LINKS.WHATSAPP !== '#' || CONFIG.LINKS.NOTES_CHANNEL !== '#' || CONFIG.LINKS.DISCUSSION_GROUP !== '#' || CONFIG.LINKS.WEBSITE !== '#';
  const hasSupport = CONFIG.LINKS.SUPPORT !== '#';

  // Exam data
  const examData = CONFIG.EXAMS.filter(e => e.enabled).map(exam => ({
    ...exam,
    daysLeft: daysBetween(new Date(), new Date(exam.date))
  })).filter(e => e.daysLeft >= 0);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 text-slate-900'}`}>

      {/* Global Drag Overlay */}
      <AnimatePresence>
        {isGlobalDragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-blue-900/70 backdrop-blur-md border-4 border-dashed border-blue-400 m-4 rounded-2xl">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: Infinity }} className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl">
              <Upload className="w-12 h-12 text-blue-600" />
            </motion.div>
            <h2 className="text-3xl font-black text-white mt-6">Drop PYQs Here!</h2>
            <p className="text-blue-200 font-bold mt-2">Release to add files</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pull to Refresh */}
      <motion.div style={{ height: pullDistance }} className="fixed top-0 left-0 right-0 z-40 flex items-center justify-center bg-blue-500/20">
        <motion.div animate={{ rotate: isRefreshing ? 360 : pullDistance * 2 }} transition={{ duration: isRefreshing ? 1 : 0, repeat: isRefreshing ? Infinity : 0 }}>
          <RefreshCw className="w-6 h-6 text-blue-600" />
        </motion.div>
      </motion.div>

      {/* Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${theme === 'dark' ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-gray-200'}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 group">
            <motion.div whileHover={{ scale: 1.1, rotate: 5 }} whileTap={{ scale: 0.95 }} className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <GraduationCap className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h1 className="text-lg font-black">PYQERA</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500">Community</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentBadge && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
                {currentBadge.badge}
              </motion.span>
            )}
            <motion.button onClick={toggleTheme} whileHover={{ scale: 1.1, rotate: 15 }} whileTap={{ scale: 0.9 }} className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}>
              <AnimatePresence mode="wait">
                {theme === 'dark' ? (
                  <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><Sun className="w-5 h-5 text-amber-400" /></motion.div>
                ) : (
                  <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><Moon className="w-5 h-5 text-slate-600" /></motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </header>

      {/* Exam Countdown */}
      {examData.length > 0 && (
        <div className={`border-b ${theme === 'dark' ? 'bg-blue-900/20 border-slate-800' : 'bg-blue-50 border-blue-100'}`}>
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-4 overflow-x-auto">
            {examData.map(exam => (
              <div key={exam.id} className="flex items-center gap-2 flex-shrink-0">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium">{exam.name}</span>
                <span className={`text-xs font-black ${exam.daysLeft <= 3 ? 'text-red-500' : 'text-blue-500'}`}>
                  ⏰ {exam.daysLeft === 0 ? 'TODAY!' : `${exam.daysLeft}d`}
                </span>
              </div>
            ))}
            <button
              onClick={() => {
                if ('Notification' in window) {
                  Notification.requestPermission().then(p => {
                    if (p === 'granted') alert('✅ Notifications enabled! You will be reminded before exams.');
                    else alert('❌ Please enable notifications in browser settings.');
                  });
                } else {
                  alert('❌ Notifications not supported in this browser.');
                }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500 text-white text-xs font-bold flex-shrink-0 hover:bg-blue-600 transition-colors"
            >
              <Bell className="w-3 h-3" /> Remind Me
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 2, repeat: Infinity }} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold mb-3 border border-blue-200 dark:border-blue-800">
            <Sparkles className="w-3 h-3" /> Share & Help Students
          </motion.div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-2">
            Upload Notes & <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">PYQs</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Be the one who helps juniors!</p>
        </motion.div>

        {/* Grid */}
        <div className="grid lg:grid-cols-2 gap-4">

          {/* Upload Panel */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`rounded-2xl border overflow-hidden shadow-xl ${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-gray-200'} backdrop-blur-xl`}>

            {/* Tabs */}
            <div className={`flex border-b ${theme === 'dark' ? 'border-slate-800' : 'border-gray-100'}`}>
              {['files', 'links'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-colors relative ${activeTab === tab ? 'text-blue-500' : 'text-slate-500'}`}>
                  {tab === 'files' ? <Upload className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'files' && items.length > 0 && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-500 text-white">{items.length}</span>}
                  {tab === 'links' && linkItems.length > 0 && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-500 text-white">{linkItems.length}</span>}
                  {activeTab === tab && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* Warning */}
              <AnimatePresence>
                {showVisibilityWarning && isUploading && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-3 p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    Don't minimize! Upload might pause.
                    <button onClick={() => setShowVisibilityWarning(false)} className="ml-auto"><X className="w-4 h-4" /></button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div className="space-y-3">
                  {/* Drop Zone */}
                  <motion.div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    whileHover={{ scale: 1.01 }}
                    animate={isDragging ? { scale: 1.02 } : {}}
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : theme === 'dark' ? 'border-slate-700 hover:border-slate-600' : 'border-gray-300 hover:border-blue-400'}`}
                  >
                    <motion.div whileHover={{ scale: 1.1 }} className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                      <FolderOpen className="w-6 h-6 text-slate-400" />
                    </motion.div>
                    <p className="text-sm font-bold">Drop files or click here</p>
                    <p className="text-xs text-slate-500 mt-1">PDF, Images, Docs - Unlimited!</p>
                    <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </motion.div>

                  {/* Batch Operations */}
                  {items.filter(i => i.status === 'pending').length > 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-2">
                        <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                          {selectedItems.size === items.filter(i => i.status === 'pending').length ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 border-2 border-blue-500 rounded" />}
                          Select All ({items.filter(i => i.status === 'pending').length})
                        </button>
                        {selectedItems.size > 0 && (
                          <button onClick={() => setShowBatchPanel(!showBatchPanel)} className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            Batch Edit ({selectedItems.size})
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {showBatchPanel && selectedItems.size > 0 && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                            <select value={batchCategory} onChange={(e) => setBatchCategory(e.target.value)} className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border bg-transparent">
                              <option value="">Set Category for All</option>
                              {[...CATEGORIES, ...BOARD_CATEGORIES].map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                            {batchCategory && (
                              <button onClick={applyBatchCategory} className="w-full py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600">Apply Category</button>
                            )}
                            <input type="text" placeholder="Description for all..." value={batchDescription} onChange={(e) => setBatchDescription(e.target.value)} className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border bg-transparent" />
                            {batchDescription && (
                              <button onClick={applyBatchDescription} className="w-full py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600">Apply Description</button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* Empty State */}
                  {items.length === 0 && !isDragging && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} className="py-6 flex flex-col items-center">
                      <FileBox className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-xs font-bold text-slate-400">No files selected yet</p>
                    </motion.div>
                  )}

                  {/* Files List */}
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {items.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: swipeItem === item.id ? -swipeX : 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ delay: idx * 0.03 }}
                        onTouchStart={(e) => handleSwipeStart(e, item.id)}
                        onTouchMove={(e) => handleSwipeMove(e, item.id)}
                        onTouchEnd={() => handleSwipeEnd(item.id)}
                        className={`rounded-xl overflow-hidden border transition-all ${getRowClass(item.status, theme)} ${selectedItems.has(item.id) ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        <div className="flex items-center gap-2.5 p-2.5">
                          {/* Checkbox */}
                          {item.status === 'pending' && !isUploading && (
                            <button onClick={() => setSelectedItems(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })} className="flex-shrink-0">
                              {selectedItems.has(item.id) ? <CheckCircle2 className="w-4 h-4 text-blue-500" /> : <div className="w-4 h-4 border-2 border-slate-400 dark:border-slate-500 rounded" />}
                            </button>
                          )}

                          {/* Icon/Progress */}
                          <div className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center shadow-sm ${getIconClass(item.status)}`}>
                            {item.status === 'completed' ? (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}><CheckCircle2 className="w-5 h-5" /></motion.div>
                            ) : item.status === 'error' ? (
                              <AlertCircle className="w-5 h-5" />
                            ) : item.status === 'uploading' ? (
                              <div className="relative w-9 h-9">
                                <svg className="w-9 h-9 -rotate-90">
                                  <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-blue-200 dark:text-blue-900/50" />
                                  <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="88" strokeDashoffset={88 - (88 * (item.progress || 0)) / 100} className="text-blue-500 transition-all duration-300" strokeLinecap="round" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-blue-600 dark:text-blue-400">{Math.round(item.progress || 0)}</span>
                              </div>
                            ) : getFileIcon(item.name)}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${item.status === 'error' ? 'text-red-600 dark:text-red-400' : item.status === 'uploading' ? 'text-blue-700 dark:text-blue-300' : ''}`}>{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <p className="text-[10px] font-semibold text-slate-500">{formatFileSize(item.size)}</p>
                              {item.category && <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{CATEGORIES.find(c => c.id === item.category)?.icon || ''}</span>}
                              {item.description && <p className="text-[10px] font-semibold text-blue-500 truncate">• {item.description}</p>}
                              {item.status === 'uploading' && <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="text-[10px] font-bold text-blue-500 ml-1 flex items-center gap-0.5"><Activity className="w-3 h-3" /> Sending...</motion.p>}
                            </div>
                            {item.error && <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {item.error}</p>}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {/* Preview - Only for completed images */}
                            {item.status === 'completed' && isImage(item.file) && (
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => openPreview(item)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Preview">
                                <Eye className="w-4 h-4 text-slate-500" />
                              </motion.button>
                            )}

                            {/* Native Share */}
                            {item.status === 'pending' && 'share' in navigator && (
                              <motion.button whileHover={{ scale: 1.1, rotate: 5 }} whileTap={{ scale: 0.9 }} onClick={() => nativeShare(item)} className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors" title="Share">
                                <Share2 className="w-4 h-4 text-slate-500 hover:text-blue-500" />
                              </motion.button>
                            )}

                            {/* Cancel Upload */}
                            {item.status === 'uploading' && (
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => cancelUpload(item.id, 'file')} className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-500 transition-colors">
                                <XCircle className="w-4 h-4" />
                              </motion.button>
                            )}

                            {/* Pending/Error Actions */}
                            {(item.status === 'pending' || item.status === 'error') && !isUploading && (
                              <>
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setExpandedDesc(expandedDesc === item.id ? null : item.id)} className={`p-1.5 rounded-lg transition-colors ${expandedDesc === item.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-500' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-500'}`}>
                                  <MessageCircle className="w-4 h-4" />
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setCategoryForItem(item.id); setShowCategoryModal(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-slate-500">
                                  <FolderOpen className="w-4 h-4" />
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-500">
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </>
                            )}

                            {/* Queue Cancel */}
                            {item.status === 'pending' && isUploading && (
                              <button onClick={() => cancelUpload(item.id, 'file')} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-slate-500 hover:text-red-500">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Upload Shimmer */}
                        {item.status === 'uploading' && (
                          <div className="h-0.5 w-full bg-blue-200 dark:bg-blue-900/30 overflow-hidden">
                            <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="h-full w-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
                          </div>
                        )}

                        {/* Description Input */}
                        <AnimatePresence>
                          {expandedDesc === item.id && (item.status === 'pending' || item.status === 'error') && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-2.5 pb-2.5">
                              <input type="text" placeholder="e.g., BCA 3rd Sem CN Notes" value={item.description || ''} onChange={(e) => updateItemDescription(item.id, e.target.value)} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border bg-transparent focus:outline-none focus:border-blue-500" autoFocus />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Links Tab */}
              {activeTab === 'links' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Paste any cloud link..." value={newLink} onChange={(e) => setNewLink(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border text-sm font-bold bg-transparent focus:outline-none focus:border-blue-500" />
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={addLink} disabled={!newLink.trim() || isUploading} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors">
                      <Zap className="w-4 h-4" />
                    </motion.button>
                  </div>
                  <input type="text" placeholder="Description (optional)" value={newLinkDesc} onChange={(e) => setNewLinkDesc(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm font-bold bg-transparent focus:outline-none focus:border-blue-500" />

                  {/* Empty State */}
                  {linkItems.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} className="py-6 flex flex-col items-center">
                      <LinkIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-xs font-bold text-slate-400">No links added yet</p>
                    </motion.div>
                  )}

                  {/* Links List */}
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {linkItems.map((item, idx) => (
                      <motion.div key={item.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ delay: idx * 0.03 }} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${getRowClass(item.status, theme)}`}>
                        <div className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center shadow-sm ${getIconClass(item.status)}`}>
                          {item.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : item.status === 'error' ? <AlertCircle className="w-5 h-5" /> : item.status === 'uploading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-blue-500 truncate">{item.url}</p>
                          {item.description && <p className="text-[10px] font-semibold text-slate-500 truncate">{item.description}</p>}
                          {item.error && <p className="text-[10px] font-bold text-red-500 mt-0.5">{item.error}</p>}
                        </div>
                        <div className="flex gap-1">
                          {item.status === 'uploading' && (
                            <button onClick={() => cancelUpload(item.id, 'link')} className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-500 transition-colors">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {(item.status === 'pending' || item.status === 'error') && !isUploading && (
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeLink(item.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form & Submit */}
              <AnimatePresence>
                {totalItems > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 pt-3 border-t dark:border-slate-800">
                    <div className="flex gap-2 mb-3">
                      <input type="text" placeholder="Your name (optional)" value={formData.name || ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border text-xs font-bold bg-transparent focus:outline-none focus:border-blue-500" />
                      <input type="text" placeholder="Subject/Semester" value={formData.message || ''} onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border text-xs font-bold bg-transparent focus:outline-none focus:border-blue-500" />
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-3">
                      <div className="flex gap-3">
                        {totalItems > 0 && <span>{totalItems} total</span>}
                        {completedCount > 0 && <span className="text-emerald-500">{completedCount} done</span>}
                        {uploadingCount > 0 && <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="text-blue-500">{uploadingCount} uploading</motion.span>}
                      </div>
                      {completedCount > 0 && <button onClick={clearCompleted} disabled={isUploading} className="text-red-500 disabled:opacity-50">Clear done</button>}
                    </div>

                    {/* Submit */}
                    {pendingCount > 0 && (
                      <motion.button onClick={startUpload} disabled={isUploading} whileHover={{ scale: isUploading ? 1 : 1.01 }} whileTap={{ scale: isUploading ? 1 : 0.99 }} className={`w-full py-3.5 rounded-xl text-white text-sm font-black transition-all flex items-center justify-center gap-2 ${isUploading ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25'}`}>
                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-blue-400" /> : <Send className="w-5 h-5" />}
                        {isUploading ? 'UPLOADING... DO NOT CLOSE' : `UPLOAD ALL (${pendingCount})`}
                      </motion.button>
                    )}

                    {/* Badge Hint */}
                    {formData.name && pendingCount > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-center">
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          {currentBadge ? <>Upload complete to earn: <span className="text-amber-500">{currentBadge.badge}</span></> : '🌟 Add your name to earn contributor badges!'}
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Right Side */}
          <div className="space-y-4">
            {/* Telegram */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`rounded-2xl border p-5 ${theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-gray-200'} backdrop-blur-xl shadow-xl relative overflow-hidden group`}>
              <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }} transition={{ duration: 3, repeat: Infinity }} className="absolute -top-10 -right-10 w-32 h-32 bg-[#0088cc]/20 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div whileHover={{ scale: 1.1 }} className="w-11 h-11 rounded-xl bg-[#0088cc] flex items-center justify-center shadow-lg shadow-[#0088cc]/30">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </motion.div>
                  <div>
                    <span className="text-[10px] font-black text-[#0088cc] uppercase tracking-widest">Quick Option</span>
                    <h3 className="text-lg font-black">Send via Telegram</h3>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Share files directly on Telegram. Quick response!</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {['Unlimited Files', 'Any Link', 'Quick Reply', 'Direct Chat'].map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0088cc]" /> {f}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <motion.a href={`https://t.me/${CONFIG.TELEGRAM_USERNAME}`} target="_blank" rel="noreferrer" whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-black rounded-xl shadow-lg shadow-[#0088cc]/25 transition-colors">
                    <Send className="w-4 h-4" /> OPEN TELEGRAM
                  </motion.a>
                  <motion.button onClick={() => { navigator.clipboard.writeText(`https://t.me/${CONFIG.TELEGRAM_USERNAME}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="px-3 py-2.5 rounded-xl border transition-colors hover:bg-gray-50 dark:hover:bg-slate-800">
                    {linkCopied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Channel Section - Only if link provided */}
            {hasChannel && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border p-5 bg-gradient-to-br from-violet-500/10 via-blue-500/5 to-cyan-500/5 dark:from-violet-900/20 dark:via-blue-900/10 dark:to-cyan-900/10 border-violet-200 dark:border-violet-800 shadow-xl relative overflow-hidden">
                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }} transition={{ duration: 3, repeat: Infinity }} className="absolute -top-10 -right-10 w-32 h-32 bg-violet-500/20 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                      <GraduationCap className="w-5 h-5 text-white" />
                    </motion.div>
                    <div>
                      <h3 className="text-lg font-black">📚 PYQERA Channel</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">All PYQs & Notes in one place!</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {['✅ All PYQs', '✅ Handwritten Notes', '✅ Study Material', '✅ Board Papers'].map((t, i) => (
                      <p key={i} className="text-xs font-bold text-slate-600 dark:text-slate-400">{t}</p>
                    ))}
                  </div>

                  <motion.a href={CONFIG.LINKS.CHANNEL} target="_blank" rel="noreferrer" whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 text-white text-sm font-black rounded-xl shadow-lg shadow-violet-500/25 mb-2">
                    <GraduationCap className="w-4 h-4" /> 📚 JOIN CHANNEL
                  </motion.a>

                  <div className="flex gap-2">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigator.clipboard.writeText(CONFIG.LINKS.CHANNEL)} className="flex-1 flex items-center justify-center gap-1 py-2 border rounded-lg text-xs font-bold hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </motion.button>
                    <motion.a href={`https://wa.me/?text=${encodeURIComponent(CONFIG.SHARE_TEXT + ' ' + CONFIG.LINKS.CHANNEL)}`} target="_blank" rel="noreferrer" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors">
                      <Share2 className="w-3.5 h-3.5" /> WhatsApp
                    </motion.a>
                    <motion.a href={`https://t.me/share/url?url=${encodeURIComponent(CONFIG.LINKS.CHANNEL)}&text=${encodeURIComponent(CONFIG.SHARE_TEXT)}`} target="_blank" rel="noreferrer" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-lg text-xs font-bold transition-colors">
                      <Send className="w-3.5 h-3.5" /> Telegram
                    </motion.a>
                  </div>

                  {/* Social Links */}
                  {hasSocial && (
                    <div className="mt-3 pt-3 border-t dark:border-slate-700">
                      <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase">Follow us:</p>
                      <div className="flex flex-wrap gap-2">
                        {CONFIG.LINKS.INSTAGRAM !== '#' && <motion.a href={CONFIG.LINKS.INSTAGRAM} target="_blank" rel="noreferrer" whileHover={{ scale: 1.1 }} className="px-2.5 py-1 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg text-xs font-bold">📸 Instagram</motion.a>}
                        {CONFIG.LINKS.YOUTUBE !== '#' && <motion.a href={CONFIG.LINKS.YOUTUBE} target="_blank" rel="noreferrer" whileHover={{ scale: 1.1 }} className="px-2.5 py-1 bg-red-500 text-white rounded-lg text-xs font-bold">📺 YouTube</motion.a>}
                        {CONFIG.LINKS.WHATSAPP !== '#' && <motion.a href={CONFIG.LINKS.WHATSAPP} target="_blank" rel="noreferrer" whileHover={{ scale: 1.1 }} className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold">📱 WhatsApp</motion.a>}
                        {CONFIG.LINKS.DISCUSSION_GROUP !== '#' && <motion.a href={CONFIG.LINKS.DISCUSSION_GROUP} target="_blank" rel="noreferrer" whileHover={{ scale: 1.1 }} className="px-2.5 py-1 bg-[#0088cc] text-white rounded-lg text-xs font-bold">💬 Discussion</motion.a>}
                        {CONFIG.LINKS.WEBSITE !== '#' && <motion.a href={CONFIG.LINKS.WEBSITE} target="_blank" rel="noreferrer" whileHover={{ scale: 1.1 }} className="px-2.5 py-1 bg-slate-600 text-white rounded-lg text-xs font-bold">🌐 Website</motion.a>}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Support - Only if link provided */}
            {hasSupport && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border p-5 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-red-500/5 dark:from-amber-900/20 dark:via-orange-900/10 dark:to-red-900/10 border-amber-200 dark:border-amber-800 shadow-xl">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <Coffee className="w-5 h-5 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="font-black">☕ Support PYQERA</h3>
                    <p className="text-xs text-slate-500">Keep it free for everyone!</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Love PYQERA? Help us keep it free!</p>
                <motion.a href={CONFIG.LINKS.SUPPORT} target="_blank" rel="noreferrer" whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white text-sm font-black rounded-xl shadow-lg shadow-amber-500/25">
                  <Coffee className="w-4 h-4" /> Buy us a coffee ☕
                </motion.a>
                <div className="mt-2 flex items-center justify-center gap-3 text-[10px] font-bold text-slate-500">
                  <span>🎁 Supporters get:</span>
                  <span className="text-amber-500">Premium Badge</span>
                  <span className="text-amber-500">Ad-free</span>
                </div>
              </motion.div>
            )}

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={`border-t py-3 ${theme === 'dark' ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-gray-200'} backdrop-blur-xl`}>
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-black">PYQERA</span>
          </div>
          <p className="text-xs font-bold text-slate-500">Built by students, for students</p>
        </div>
      </footer>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 50, x: '-50%' }} className="fixed bottom-4 left-1/2 z-50 w-[90%] sm:w-80">
            <div className="relative flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl shadow-xl overflow-hidden">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-bold flex-1">{error}</span>
              <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded"><XCircle className="w-4 h-4" /></button>
              <motion.div initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 5 }} className="absolute bottom-0 left-0 h-1 bg-white/50" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div initial={{ opacity: 0, y: -50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -50, x: '-50%' }} className="fixed top-20 left-1/2 z-50 w-[90%] sm:w-96">
            <div className="relative flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl shadow-2xl overflow-hidden">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}><CheckCircle2 className="w-5 h-5" /></motion.div>
              <div className="flex-1">
                <p className="text-sm font-bold">{successMessage}</p>
                {successCount > 0 && <p className="text-xs font-medium text-emerald-200">{successCount} files uploaded!</p>}
              </div>
              <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
              <motion.div initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 5 }} className="absolute bottom-0 left-0 h-1 bg-white/50" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Progress Toast */}
      <AnimatePresence>
        {isUploading && uploadProgress && (
          <motion.div initial={{ opacity: 0, y: 50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 50, x: '-50%' }} className="fixed bottom-4 left-1/2 z-50 w-[90%] sm:w-80">
            <div className="relative flex flex-col gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-2xl overflow-hidden">
              <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl" />
              <div className="flex items-center gap-2 relative z-10">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm font-black">
                    <span>Uploading {Math.min(uploadProgress.completed + uploadProgress.failed + 1, uploadProgress.total)}/{uploadProgress.total}</span>
                    <span className="text-blue-400">{Math.round(((uploadProgress.completed + uploadProgress.failed) / uploadProgress.total) * 100)}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {liveSpeed}</span>
                    <span className="flex items-center gap-1 text-amber-400"><Timer className="w-3 h-3" /> {etaText}</span>
                  </div>
                </div>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden relative z-10">
                <motion.div initial={{ width: '0%' }} animate={{ width: `${((uploadProgress.completed + uploadProgress.failed) / uploadProgress.total) * 100}%` }} transition={{ duration: 0.3 }} className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full relative">
                  <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1, repeat: Infinity }} className="absolute inset-0 bg-white/20" />
                </motion.div>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-black text-amber-400 uppercase pt-1 relative z-10">
                <ShieldAlert className="w-3 h-3" /> Do not close or switch apps
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Modal */}
      <AnimatePresence>
        {showCategoryModal && categoryForItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoryModal(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-4 shadow-2xl ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
              <h3 className="text-lg font-black mb-3">Select Category</h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {CATEGORIES.map(cat => (
                  <motion.button key={cat.id} onClick={() => { updateItemCategory(categoryForItem, cat.id); setShowCategoryModal(false); }} whileHover={{ scale: 1.01, x: 4 }} className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors">
                    <span className="text-lg">{cat.icon}</span>
                    <span className="font-bold text-sm">{cat.label}</span>
                  </motion.button>
                ))}
                <div className="border-t dark:border-slate-700 pt-2 mt-2">
                  <p className="text-[10px] font-bold text-slate-500 mb-1.5 px-1">Board Categories:</p>
                  {BOARD_CATEGORIES.map(cat => (
                    <motion.button key={cat.id} onClick={() => { updateItemCategory(categoryForItem, cat.id); setShowCategoryModal(false); }} whileHover={{ scale: 1.01, x: 4 }} className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="font-bold text-sm">{cat.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowCategoryModal(false)} className="mt-3 w-full py-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && previewItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPreview(false)} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }} onClick={e => e.stopPropagation()} className={`w-full max-w-2xl max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
              <div className={`flex items-center justify-between p-3 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-gray-200'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{previewItem.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(previewItem.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPreviewZoom(Math.max(0.5, previewZoom - 0.5))} className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700"><ZoomOut className="w-4 h-4" /></button>
                  <span className="text-xs font-bold">{previewZoom}x</span>
                  <button onClick={() => setPreviewZoom(Math.min(3, previewZoom + 0.5))} className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700"><ZoomIn className="w-4 h-4" /></button>
                  <button onClick={() => setShowPreview(false)} className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 ml-1"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="p-4 h-[60vh] overflow-auto flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                {previewItem.preview ? (
                  <motion.img src={previewItem.preview} alt={previewItem.name} style={{ transform: `scale(${previewZoom})` }} className="max-w-full max-h-full object-contain rounded-lg shadow-lg transition-transform" />
                ) : (
                  <div className="text-center">
                    <FileBox className="w-16 h-16 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">Preview only available for images</p>
                  </div>
                )}
              </div>
              <div className={`flex justify-end p-3 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-gray-200'}`}>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowPreview(false)} className="px-6 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg">Close</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.5); }
      `}</style>
    </div>
  );
}
