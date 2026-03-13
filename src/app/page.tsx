'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Moon, Sun, Upload, Shield, Zap, File, X, CheckCircle2, 
  AlertCircle, Clock, Loader2, BookOpen, FileText, 
  GraduationCap, Lock, Cloud, type LucideIcon 
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
  message?: string;
}

// Constants
const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB
const SERVICE_URL = 'https://telegram-file-upload-3gal.onrender.com';

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
          setError('Upload service is not ready. Check mini-service terminal.');
        }
      } catch (err) {
        setServiceStatus('error');
        setError('Cannot connect to upload service. Make sure mini-service is running on port 3002.');
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
    const caption = `📚 PYQERA Upload\n📄 File: ${item.name}\n📊 Size: ${formatFileSize(item.size)}\n👤 Uploader: ${formData.name || 'Anonymous Student'}\n💬 Notes: ${formData.message || 'N/A'}\n🕐 Time: ${new Date().toLocaleString()}`;
    
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
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const completedCount = items.filter(i => i.status === 'completed').length;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      
      {/* Premium Background Elements */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-primary/5 via-primary/5 to-transparent pointer-events-none"></div>
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none"></div>

      {/* Enterprise Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo Area */}
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-black tracking-tight leading-none text-foreground">
                  PYQERA
                </h1>
                <span className="text-[10px] font-bold tracking-widest uppercase text-primary mt-1">
                  Secure Vault
                </span>
              </div>
            </div>

            {/* Right Side Tools */}
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
                <div className={`w-2 h-2 rounded-full ${
                  serviceStatus === 'checking' ? 'bg-yellow-400 animate-pulse' :
                  serviceStatus === 'ready' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-destructive'
                }`}></div>
                <span className="text-xs font-medium text-muted-foreground">
                  {serviceStatus === 'checking' && 'Connecting to Servers...'}
                  {serviceStatus === 'ready' && 'System Operational'}
                  {serviceStatus === 'error' && 'System Offline'}
                </span>
              </div>

              <div className="w-px h-6 bg-border hidden md:block"></div>

              <button 
                onClick={toggleTheme} 
                className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border transition-all duration-200 text-muted-foreground hover:text-foreground"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl relative z-10">
        
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-foreground">
            Securely upload your study materials
          </h2>
          <p className="text-base text-muted-foreground">
            PYQERA provides an enterprise-grade infrastructure to store and share Previous Year Questions, lecture notes, and heavy PDF resources seamlessly.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <FeatureCard icon={Zap} title="Instant Sync" description="Optimized for heavy educational PDFs & resources." />
          <FeatureCard icon={Lock} title="E2E Encrypted" description="MTProto technology protects your intellectual property." />
          <FeatureCard icon={BookOpen} title="Limitless Storage" description="Upload entire semesters' data up to 1.5GB per file." />
        </div>

        {/* Service Alert */}
        {serviceStatus === 'error' && (
          <div className="mb-8 p-4 rounded-xl border-l-4 border-l-destructive bg-destructive/5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Backend Services Offline</p>
              <p className="text-xs text-destructive/80 mt-1">
                Please ensure the PYQERA core service is running. Execute <code className="bg-destructive/10 px-1 rounded font-mono">npm run dev</code> in the mini-services directory.
              </p>
            </div>
          </div>
        )}

        {/* Upload Interface */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-xl shadow-black/5 overflow-hidden">
          <div className="p-6 md:p-10">
            
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center w-full min-h-[260px] p-8 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer
                ${isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/40 hover:bg-secondary/30'
                } 
                ${isUploading || serviceStatus !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="p-4 rounded-full bg-secondary mb-4">
                <Cloud className="w-8 h-8 text-primary" />
              </div>
              
              <h3 className="text-lg font-semibold text-foreground mb-1">Select files to upload</h3>
              <p className="text-sm text-muted-foreground mb-6">Drag and drop your PDFs, DOCXs, or ZIP files here</p>
              
              <div className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center gap-2 border border-primary/20">
                <Shield className="w-3.5 h-3.5" />
                Secure MTProto Upload • Max 1.5GB
              </div>
              
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={isUploading || serviceStatus !== 'ready'}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
            </div>

            {/* File list */}
            {items.length > 0 && (
              <div className="mt-8 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Staged Resources</h4>
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-3.5 rounded-xl border border-border/50 bg-background shadow-sm hover:shadow transition-shadow">
                    <div className={`p-2.5 rounded-lg ${
                      item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      item.status === 'error' ? 'bg-destructive/10 text-destructive' :
                      item.status === 'uploading' ? 'bg-primary/10 text-primary' :
                      'bg-secondary text-muted-foreground'
                    }`}>
                      {item.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                       item.status === 'error' ? <AlertCircle className="w-5 h-5" /> :
                       item.status === 'uploading' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                       <FileText className="w-5 h-5" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{formatFileSize(item.size)}</p>
                        {item.status === 'uploading' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Uploading...</span>
                        )}
                      </div>
                      {item.status === 'error' && (
                        <p className="text-xs text-destructive mt-1">{item.error}</p>
                      )}
                    </div>
                    
                    {!isUploading && (
                      <button 
                        onClick={() => removeItem(item.id)} 
                        className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Form Details */}
            {!isUploading && items.length > 0 && pendingCount > 0 && (
              <div className="mt-8 pt-8 border-t border-border/50">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Resource Meta-Data</h4>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">Uploader Alias (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul - Sem 3 IT"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">Resource Details</label>
                    <textarea
                      placeholder="e.g. Operating Systems Chapter 4 Notes + PYQs..."
                      value={formData.message || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions Block */}
            {items.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-border/50">
                {completedCount > 0 ? (
                  <button 
                    onClick={clearCompleted} 
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                  >
                    Clear History
                  </button>
                ) : <div />}
                
                {pendingCount > 0 && !isUploading && (
                  <button
                    onClick={startUpload}
                    disabled={serviceStatus !== 'ready'}
                    className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Secure Upload ({pendingCount})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Professional Corporate Footer */}
      <footer className="border-t border-border/50 bg-card mt-auto z-10">
        <div className="container mx-auto px-4 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-black tracking-tight text-foreground">PYQERA</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                Empowering learners with high-quality previous year questions, notes, and study materials. Our Secure Vault utilizes enterprise-grade MTProto technology to ensure your educational resources are stored safely and accessible instantly.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="hover:text-primary cursor-pointer transition-colors">Study Materials</li>
                <li className="hover:text-primary cursor-pointer transition-colors">University PYQs</li>
                <li className="hover:text-primary cursor-pointer transition-colors">Notes & More</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="hover:text-primary cursor-pointer transition-colors">About Us</li>
                <li className="hover:text-primary cursor-pointer transition-colors">Contact Support</li>
                <li className="hover:text-primary cursor-pointer transition-colors">System Status</li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} PYQERA Technologies. All rights reserved.
            </p>
 
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex flex-col p-5 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="text-sm font-bold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}