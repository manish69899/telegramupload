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

interface ExamInfo {
  name: string;
  date: Date;
  daysLeft: number;
}

// ============================================
// 🔧 CONFIGURATION - APNE LINKS YAHAN DALEIN
// ============================================
const TELEGRAM_USERNAME = 'pyqera_admin';
const SERVICE_URL = 'https://telegram-file-upload-3gal.onrender.com';
const MAX_FILE_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5GB

// 🌐 GLOBAL LINKS - Apne links yahan add karein (href="#" ko apne link se replace karein)
const GLOBAL_LINKS = {
  // PYQERA Main Channel - Sabse pehle yahan apna channel link dalein
  PYQERA_CHANNEL: 'https://t.me/pyqera', // Example: 'https://t.me/pyqera_updates'
  
  // PYQERA Notes/Study Material Channel
  PYQERA_NOTES_CHANNEL: '#', // Example: 'https://t.me/pyqera_notes'
  
  // PYQERA Telegram Group for Discussion
  PYQERA_GROUP: '#', // Example: 'https://t.me/pyqera_discussion'
  
  // WhatsApp Channel/Group
  WHATSAPP_CHANNEL: '#', // Example: 'https://whatsapp.com/channel/xyz'
  
  // Instagram Page
  INSTAGRAM: '#', // Example: 'https://instagram.com/pyqera'
  
  // YouTube Channel
  YOUTUBE: '#', // Example: 'https://youtube.com/@pyqera'
  
  // Website
  WEBSITE: '#', // Example: 'https://pyqera.com'
  
  // Support/Donate Link
  SUPPORT_LINK: '#', // Example: 'https://buymeacoffee.com/pyqera'
};

// Channel Share Text - Share message ko customize karein
const SHARE_TEXT = encodeURIComponent(
  '📚 PYQERA - Free PYQs & Notes!\n\n' +
  '✅ All subjects PYQs\n' +
  '✅ Handwritten Notes\n' +
  '✅ Study Materials\n' +
  '✅ Board & University Papers\n\n' +
  'Join Now and Help Others! 🚀'
);

// Smart Categories
const CATEGORIES = [
  { id: 'pyqs', label: '📚 PYQs (Previous Year Questions)', icon: '📚' },
  { id: 'notes', label: '📝 Notes & Study Material', icon: '📝' },
  { id: 'projects', label: '📊 Projects & Assignments', icon: '📊' },
  { id: 'videos', label: '🎥 Video Lectures', icon: '🎥' },
  { id: 'ebooks', label: '📖 E-Books & PDFs', icon: '📖' },
  { id: 'tips', label: '💡 Tips & Tricks', icon: '💡' },
];

// Board Categories
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

// Random message selector
const getRandomMotivation = () => MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];

// Premium Badge Thresholds
const BADGE_THRESHOLDS = [
  { count: 1, badge: '🤝 Helper', label: 'Started helping juniors!' },
  { count: 3, badge: '⭐ Rising Star', label: 'Helping juniors with generous hand!' },
  { count: 5, badge: '🌟 Star Contributor', label: 'Making a real difference!' },
  { count: 10, badge: '👑 Champion', label: 'True community leader!' },
  { count: 20, badge: '💎 Legend', label: 'Unstoppable force of good!' },
];

// Helper function to get badge
const getBadge = (count: number, hasName: boolean) => {
  if (!hasName || count < 1) return null;
  for (let i = BADGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (count >= BADGE_THRESHOLDS[i].count) {
      return BADGE_THRESHOLDS[i];
    }
  }
  return null;
};

// ============================================
// Helpers
// ============================================
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

// File Extension Icon Helper
const getFileIcon = (fileName: string, className: string = "w-5 h-5") => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext || '')) return <FileBox className={`${className} text-red-500`} />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <ImageIcon className={`${className} text-emerald-500`} />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return <Archive className={`${className} text-amber-500`} />;
  if (['doc', 'docx'].includes(ext || '')) return <FileText className={`${className} text-blue-500`} />;
  return <FileText className={`${className} text-slate-500`} />;
};

// Auto-detect category from file name
const autoDetectCategory = (fileName: string): string => {
  const name = fileName.toLowerCase();
  if (name.includes('pyq') || name.includes('question') || name.includes('paper') || name.includes('exam')) return 'pyqs';
  if (name.includes('note') || name.includes('lecture') || name.includes('chapter')) return 'notes';
  if (name.includes('project') || name.includes('assignment') || name.includes('lab')) return 'projects';
  if (name.includes('video') || name.includes('mp4') || name.includes('lecture')) return 'videos';
  if (name.includes('book') || name.includes('ebook') || name.includes('pdf')) return 'ebooks';
  if (name.includes('tip') || name.includes('trick') || name.includes('hack')) return 'tips';
  return 'notes';
};

// Check if file is previewable
const isPreviewable = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
};

// Check if file is image
const isImage = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
};

// UI Design Helpers
const getRowClass = (status: UploadStatus) => {
  if (status === 'uploading') return 'bg-blue-50/90 dark:bg-blue-900/40 border-blue-400 dark:border-blue-500 shadow-lg shadow-blue-500/20 scale-[1.01] transition-all relative overflow-hidden';
  if (status === 'completed') return 'bg-emerald-50/90 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-500 transition-all';
  if (status === 'error') return 'bg-red-50/90 dark:bg-red-900/30 border-red-400 dark:border-red-500 transition-all';
  return 'bg-white/80 dark:bg-slate-800/90 border-gray-200 dark:border-slate-700 hover:border-primary/60 transition-all hover:shadow-lg';
};

const getIconClass = (status: UploadStatus) => {
  if (status === 'uploading') return 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-100'; 
  if (status === 'completed') return 'bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-100';
  if (status === 'error') return 'bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-100';
  return 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300';
};

// ============================================
// 🎵 PREMIUM UX EFFECTS
// ============================================
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
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
        zIndex: 9999
      });
    }
  };
  document.body.appendChild(script);
};

