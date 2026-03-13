'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Moon, Sun, Upload, Shield, Zap, File, X, CheckCircle2, AlertCircle, Clock, Loader2, type LucideIcon } from 'lucide-react';

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
const SERVICE_URL = 'http://localhost:3002';

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
    // Check every 5 seconds
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
    const caption = `📁 File: ${item.name}\n📊 Size: ${formatFileSize(item.size)}\n👤 Name: ${formData.name || 'Anonymous'}\n💬 Message: ${formData.message || 'N/A'}\n🕐 Uploaded: ${new Date().toLocaleString()}`;
    
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
        i.id === item.id ? { ...i, status: 'error', error: 'Network error - is mini-service running?' } : i
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-accent/5">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/80">
                <Upload className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">FileDrop</h1>
                <p className="text-xs text-muted-foreground">
                  {serviceStatus === 'checking' && 'Checking service...'}
                  {serviceStatus === 'ready' && '✅ Service Ready'}
                  {serviceStatus === 'error' && '⚠️ Service Offline'}
                </p>
              </div>
            </div>

            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-accent transition-colors">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <FeatureCard icon={Zap} title="Fast Upload" description="Direct streaming" />
          <FeatureCard icon={Shield} title="Secure" description="End-to-end encrypted" />
          <FeatureCard icon={File} title="Large Files" description="Up to 1.5 GB" />
        </div>

        {/* Service Status Banner */}
        {serviceStatus === 'error' && (
          <div className="mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              ⚠️ Upload service not running
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Run in separate terminal: <code className="bg-muted px-1 rounded">cd mini-services/telegram-upload && npm run dev</code>
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/10">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Main upload card */}
        <div className="rounded-2xl border bg-card shadow-xl overflow-hidden">
          <div className="p-6 space-y-6">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center w-full min-h-[200px] p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              } ${isUploading || serviceStatus !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="relative p-4 rounded-full bg-primary/10">
                <File className="w-10 h-10 text-primary" />
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-primary rounded-full">
                  <Upload className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
              <p className="text-lg font-medium mt-4">Drag and drop files here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-2">Maximum file size: 1.5 GB</p>
              
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
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="p-4 rounded-xl border bg-background">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        item.status === 'completed' ? 'bg-green-500/10' :
                        item.status === 'error' ? 'bg-destructive/10' :
                        item.status === 'uploading' ? 'bg-primary/10' :
                        'bg-muted'
                      }`}>
                        {item.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
                         item.status === 'error' ? <AlertCircle className="w-5 h-5 text-destructive" /> :
                         item.status === 'uploading' ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> :
                         <Clock className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(item.size)}</p>
                        {item.status === 'error' && (
                          <p className="text-sm text-destructive mt-1">{item.error}</p>
                        )}
                      </div>
                      
                      {!isUploading && (
                        <button onClick={() => removeItem(item.id)} className="p-2 hover:bg-destructive/10 rounded-full transition-colors">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Optional form */}
            {!isUploading && items.length > 0 && pendingCount > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <input
                  type="text"
                  placeholder="Your Name (optional)"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border bg-background"
                />
                <textarea
                  placeholder="Message (optional)"
                  value={formData.message || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border bg-background resize-none"
                  rows={2}
                />
              </div>
            )}

            {/* Actions */}
            {items.length > 0 && (
              <div className="flex items-center gap-3 pt-4 border-t">
                {completedCount > 0 && (
                  <button onClick={clearCompleted} className="px-4 py-2 text-sm border rounded-lg hover:bg-accent transition-colors">
                    Clear Completed
                  </button>
                )}
                
                <div className="ml-auto flex items-center gap-3">
                  {pendingCount > 0 && !isUploading && (
                    <button
                      onClick={startUpload}
                      disabled={serviceStatus !== 'ready'}
                      className="px-6 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Upload ({pendingCount})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/80 backdrop-blur-sm mt-auto">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Powered by Telegram MTProto • Files are stored securely
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-b from-accent/50 to-transparent border border-border/50">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}