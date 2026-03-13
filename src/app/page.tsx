'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Moon, Sun, Upload, Shield, Zap, File, X, CheckCircle2, 
  AlertCircle, Clock, Loader2, BookOpen, FileText, 
  GraduationCap, Cloud, Send, Link as LinkIcon, MessageSquare
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
  error?: string;
}

interface UserFormData {
  name?: string;
  link?: string;
  message?: string;
}

// Constants
const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB
const SERVICE_URL = 'https://telegram-file-upload-3gal.onrender.com';
const TELEGRAM_USERNAME = 'your_username'; // YAHAN APNA TELEGRAM USERNAME DALO (bina @ ke)

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

// Main Page Component
export default function HomePage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({});
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Check system theme
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
    if (isDark) document.documentElement.classList.add('dark');
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Check service status
  useEffect(() => {
    const checkService = async () => {
      try {
        const response = await fetch(`${SERVICE_URL}/`);
        const data = await response.json();
        if (data.success && data.status === 'ready') {
          setServiceStatus('ready');
        } else {
          setServiceStatus('error');
        }
      } catch (err) {
        setServiceStatus('error');
      }
    };
    checkService();
    const interval = setInterval(checkService, 5000);
    return () => clearInterval(interval);
  }, []);

  // Add files
  const addFiles = useCallback((files: File[]) => {
    setError(null);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File ${file.name} exceeds 1.5GB limit`);
        continue;
      }
      if (file.size === 0) {
        setError(`File ${file.name} is empty`);
        continue;
      }

      setItems(prev => {
        if (prev.some(item => item.name === file.name && item.size === file.size)) {
          return prev;
        }
        return [...prev, {
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          status: 'pending',
          progress: 0,
        }];
      });
    }
  }, []);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [isUploading, addFiles]);

  // Handle file select
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;
    const files = Array.from(e.target.files || []);
    addFiles(files);
    e.target.value = '';
  }, [isUploading, addFiles]);

  // Upload single file
  const uploadFile = async (item: UploadItem): Promise<boolean> => {
    const caption = `📚 PYQERA Contribution\n👤 By: ${formData.name || 'Anonymous Student'}\n🔗 Link: ${formData.link || 'No link provided'}\n💬 Notes: ${formData.message || 'N/A'}\n📄 File: ${item.name}\n📊 Size: ${formatFileSize(item.size)}`;
    
    const formDataToSend = new FormData();
    formDataToSend.append('file', item.file);
    formDataToSend.append('fileName', item.name);
    formDataToSend.append('caption', caption);

    try {
      const response = await fetch(`${SERVICE_URL}/upload`, {
        method: 'POST',
        headers: {
          'X-Upload-Id': item.id,
        },
        body: formDataToSend,
      });

      const result = await response.json();

      if (result.success) {
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i
        ));
        return true;
      } else {
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, status: 'error', error: result.error || 'Upload failed' } : i
        ));
        return false;
      }
    } catch (err) {
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'error', error: 'Network connection failed' } : i
      ));
      return false;
    }
  };

  // Start upload
  const startUpload = async () => {
    if (isUploading || serviceStatus !== 'ready') return;

    const pendingItems = items.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) return;

    setIsUploading(true);
    setError(null);

    setItems(prev => prev.map(item => 
      item.status === 'pending' ? { ...item, status: 'uploading' } : item
    ));

    for (const item of pendingItems) {
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'uploading' } : i
      ));
      await uploadFile(item);
    }

    setIsUploading(false);
  };

  // Remove item
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Clear completed
  const clearCompleted = () => {
    setItems(prev => prev.filter(item => 
      item.status !== 'completed' && item.status !== 'error'
    ));
    setFormData({}); // Clear form after completion
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const completedCount = items.filter(i => i.status === 'completed').length;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background selection:bg-primary/20">
      
      {/* Premium Ambient Background */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-primary/10 via-background to-transparent pointer-events-none"></div>
      <div className="absolute top-20 left-10 w-[400px] h-[400px] rounded-full bg-primary/20 blur-[100px] opacity-50 pointer-events-none mix-blend-screen dark:mix-blend-lighten"></div>
      <div className="absolute top-40 right-10 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px] opacity-50 pointer-events-none mix-blend-screen dark:mix-blend-lighten"></div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 group-hover:scale-105 transition-transform duration-300">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-black tracking-tighter leading-none text-foreground">
                  PYQERA
                </h1>
                <span className="text-[10px] font-bold tracking-widest uppercase text-primary/80 mt-1">
                  Community Portal
                </span>
              </div>
            </div>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme} 
              className="p-2.5 rounded-full bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border transition-all duration-300 text-muted-foreground hover:text-foreground hover:rotate-12"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-12 lg:py-16 max-w-4xl relative z-10">
        
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-6 border border-primary/20">
            <BookOpen className="w-3.5 h-3.5" />
            Contribute to the Community
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 text-foreground leading-tight">
            Share your Notes & <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Previous Year Questions</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Help thousands of students by sharing your study materials. Upload your files directly or share a Drive link below.
          </p>
        </div>

        {/* Upload Interface (Premium Dropzone) */}
        <div className="rounded-[2rem] border border-border/50 bg-card/60 backdrop-blur-2xl shadow-2xl shadow-primary/5 hover:shadow-primary/10 transition-all duration-500 overflow-hidden mb-10">
          <div className="p-6 sm:p-10">
            
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center w-full min-h-[300px] p-8 border-2 border-dashed rounded-3xl transition-all duration-300 ease-in-out cursor-pointer group overflow-hidden
                ${isDragging 
                  ? 'border-primary bg-primary/10 scale-[1.02] shadow-[0_0_40px_rgba(var(--primary),0.15)]' 
                  : 'border-border/80 hover:border-primary/50 hover:bg-primary/[0.02] hover:shadow-[0_0_30px_rgba(var(--primary),0.08)]'
                } 
                ${isUploading || serviceStatus !== 'ready' ? 'opacity-50 cursor-not-allowed grayscale' : ''}
              `}
            >
              {/* Background glowing effect inside dropzone on hover */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              <div className="relative z-10 p-6 rounded-full bg-background border shadow-sm group-hover:scale-110 group-hover:shadow-lg transition-all duration-500 mb-6">
                <Cloud className="w-12 h-12 text-primary/70 group-hover:text-primary transition-colors duration-300" />
                <div className="absolute -bottom-2 -right-2 p-2.5 bg-primary rounded-full shadow-lg group-hover:animate-bounce">
                  <Upload className="w-5 h-5 text-primary-foreground" />
                </div>
              </div>
              
              <h3 className="relative z-10 text-xl md:text-2xl font-bold text-foreground mb-2 text-center">Drag & Drop your PDFs here</h3>
              <p className="relative z-10 text-sm md:text-base text-muted-foreground text-center mb-2">or click to browse from your device</p>
              
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={isUploading || serviceStatus !== 'ready'}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
              />
            </div>

            {/* File list */}
            {items.length > 0 && (
              <div className="mt-8 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h4 className="text-sm font-bold text-foreground mb-4">Selected Resources</h4>
                {items.map(item => (
                  <div key={item.id} className="group flex items-center gap-4 p-4 rounded-2xl border border-border/60 bg-background/80 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className={`p-3 rounded-xl transition-colors duration-300 ${
                      item.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                      item.status === 'error' ? 'bg-destructive/15 text-destructive' :
                      item.status === 'uploading' ? 'bg-primary/15 text-primary' :
                      'bg-secondary text-muted-foreground'
                    }`}>
                      {item.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> :
                       item.status === 'error' ? <AlertCircle className="w-6 h-6" /> :
                       item.status === 'uploading' ? <Loader2 className="w-6 h-6 animate-spin" /> :
                       <FileText className="w-6 h-6" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs font-medium text-muted-foreground">{formatFileSize(item.size)}</p>
                        {item.status === 'uploading' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary animate-pulse">Uploading...</span>
                        )}
                      </div>
                      {item.status === 'error' && (
                        <p className="text-xs font-medium text-destructive mt-1.5 bg-destructive/10 inline-block px-2 py-0.5 rounded">{item.error}</p>
                      )}
                    </div>
                    
                    {!isUploading && (
                      <button 
                        onClick={() => removeItem(item.id)} 
                        className="p-2.5 hover:bg-destructive hover:text-destructive-foreground rounded-full transition-all duration-200 text-muted-foreground opacity-60 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Contribution Details Form */}
            {!isUploading && items.length > 0 && pendingCount > 0 && (
              <div className="mt-8 pt-8 border-t border-border/50 animate-in fade-in duration-500">
                <h4 className="text-sm font-bold text-foreground mb-5">Contribution Details</h4>
                <div className="space-y-5">
                  
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Your Name (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Aryan - BCA 2nd Sem"
                        value={formData.name || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-3.5 rounded-xl border border-border/60 bg-background/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm shadow-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5" /> External Link (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Paste Google Drive / Dropbox link here"
                        value={formData.link || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                        className="w-full px-4 py-3.5 rounded-xl border border-border/60 bg-background/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">About these files</label>
                    <textarea
                      placeholder="Which subject/year are these notes from?"
                      value={formData.message || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      className="w-full px-4 py-3.5 rounded-xl border border-border/60 bg-background/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm shadow-sm resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Upload Actions */}
            {items.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-8 border-t border-border/50">
                {completedCount > 0 ? (
                  <button 
                    onClick={clearCompleted} 
                    className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors"
                  >
                    Clear History
                  </button>
                ) : <div />}
                
                {pendingCount > 0 && !isUploading && (
                  <button
                    onClick={startUpload}
                    disabled={serviceStatus !== 'ready'}
                    className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Submit Files ({pendingCount})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Direct Telegram Contact Card (New Section) */}
        <div className="rounded-[2rem] bg-gradient-to-br from-blue-500/10 to-primary/5 border border-blue-500/20 p-8 text-center relative overflow-hidden group">
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-full mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Have a Google Drive link to share?</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              If you don't want to upload files directly, you can easily send us your Google Drive or Dropbox links via Telegram. We are highly active there!
            </p>
            <a 
              href={`https://t.me/${TELEGRAM_USERNAME}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0088cc] hover:bg-[#007ab8] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#0088cc]/30 hover:shadow-[#0088cc]/50 hover:-translate-y-0.5 transition-all duration-300"
            >
              <Send className="w-4 h-4" />
              Direct Message on Telegram
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-background/50 mt-auto z-10">
        <div className="container mx-auto px-4 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-foreground tracking-tight">PYQERA</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium text-center md:text-left">
            Built by students, for students. Share knowledge, grow together.
          </p>
          <div className="flex gap-4 text-xs font-semibold text-muted-foreground">
            <span className="hover:text-primary cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-primary cursor-pointer transition-colors">Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}