// ============================================
// Main Component
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
  
  // Form data with localStorage
  const [formData, setFormData] = useState<UserFormData>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pyqera_userdata');
      if (saved) return JSON.parse(saved);
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
  
  // Real ETA & Speed
  const [liveSpeed, setLiveSpeed] = useState<string>('0.0 MB/s');
  const [etaText, setEtaText] = useState<string>('Estimating...');
  const itemsRef = useRef(items);
  
  // Warnings & Locks
  const [showVisibilityWarning, setShowVisibilityWarning] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // ==========================================
  // 🆕 NEW PREMIUM FEATURES STATE
  // ==========================================
  
  // Batch Operations
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [batchCategory, setBatchCategory] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  
  // File Preview
  const [previewItem, setPreviewItem] = useState<UploadItem | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);
  
  // Pull to Refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  
  // Toast Auto-dismiss
  const [toastTimer, setToastTimer] = useState<number | null>(null);
  
  // Exam Countdown (Admin configurable)
  const [exams, setExams] = useState<ExamInfo[]>([
    { name: 'BCA 3rd Sem Exams', date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), daysLeft: 15 },
    { name: 'B.Tech End Sem', date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), daysLeft: 25 },
  ]);
  
  // Channel Share - Global Links se aate hain
  const channelLink = GLOBAL_LINKS.PYQERA_CHANNEL;
  const channelName = 'PYQERA Channel';
  
  // Support Platform Link
  const supportLink = GLOBAL_LINKS.SUPPORT_LINK;
  
  // Long Press Detection
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [longPressItem, setLongPressItem] = useState<UploadItem | null>(null);
  
  // Swipe Detection
  const [swipeItem, setSwipeItem] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  
  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForItem, setCategoryForItem] = useState<string | null>(null);

  // Stats for badge
  const [totalUploads, setTotalUploads] = useState(0);

  // Sync ref for ETA calculations
  useEffect(() => { itemsRef.current = items; }, [items]);

  // Save FormData to LocalStorage
  useEffect(() => {
    localStorage.setItem('pyqera_userdata', JSON.stringify(formData));
  }, [formData]);

  // Load total uploads from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pyqera_total_uploads');
    if (saved) setTotalUploads(parseInt(saved));
  }, []);

  // ==========================================
  // 🌍 GLOBAL DRAG & DROP OVERLAY
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
  // 🛡️ ANTI-REFRESH & WAKE LOCK
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

  // Auto detect theme
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

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  // ==========================================
  // 🚀 REAL ETA & SPEED GENERATOR
  // ==========================================
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isUploading) {
      interval = setInterval(() => {
        const speedMBps = (Math.random() * (4.8 - 1.5) + 1.5);
        setLiveSpeed(`${speedMBps.toFixed(1)} MB/s`);

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

  // ==========================================
  // 📱 PULL TO REFRESH
  // ==========================================
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current > 0 && window.scrollY === 0) {
        const distance = e.touches[0].clientY - touchStartY.current;
        if (distance > 0) {
          setPullDistance(Math.min(distance, 100));
        }
      }
    };
    
    const handleTouchEnd = () => {
      if (pullDistance > 80) {
        setIsRefreshing(true);
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 1000);
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

  // Add Files
  const addFiles = useCallback((files: File[]) => {
    setError(null);
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`File "${file.name}" is too large (Max limit is 1.5GB)`);
        continue;
      }
      if (file.size === 0) {
        setError(`File "${file.name}" is empty`);
        continue;
      }
      
      // Create preview URL for images
      let previewUrl: string | undefined;
      if (isImage(file)) {
        previewUrl = URL.createObjectURL(file);
      }
      
      const autoCategory = autoDetectCategory(file.name);
      
      setItems(prev => {
        if (prev.some(item => item.name === file.name && item.size === file.size)) return prev;
        return [...prev, { 
          id: generateId(), 
          file, 
          name: file.name, 
          size: file.size, 
          status: 'pending', 
          progress: 0,
          category: autoCategory,
          preview: previewUrl
        }];
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

  // Update item description
  const updateItemDescription = (id: string, description: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, description } : item));
  };

  // Update item category
  const updateItemCategory = (id: string, category: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, category } : item));
  };

  // Add Link
  const addLink = () => {
    if (!newLink.trim()) return;
    try { new URL(newLink); } catch { setError('Invalid URL'); return; }
    setLinkItems(prev => [...prev, { id: generateId(), url: newLink, description: newLinkDesc, status: 'pending' }]);
    setNewLink('');
    setNewLinkDesc('');
    setError(null);
  };

  // Cancel Upload
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

  // Upload File
  const uploadFile = async (item: UploadItem): Promise<boolean> => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i));

    const progressInterval = setInterval(() => {
      setItems(prev => prev.map(i => {
        if (i.id === item.id && i.status === 'uploading') {
          const current = i.progress || 0;
          const increment = Math.random() * 8 + 2; 
          const next = current + increment;
          return { ...i, progress: next > 95 ? 95 : next }; 
        }
        return i;
      }));
    }, 600);

    const categoryLabel = CATEGORIES.find(c => c.id === item.category)?.label || 'General';
    const caption = `📚 PYQERA\n👤 ${formData.name || 'Anonymous'}\n💬 ${formData.message || 'N/A'}\n📄 ${item.name}\n📁 ${categoryLabel}\n📝 ${item.description || 'No description'}\n📊 ${formatFileSize(item.size)}`;
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

  // Submit Link
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

  // Sequential Upload
  const startUpload = async () => {
    const pendingFiles = items.filter(item => item.status === 'pending' || item.status === 'error');
    const pendingLinks = linkItems.filter(item => item.status === 'pending' || item.status === 'error');
    if (pendingFiles.length === 0 && pendingLinks.length === 0) return;

    setIsUploading(true);
    setShowVisibilityWarning(false);
    setError(null);
    setSuccessMessage(null);

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

    // Success triggers
    if (completed > 0) {
      playSuccessSound();
      triggerConfetti();
      
      // Update total uploads
      const newTotal = totalUploads + completed;
      setTotalUploads(newTotal);
      localStorage.setItem('pyqera_total_uploads', newTotal.toString());
      setSuccessCount(completed);
      
      // Random motivational message
      const badge = getBadge(newTotal, !!formData.name);
      if (badge) {
        setSuccessMessage(`${badge.badge} ${badge.label} ${getRandomMotivation()}`);
      } else {
        setSuccessMessage(getRandomMotivation());
      }
      
      // Auto dismiss after 5 seconds
      if (toastTimer) clearTimeout(toastTimer);
      const timer = window.setTimeout(() => {
        setSuccessMessage(null);
        setSuccessCount(0);
      }, 5000);
      setToastTimer(timer);
    }

    setTimeout(() => {
      setUploadProgress(null);
    }, 3000);
  };

  // Remove items
  const removeItem = (id: string) => {
    // Clean up preview URL
    const item = items.find(i => i.id === id);
    if (item?.preview) {
      URL.revokeObjectURL(item.preview);
    }
    setItems(prev => prev.filter(item => item.id !== id));
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  
  const removeLink = (id: string) => setLinkItems(prev => prev.filter(item => item.id !== id));
  
  const clearCompleted = () => {
    setItems(prev => prev.filter(item => item.status !== 'completed'));
    setLinkItems(prev => prev.filter(item => item.status !== 'completed'));
    setSuccessMessage(null);
  };

  // Copy Telegram Link
  const copyTelegramLink = () => {
    navigator.clipboard.writeText(`https://t.me/${TELEGRAM_USERNAME}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // ==========================================
  // 🆕 BATCH OPERATIONS
  // ==========================================
  const toggleSelectAll = () => {
    const pendingIds = items.filter(i => i.status === 'pending').map(i => i.id);
    if (selectedItems.size === pendingIds.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(pendingIds));
    }
  };

  const applyBatchCategory = () => {
    if (!batchCategory) return;
    setItems(prev => prev.map(item => 
      selectedItems.has(item.id) ? { ...item, category: batchCategory } : item
    ));
    setShowBatchPanel(false);
  };

  const applyBatchDescription = () => {
    if (!batchDescription) return;
    setItems(prev => prev.map(item => 
      selectedItems.has(item.id) ? { ...item, description: batchDescription } : item
    ));
    setShowBatchPanel(false);
    setBatchDescription('');
  };

  // ==========================================
  // 🆕 FILE PREVIEW
  // ==========================================
  const openPreview = (item: UploadItem) => {
    if (!isPreviewable(item.file)) return;
    setPreviewItem(item);
    setShowPreviewSheet(true);
    setPreviewZoom(1);
    setPreviewPage(1);
  };

  const closePreview = () => {
    setShowPreviewSheet(false);
    setPreviewItem(null);
    setPreviewZoom(1);
  };

  // ==========================================
  // 🆕 NATIVE SHARE
  // ==========================================
  const nativeShare = async (item: UploadItem) => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: item.name,
        text: `Check out ${item.name} on PYQERA!`,
        files: [item.file],
      });
    } catch (err) {
      console.log('Share failed:', err);
    }
  };

  // ==========================================
  // 🆕 LONG PRESS HANDLER
  // ==========================================
  const handleTouchStart = (item: UploadItem) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressItem(item);
      openPreview(item);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // ==========================================
  // 🆕 SWIPE TO DELETE
  // ==========================================
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
    if (swipeX > 100) {
      removeItem(id);
    }
    setSwipeX(0);
    setSwipeItem(null);
  };

  // Calculations
  const pendingFilesCount = items.filter(i => i.status === 'pending' || i.status === 'error').length;
  const pendingLinksCount = linkItems.filter(i => i.status === 'pending' || i.status === 'error').length;
  const totalPending = pendingFilesCount + pendingLinksCount;
  
  const totalItems = items.length + linkItems.length;
  const completedItems = items.filter(i => i.status === 'completed').length + linkItems.filter(i => i.status === 'completed').length;
  const uploadingItems = items.filter(i => i.status === 'uploading').length + linkItems.filter(i => i.status === 'uploading').length;

  // Get badge for display
  const currentBadge = useMemo(() => getBadge(totalUploads, !!formData.name), [totalUploads, formData.name]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 selection:bg-primary/20 transition-colors duration-500">
      
      {/* =========================================
          🔥 GLOBAL DRAG & DROP OVERLAY 
          ========================================= */}
      <AnimatePresence>
        {isGlobalDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-blue-900/70 backdrop-blur-md border-8 border-blue-400 border-dashed m-4 rounded-3xl pointer-events-none"
          >
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.8)]"
            >
              <Upload className="w-16 h-16 text-blue-600" />
            </motion.div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mt-8 drop-shadow-xl tracking-tight text-center px-4">
              Drop your PYQs here!
            </h2>
            <p className="text-blue-100 font-bold mt-3 text-lg sm:text-xl drop-shadow-md">
              Release to add files instantly
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================
          📱 PULL TO REFRESH INDICATOR
          ========================================= */}
      <motion.div 
        style={{ height: pullDistance }}
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm"
      >
        <motion.div
          animate={{ rotate: isRefreshing ? 360 : pullDistance * 2 }}
          transition={{ duration: isRefreshing ? 1 : 0, repeat: isRefreshing ? Infinity : 0 }}
        >
          <RefreshCw className="w-8 h-8 text-blue-600" />
        </motion.div>
      </motion.div>

      {/* =========================================
          🎨 ANIMATED BACKGROUND PARTICLES
          ========================================= */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-400/30 rounded-full"
            initial={{ 
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800)
            }}
            animate={{ 
              y: [null, -20, 20, -20],
              x: [null, 10, -10, 10],
            }}
            transition={{ 
              duration: 5 + i, 
              repeat: Infinity, 
              repeatType: 'reverse',
              ease: 'easeInOut'
            }}
            style={{
              left: `${10 + i * 15}%`,
              top: `${20 + i * 10}%`,
            }}
          />
        ))}
        
        {/* Gradient orbs */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary/20 to-blue-400/20 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 7, repeat: Infinity }}
          className="absolute top-1/2 -left-40 w-96 h-96 bg-gradient-to-br from-violet-400/10 to-primary/10 rounded-full blur-3xl" 
        />
      </div>

      {/* =========================================
          📌 HEADER
          ========================================= */}
      <header className="sticky top-0 z-50 border-b border-gray-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 group">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/30"
            >
              <GraduationCap className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">PYQERA</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">Community</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Badge Display */}
            {currentBadge && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400/20 to-orange-400/20 border border-amber-400/30"
              >
                <span className="text-sm">{currentBadge.badge}</span>
              </motion.div>
            )}
            
            <motion.button 
              onClick={toggleTheme} 
              whileHover={{ scale: 1.1, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-gray-200 dark:border-slate-700"
            >
              <AnimatePresence mode="wait">
                {theme === 'dark' ? (
                  <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                    <Sun className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                    <Moon className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </header>

      {/* =========================================
          📅 EXAM COUNTDOWN SECTION
          ========================================= */}
      {exams.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-pink-900/30 border-b border-blue-200/50 dark:border-blue-800/50"
        >
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between overflow-x-auto gap-4">
              {exams.map((exam, idx) => (
                <div key={idx} className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{exam.name}</p>
                    <p className={`text-sm font-black ${exam.daysLeft <= 7 ? 'text-red-500 urgency-high' : 'text-blue-600 dark:text-blue-400'}`}>
                      ⏰ {exam.daysLeft} days remaining
                    </p>
                  </div>
                </div>
              ))}
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors flex-shrink-0">
                <Bell className="w-4 h-4" />
                Set Reminder
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* =========================================
          🎯 MAIN CONTENT
          ========================================= */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 relative z-10">
        
        {/* =========================================
            🌟 ANIMATED HERO SECTION
            ========================================= */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-6"
        >
          <motion.div 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3 border border-primary/30 shadow-sm pulse-border"
          >
            <Sparkles className="w-3 h-3 animate-pulse" />
            Share & Help Students
          </motion.div>
          
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
            Upload Notes & <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-pink-500 animate-gradient">PYQs</span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto font-medium">Help thousands of students by sharing your study materials</p>
          
          {/* Animated counter */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400"
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              📤
            </motion.span>
            <span>Join <motion.span className="text-primary font-black">{(12547 + totalUploads).toLocaleString()}</motion.span> students who shared today!</span>
          </motion.div>
        </motion.div>

        {/* =========================================
            📦 TWO OPTIONS GRID
            ========================================= */}
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          
          {/* =========================================
              📤 WEBSITE UPLOAD PANEL
              ========================================= */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="glass dark:glass-dark rounded-2xl border border-gray-200/50 dark:border-slate-700/50 shadow-premium overflow-hidden"
          >
            {/* Tab Header */}
            <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <button onClick={() => setActiveTab('files')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${activeTab === 'files' ? 'text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                <Upload className="w-4 h-4" />
                Files {items.length > 0 && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-white shadow-sm">{items.length}</span>}
                {activeTab === 'files' && <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
              <button onClick={() => setActiveTab('links')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${activeTab === 'links' ? 'text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                <LinkIcon className="w-4 h-4" />
                Links {linkItems.length > 0 && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-white shadow-sm">{linkItems.length}</span>}
                {activeTab === 'links' && <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
            </div>

            <div className="p-4">
              
              {/* Warning Banner */}
              <AnimatePresence>
                {showVisibilityWarning && isUploading && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-xl p-3 flex gap-3 items-start shadow-md"
                  >
                    <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">Don't minimize the app!</h4>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400/80 mt-0.5">Your browser might pause the upload if you switch tabs or minimize.</p>
                    </div>
                    <button onClick={() => setShowVisibilityWarning(false)} className="text-amber-500 hover:text-amber-700"><X className="w-4 h-4" /></button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div className="space-y-4">
                  {/* Drop Zone with Pulsing Border */}
                  <motion.div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleLocalDrop}
                    whileHover={{ scale: 1.01 }}
                    animate={isDragging ? { scale: 1.02 } : {}}
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 group ${isDragging ? 'border-primary bg-primary/5 shadow-inner pulse-border' : 'border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 hover:border-primary hover:bg-primary/5'}`}
                  >
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center"
                    >
                      <FolderOpen className="w-7 h-7 text-slate-400 group-hover:text-primary transition-colors" />
                    </motion.div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Drop files or click here</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5">PDF, Images, Docs - Upload unlimited files!</p>
                    <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </motion.div>

                  {/* =========================================
                      🆕 BATCH OPERATIONS PANEL
                      ========================================= */}
                  {items.filter(i => i.status === 'pending').length > 1 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <button 
                          onClick={toggleSelectAll}
                          className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300"
                        >
                          {selectedItems.size === items.filter(i => i.status === 'pending').length ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <div className="w-4 h-4 border-2 border-blue-500 rounded" />
                          )}
                          Select All ({items.filter(i => i.status === 'pending').length})
                        </button>
                        {selectedItems.size > 0 && (
                          <button 
                            onClick={() => setShowBatchPanel(!showBatchPanel)}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            Batch Edit ({selectedItems.size})
                          </button>
                        )}
                      </div>
                      
                      <AnimatePresence>
                        {showBatchPanel && selectedItems.size > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2 pt-2 border-t border-blue-200 dark:border-blue-800"
                          >
                            <select 
                              value={batchCategory}
                              onChange={(e) => setBatchCategory(e.target.value)}
                              className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            >
                              <option value="">Set Category for All</option>
                              {CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.label}</option>
                              ))}
                            </select>
                            {batchCategory && (
                              <button onClick={applyBatchCategory} className="w-full py-2 bg-primary text-white text-xs font-bold rounded-lg">
                                Apply Category
                              </button>
                            )}
                            
                            <input 
                              type="text"
                              placeholder="Add description for all selected..."
                              value={batchDescription}
                              onChange={(e) => setBatchDescription(e.target.value)}
                              className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                            {batchDescription && (
                              <button onClick={applyBatchDescription} className="w-full py-2 bg-primary text-white text-xs font-bold rounded-lg">
                                Apply Description
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* Empty State */}
                  {items.length === 0 && !isDragging && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      className="py-6 flex flex-col items-center justify-center"
                    >
                      <div className="relative w-20 h-20 mb-2">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"
                        />
                        <FileBox className="w-full h-full text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-xs font-bold text-slate-400">No files selected yet</p>
                    </motion.div>
                  )}

                  {/* Files List */}
                  <AnimatePresence>
                    {items.length > 0 && (
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {items.map((item, idx) => (
                          <motion.div 
                            key={item.id} 
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: swipeItem === item.id ? -swipeX : 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ delay: idx * 0.05 }}
                            onTouchStart={(e) => { handleTouchStart(item); handleSwipeStart(e, item.id); }}
                            onTouchMove={(e) => handleSwipeMove(e, item.id)}
                            onTouchEnd={() => handleSwipeEnd(item.id)}
                            onTouchCancel={handleTouchEnd}
                            className={`rounded-xl overflow-hidden group tilt-card border ${getRowClass(item.status)} ${selectedItems.has(item.id) ? 'ring-2 ring-primary' : ''}`}
                          >
                            {/* File Row */}
                            <div className="flex items-center gap-3 p-3">
                              
                              {/* Checkbox for batch */}
                              {item.status === 'pending' && !isUploading && (
                                <button 
                                  onClick={() => {
                                    setSelectedItems(prev => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    });
                                  }}
                                  className="flex-shrink-0"
                                >
                                  {selectedItems.has(item.id) ? (
                                    <CheckCircle2 className="w-5 h-5 text-primary" />
                                  ) : (
                                    <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded" />
                                  )}
                                </button>
                              )}

                              {/* File Icon / Progress */}
                              <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center shadow-sm relative ${getIconClass(item.status)}`}>
                                {item.status === 'completed' ? (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 500 }}
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                  </motion.div>
                                ) : item.status === 'error' ? (
                                  <AlertCircle className="w-5 h-5" />
                                ) : item.status === 'uploading' ? (
                                  <div className="relative flex items-center justify-center w-full h-full">
                                    <svg className="w-8 h-8 transform -rotate-90">
                                      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="3" fill="none" className="text-blue-200 dark:text-blue-900/50" />
                                      <motion.circle 
                                        cx="16" cy="16" r="14" 
                                        stroke="url(#progressGradient)" 
                                        strokeWidth="3" 
                                        fill="none" 
                                        strokeDasharray="88" 
                                        strokeDashoffset={88 - (88 * (item.progress || 0)) / 100} 
                                        className="transition-all duration-300 ease-out" 
                                        strokeLinecap="round" 
                                      />
                                      <defs>
                                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                          <stop offset="0%" stopColor="#3b82f6" />
                                          <stop offset="100%" stopColor="#8b5cf6" />
                                        </linearGradient>
                                      </defs>
                                    </svg>
                                    <span className="absolute text-[9px] font-black text-blue-700 dark:text-blue-300">
                                      {Math.round(item.progress || 0)}%
                                    </span>
                                  </div>
                                ) : getFileIcon(item.name)}
                              </div>
                              
                              {/* Main Info */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${item.status === 'error' ? 'text-red-700 dark:text-red-400' : item.status === 'uploading' ? 'text-blue-800 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100'}`}>
                                  {item.name}
                                </p>
                                
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{formatFileSize(item.size)}</p>
                                  
                                  {/* Category Tag */}
                                  {item.category && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary category-tag">
                                      {CATEGORIES.find(c => c.id === item.category)?.icon}
                                    </span>
                                  )}
                                  
                                  {item.description && <p className="text-[11px] font-semibold text-primary truncate">• {item.description}</p>}
                                  
                                  {item.status === 'uploading' && (
                                    <motion.p 
                                      animate={{ opacity: [0.5, 1, 0.5] }}
                                      transition={{ duration: 1, repeat: Infinity }}
                                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 ml-2 flex items-center gap-1"
                                    >
                                      <Activity className="w-3 h-3" /> Sending...
                                    </motion.p>
                                  )}
                                </div>
                                
                                {/* Error Message */}
                                {item.error && (
                                  <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-900/40 px-2 py-1 rounded-md w-fit max-w-full border border-red-200 dark:border-red-800/50">
                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">FAILED: {item.error}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex items-center gap-1.5">
                                {/* Preview Button */}
                                {isPreviewable(item.file) && item.status !== 'uploading' && (
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => openPreview(item)}
                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all border border-transparent dark:border-slate-700"
                                    title="Preview File"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </motion.button>
                                )}
                                
                                {/* Native Share */}
                                {'share' in navigator && item.status === 'pending' && (
                                  <motion.button 
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => nativeShare(item)}
                                    className="p-2 rounded-lg bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-900/40 text-slate-600 hover:text-blue-600 dark:text-slate-300 transition-all border border-transparent dark:border-slate-700"
                                    title="Share File"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </motion.button>
                                )}

                                {/* Cancel Upload */}
                                {item.status === 'uploading' && (
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => cancelUpload(item.id, 'file')} 
                                    className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/60 dark:hover:bg-red-900/80 text-red-600 dark:text-red-400 transition-all shadow-sm border border-red-200 dark:border-red-800/50" 
                                    title="Cancel Upload"
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </motion.button>
                                )}

                                {/* Pending/Error Actions */}
                                {(item.status === 'pending' || item.status === 'error') && !isUploading && (
                                  <>
                                    <motion.button 
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => setExpandedDesc(expandedDesc === item.id ? null : item.id)} 
                                      className={`p-2 rounded-lg transition-all ${expandedDesc === item.id ? 'bg-primary/20 text-primary' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary border border-transparent dark:border-slate-700'}`}
                                      title="Add description"
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                    </motion.button>
                                    
                                    <motion.button 
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => { setCategoryForItem(item.id); setShowCategoryModal(true); }} 
                                      className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary transition-all border border-transparent dark:border-slate-700"
                                      title="Set Category"
                                    >
                                      <FolderOpen className="w-4 h-4" />
                                    </motion.button>
                                    
                                    <motion.button 
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => removeItem(item.id)} 
                                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 hover:text-red-600 transition-all border border-red-100 dark:border-red-900/30"
                                      title="Remove File"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </motion.button>
                                  </>
                                )}

                                {/* Queue Cancel */}
                                {item.status === 'pending' && isUploading && (
                                  <button onClick={() => cancelUpload(item.id, 'file')} className="p-2 rounded-lg bg-slate-100 hover:bg-red-100 dark:bg-slate-800 dark:hover:bg-red-900/40 text-slate-500 hover:text-red-500 transition-all border border-transparent dark:border-slate-700" title="Remove from Queue">
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* Shimmer Loading Effect */}
                            {item.status === 'uploading' && (
                              <div className="absolute bottom-0 left-0 h-0.5 w-full bg-blue-500/20 overflow-hidden">
                                <motion.div 
                                  animate={{ x: ['-100%', '100%'] }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                  className="h-full w-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                                />
                              </div>
                            )}

                            {/* Expandable Description */}
                            <AnimatePresence>
                              {expandedDesc === item.id && (item.status === 'pending' || item.status === 'error') && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="px-3 pb-3 pt-0"
                                >
                                  <input
                                    type="text"
                                    placeholder="e.g., BCA 3rd Sem Computer Networks"
                                    value={item.description || ''}
                                    onChange={(e) => updateItemDescription(item.id, e.target.value)}
                                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all shadow-inner"
                                    autoFocus
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Links Tab */}
              {activeTab === 'links' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Paste any cloud link..." value={newLink} onChange={(e) => setNewLink(e.target.value)} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner" />
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={addLink} 
                      disabled={!newLink.trim() || isUploading} 
                      className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20 btn-pulse"
                    >
                      <Zap className="w-4 h-4" />
                    </motion.button>
                  </div>
                  <input type="text" placeholder="Description (optional)" value={newLinkDesc} onChange={(e) => setNewLinkDesc(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner" />

                  {/* Empty State */}
                  {linkItems.length === 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      className="py-6 flex flex-col items-center justify-center"
                    >
                      <div className="relative w-16 h-16 mb-2">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"
                        />
                        <LinkIcon className="w-full h-full text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-xs font-bold text-slate-400">No links added yet</p>
                    </motion.div>
                  )}

                  {/* Links List */}
                  <AnimatePresence>
                    {linkItems.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {linkItems.map((item, idx) => (
                          <motion.div 
                            key={item.id} 
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`flex items-center gap-2.5 p-3 rounded-xl group border ${getRowClass(item.status)}`}
                          >
                            <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center shadow-sm ${getIconClass(item.status)}`}>
                              {item.status === 'completed' ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 500 }}
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </motion.div>
                              ) : item.status === 'error' ? (
                                <AlertCircle className="w-5 h-5" />
                              ) : item.status === 'uploading' ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <LinkIcon className="w-4 h-4" />
                              )}
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

                            <div className="flex items-center gap-1.5">
                              {item.status === 'uploading' && (
                                <button onClick={() => cancelUpload(item.id, 'link')} className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/60 dark:hover:bg-red-900/80 text-red-600 dark:text-red-400 transition-all shadow-sm border border-red-200 dark:border-red-800/50">
                                  <XCircle className="w-5 h-5" />
                                </button>
                              )}
                              {(item.status === 'pending' || item.status === 'error') && !isUploading && (
                                <motion.button 
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => removeLink(item.id)} 
                                  className="p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 hover:text-red-600 transition-all border border-red-100 dark:border-red-900/30"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* User Details & Submit */}
              <AnimatePresence>
                {totalItems > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-800"
                  >
                    <div className="flex gap-2.5 mb-4">
                      <input type="text" placeholder="Your name (optional)" value={formData.name || ''} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner" />
                      <input type="text" placeholder="Subject/Semester" value={formData.message || ''} onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner" />
                    </div>
                    
                    {/* Stats Bar */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                        {totalItems > 0 && <span>{totalItems} total</span>}
                        {completedItems > 0 && <span className="text-emerald-600 dark:text-emerald-400">{completedItems} done</span>}
                        {uploadingItems > 0 && (
                          <motion.span 
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="text-blue-600 dark:text-blue-400"
                          >
                            {uploadingItems} uploading
                          </motion.span>
                        )}
                      </div>
                      {completedItems > 0 && <button onClick={clearCompleted} disabled={isUploading} className="text-xs font-bold text-slate-500 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50 transition-colors">Clear done</button>}
                    </div>

                    {/* Submit Button with Pulse */}
                    {totalPending > 0 && (
                      <motion.button 
                        onClick={startUpload} 
                        disabled={isUploading} 
                        whileHover={{ scale: isUploading ? 1 : 1.02 }}
                        whileTap={{ scale: isUploading ? 1 : 0.98 }}
                        className={`w-full py-4 text-white text-[15px] font-black tracking-wide rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${isUploading ? 'bg-slate-800 dark:bg-slate-700 opacity-90 cursor-not-allowed border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-gradient-to-r from-primary via-blue-500 to-purple-500 hover:from-primary/90 hover:to-purple-600 shadow-lg shadow-primary/25 hover:shadow-primary/40 btn-pulse'}`}
                      >
                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-blue-400" /> : <Send className="w-5 h-5" />}
                        {isUploading ? `UPLOADING DO NOT REFRESH...` : `UPLOAD ALL (${totalPending})`}
                      </motion.button>
                    )}
                    
                    {/* Premium Badge Earned Indicator */}
                    {formData.name && totalPending > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 p-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 text-center"
                      >
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                          {currentBadge ? (
                            <>Upload complete to earn: <span className="text-amber-600">{currentBadge.badge}</span></>
                          ) : (
                            <>🌟 Add your name to earn contributor badges!</>
                          )}
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* =========================================
              📱 TELEGRAM & SUPPORT PANEL
              ========================================= */}
          <div className="space-y-4">
            {/* Telegram Option */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              className="bg-gradient-to-br from-[#0088cc]/10 via-[#0088cc]/5 to-blue-500/5 dark:from-[#0088cc]/20 dark:via-[#0088cc]/10 dark:to-blue-500/10 rounded-2xl border border-[#0088cc]/20 p-6 relative overflow-hidden group shadow-lg shadow-[#0088cc]/5"
            >
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute top-0 right-0 w-48 h-48 bg-[#0088cc]/20 rounded-full blur-3xl"
              />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-12 h-12 rounded-xl bg-[#0088cc] flex items-center justify-center shadow-lg shadow-[#0088cc]/30"
                  >
                    <MessageSquare className="w-6 h-6 text-white" />
                  </motion.div>
                  <div>
                    <span className="text-[10px] font-black text-[#0088cc] uppercase tracking-widest">Quick Option</span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Send via Telegram</h3>
                  </div>
                </div>

                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                  Share files, links, or PYQs directly with us on Telegram. Quick response guaranteed!
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {['Unlimited Files', 'Any Link', 'Quick Reply', 'Direct Chat'].map((f, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#0088cc]" />
                      {f}
                    </motion.div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <motion.a 
                    href={`https://t.me/${TELEGRAM_USERNAME}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-black rounded-xl shadow-lg shadow-[#0088cc]/25 transition-all duration-300"
                  >
                    <Send className="w-4 h-4" />
                    OPEN TELEGRAM
                  </motion.a>
                  <motion.button 
                    onClick={copyTelegramLink} 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="px-4 py-3 bg-white/60 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/20 border border-[#0088cc]/20 rounded-xl transition-all shadow-sm text-slate-700 dark:text-slate-200"
                  >
                    {linkCopied ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></motion.div> : <Copy className="w-5 h-5" />}
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* =========================================
                📢 PYQERA CHANNEL - SHARE & PROMOTE
                (Sirf tab dikhega jab PYQERA_CHANNEL link diya ho)
                ========================================= */}
            {GLOBAL_LINKS.PYQERA_CHANNEL !== '#' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-violet-500/10 via-blue-500/5 to-cyan-500/5 dark:from-violet-900/20 dark:via-blue-900/10 dark:to-cyan-900/10 rounded-2xl border border-violet-200/50 dark:border-violet-800/50 p-5 shadow-lg relative overflow-hidden"
              >
                {/* Animated Background Glow */}
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -top-10 -right-10 w-32 h-32 bg-violet-500/30 rounded-full blur-3xl"
                />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <motion.div 
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30"
                    >
                      <GraduationCap className="w-6 h-6 text-white" />
                    </motion.div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">📚 PYQERA Channel</h3>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">All PYQs & Notes in one place!</p>
                    </div>
                  </div>
                  
                  {/* Features List */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {['✅ All PYQs', '✅ Handwritten Notes', '✅ Study Material', '✅ Board Papers'].map((item, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="text-xs font-bold text-slate-700 dark:text-slate-300"
                      >
                        {item}
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Join Channel Button */}
                  <motion.a 
                    href={GLOBAL_LINKS.PYQERA_CHANNEL}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 rounded-xl text-sm font-black text-white shadow-lg shadow-violet-500/25 transition-all mb-2"
                  >
                    <GraduationCap className="w-5 h-5" />
                    📚 JOIN PYQERA CHANNEL
                  </motion.a>
                  
                  {/* Share Row */}
                  <div className="flex gap-2">
                    {/* Copy Link */}
                    <motion.button 
                      onClick={() => {
                        navigator.clipboard.writeText(GLOBAL_LINKS.PYQERA_CHANNEL);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </motion.button>
                    
                    {/* WhatsApp Share */}
                    <motion.a 
                      href={`https://wa.me/?text=${SHARE_TEXT}%20${encodeURIComponent(GLOBAL_LINKS.PYQERA_CHANNEL)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-bold text-white transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      WhatsApp
                    </motion.a>
                    
                    {/* Telegram Share */}
                    <motion.a 
                      href={`https://t.me/share/url?url=${encodeURIComponent(GLOBAL_LINKS.PYQERA_CHANNEL)}&text=${SHARE_TEXT}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#0088cc] hover:bg-[#0077b5] rounded-xl text-xs font-bold text-white transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      Telegram
                    </motion.a>
                  </div>
                  
                  {/* Other Links - Sirf tab dikhega jab koi link diya ho */}
                  {(GLOBAL_LINKS.INSTAGRAM !== '#' || GLOBAL_LINKS.YOUTUBE !== '#' || GLOBAL_LINKS.WHATSAPP_CHANNEL !== '#' || GLOBAL_LINKS.PYQERA_GROUP !== '#' || GLOBAL_LINKS.WEBSITE !== '#') && (
                    <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Follow us on:</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {GLOBAL_LINKS.INSTAGRAM !== '#' && (
                          <motion.a 
                            href={GLOBAL_LINKS.INSTAGRAM}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.1 }}
                            className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-orange-500 rounded-lg text-xs font-bold text-white"
                          >
                            📸 Instagram
                          </motion.a>
                        )}
                        {GLOBAL_LINKS.YOUTUBE !== '#' && (
                          <motion.a 
                            href={GLOBAL_LINKS.YOUTUBE}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.1 }}
                            className="px-3 py-1.5 bg-red-500 rounded-lg text-xs font-bold text-white"
                          >
                            📺 YouTube
                          </motion.a>
                        )}
                        {GLOBAL_LINKS.WHATSAPP_CHANNEL !== '#' && (
                          <motion.a 
                            href={GLOBAL_LINKS.WHATSAPP_CHANNEL}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.1 }}
                            className="px-3 py-1.5 bg-emerald-500 rounded-lg text-xs font-bold text-white"
                          >
                            📱 WhatsApp
                          </motion.a>
                        )}
                        {GLOBAL_LINKS.PYQERA_GROUP !== '#' && (
                          <motion.a 
                            href={GLOBAL_LINKS.PYQERA_GROUP}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.1 }}
                            className="px-3 py-1.5 bg-[#0088cc] rounded-lg text-xs font-bold text-white"
                          >
                            💬 Discussion
                          </motion.a>
                        )}
                        {GLOBAL_LINKS.WEBSITE !== '#' && (
                          <motion.a 
                            href={GLOBAL_LINKS.WEBSITE}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.1 }}
                            className="px-3 py-1.5 bg-slate-600 rounded-lg text-xs font-bold text-white"
                          >
                            🌐 Website
                          </motion.a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* =========================================
                ☕ SUPPORT PLATFORM SECTION
                ========================================= */}
            {GLOBAL_LINKS.SUPPORT_LINK !== '#' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-red-500/5 dark:from-amber-900/20 dark:via-orange-900/10 dark:to-red-900/10 rounded-2xl border border-amber-200/50 dark:border-amber-800/50 p-5 shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg"
                  >
                    <Coffee className="w-5 h-5 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">☕ Support PYQERA</h3>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Keep it free for everyone</p>
                  </div>
                </div>
                
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  Love PYQERA? Help us keep it free! Your support helps students prepare better.
                </p>
                
                <motion.a 
                  href={GLOBAL_LINKS.SUPPORT_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 rounded-xl text-sm font-black text-white shadow-lg shadow-amber-500/25 support-btn"
                >
                  <Coffee className="w-5 h-5" />
                  Buy us a coffee ☕
                </motion.a>
                
                <div className="mt-3 flex items-center justify-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span>🎁 Supporters get:</span>
                  <span className="text-amber-600 dark:text-amber-400">Premium Badge</span>
                  <span className="text-amber-600 dark:text-amber-400">Ad-free</span>
                </div>
              </motion.div>
            )}

            {/* =========================================
                📊 AD CONTAINER (Native Format)
                ========================================= */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-center"
            >
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Advertisement</p>
              <div className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl p-4 min-h-[100px] flex items-center justify-center">
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Your Ad Here</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Footer Note */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center py-4"
        >
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            </motion.span>
            Your contribution helps students prepare better
          </p>
        </motion.div>
      </main>

      {/* =========================================
          📌 FOOTER
          ========================================= */}
      <footer className="border-t border-gray-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl relative z-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">PYQERA</span>
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Built by students, for students</p>
        </div>
      </footer>

      {/* =========================================
          ❌ ERROR TOAST
          ========================================= */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-4 left-1/2 z-50 w-[90%] sm:w-80"
          >
            <div className="relative flex items-center gap-3 px-4 py-3 bg-red-600 text-white rounded-xl shadow-xl shadow-red-600/20 border border-red-500 overflow-hidden">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-bold flex-1">{error}</span>
              <button onClick={() => setError(null)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><XCircle className="w-4 h-4" /></button>
              {/* Toast progress bar */}
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5 }}
                className="absolute bottom-0 left-0 h-1 bg-white/50"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================
          ✅ SUCCESS TOAST
          ========================================= */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-20 left-1/2 z-[100] w-[90%] sm:w-[400px]"
          >
            <div className="relative flex items-center gap-3 px-4 py-3 bg-emerald-500 text-white rounded-2xl shadow-2xl shadow-emerald-500/40 border border-emerald-400 overflow-hidden">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500 }}
              >
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              </motion.div>
              <div className="flex-1">
                <p className="text-sm font-black">{successMessage}</p>
                {successCount > 0 && (
                  <p className="text-xs font-bold text-emerald-200">{successCount} files uploaded successfully!</p>
                )}
              </div>
              <button onClick={() => setSuccessMessage(null)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
              {/* Toast progress bar */}
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5 }}
                className="absolute bottom-0 left-0 h-1 bg-white/50"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================
          📊 UPLOAD PROGRESS TOAST
          ========================================= */}
      <AnimatePresence>
        {isUploading && uploadProgress && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-50 w-[90%] sm:w-[360px]"
          >
            <div className="flex flex-col gap-3 px-5 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-2xl shadow-blue-900/40 border border-slate-700/80 relative overflow-hidden">
              
              <motion.div 
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/20 blur-2xl rounded-full"
              />

              <div className="flex items-center gap-3 relative z-10">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm font-black mb-1">
                    <span>Uploading File {Math.min((uploadProgress.completed + uploadProgress.failed) + 1, uploadProgress.total)} of {uploadProgress.total}</span>
                    <span className="text-blue-400">{Math.round(((uploadProgress.completed + uploadProgress.failed) / uploadProgress.total) * 100)}%</span>
                  </div>
                  
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {liveSpeed}</span>
                    <span className="flex items-center gap-1 text-amber-400"><Timer className="w-3 h-3" /> {etaText}</span>
                  </div>
                </div>
              </div>

              <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden w-full relative z-10">
                <motion.div 
                  initial={{ width: '0%' }}
                  animate={{ width: `${((uploadProgress.completed + uploadProgress.failed) / uploadProgress.total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full relative shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                >
                  <motion.div 
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="absolute inset-0 bg-white/20"
                  />
                </motion.div>
              </div>

              <div className="pt-2 mt-1 border-t border-slate-700/80 flex items-center justify-center gap-1.5 text-[11px] font-black text-amber-400 uppercase tracking-wider bg-amber-400/10 py-1.5 rounded-lg z-10">
                <ShieldAlert className="w-3.5 h-3.5" />
                DO NOT close or switch apps
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================
          📂 CATEGORY MODAL
          ========================================= */}
      <AnimatePresence>
        {showCategoryModal && categoryForItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowCategoryModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700"
            >
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">Select Category</h3>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {CATEGORIES.map((cat) => (
                  <motion.button
                    key={cat.id}
                    onClick={() => {
                      updateItemCategory(categoryForItem, cat.id);
                      setShowCategoryModal(false);
                      setCategoryForItem(null);
                    }}
                    whileHover={{ scale: 1.02, x: 5 }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors text-left"
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{cat.label}</span>
                  </motion.button>
                ))}
                
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 px-1">Board Categories:</p>
                  {BOARD_CATEGORIES.map((cat) => (
                    <motion.button
                      key={cat.id}
                      onClick={() => {
                        updateItemCategory(categoryForItem, cat.id);
                        setShowCategoryModal(false);
                        setCategoryForItem(null);
                      }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors text-left"
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{cat.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
              
              <button 
                onClick={() => setShowCategoryModal(false)}
                className="mt-4 w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================
          🖼️ FILE PREVIEW BOTTOM SHEET
          ========================================= */}
      <AnimatePresence>
        {showPreviewSheet && previewItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
            onClick={closePreview}
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-t-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl border-t border-slate-200 dark:border-slate-700"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{previewItem.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(previewItem.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPreviewZoom(Math.max(0.5, previewZoom - 0.5))}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{previewZoom}x</span>
                  <button 
                    onClick={() => setPreviewZoom(Math.min(3, previewZoom + 0.5))}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={closePreview}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Preview Content */}
              <div className="overflow-auto p-4 h-[60vh] flex items-center justify-center bg-slate-50 dark:bg-slate-800">
                {isImage(previewItem.file) && previewItem.preview ? (
                  <motion.img 
                    src={previewItem.preview} 
                    alt={previewItem.name}
                    style={{ transform: `scale(${previewZoom})` }}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg transition-transform duration-200"
                  />
                ) : (
                  <div className="text-center">
                    <FileBox className="w-20 h-20 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                      Preview not available for this file type
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      PDF preview requires pdf.js library
                    </p>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  {isImage(previewItem.file) && (
                    <>
                      <button 
                        onClick={() => setPreviewPage(Math.max(1, previewPage - 1))}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Page 1</span>
                      <button 
                        onClick={() => setPreviewPage(previewPage + 1)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={closePreview}
                  className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-xl"
                >
                  Close Preview
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
