'use client';

import React, { useState, useCallback } from 'react';
import { 
  Moon, Sun, Upload, X, CheckCircle2, 
  AlertCircle, Loader2, FileText, 
  GraduationCap, Send, Link as LinkIcon, MessageSquare,
  Heart, Copy, Check, XCircle, FolderOpen, Sparkles, Zap, MessageCircle
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
const TELEGRAM_USERNAME = 'your_username'; // Bina @ ke username
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

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isDark) document.documentElement.classList.add('dark');
  return isDark ? 'dark' : 'light';
}

// Main Component
export default function HomePage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [newLink, setNewLink] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({});
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme());
  const [activeTab, setActiveTab] = useState<'files' | 'links'>('files');
  const [linkCopied, setLinkCopied] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState<string | null>(null);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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

  const handleDrop = useCallback((e: React.DragEvent) => {
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

  const uploadFile = async (item: UploadItem): Promise<boolean> => {
    const caption = `📚 PYQERA\n👤 ${formData.name || 'Anonymous'}\n💬 ${formData.message || 'N/A'}\n📄 ${item.name}\n📝 ${item.description || 'No description'}\n📊 ${formatFileSize(item.size)}`;
    const formDataToSend = new FormData();
    formDataToSend.append('file', item.file);
    formDataToSend.append('fileName', item.name);
    formDataToSend.append('caption', caption);

    try {
      const response = await fetch(`${SERVICE_URL}/upload`, { method: 'POST', headers: { 'X-Upload-Id': item.id }, body: formDataToSend });
      const result = await response.json();
      if (result.success) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i));
        return true;
      }
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: result.error || 'Failed' } : i));
      return false;
    } catch {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: 'Network error' } : i));
      return false;
    }
  };

  const submitLink = async (item: LinkItem): Promise<boolean> => {
    const caption = `📚 PYQERA Link\n👤 ${formData.name || 'Anonymous'}\n💬 ${formData.message || 'N/A'}\n🔗 ${item.url}\n📝 ${item.description || 'N/A'}`;
    try {
      const response = await fetch(`${SERVICE_URL}/upload-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, url: item.url }) });
      const result = await response.json();
      if (result.success) {
        setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed' } : i));
        return true;
      }
      setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: result.error || 'Failed' } : i));
      return false;
    } catch {
      setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: 'Network error' } : i));
      return false;
    }
  };

  const startUpload = async () => {
    const pendingFiles = items.filter(item => item.status === 'pending');
    const pendingLinks = linkItems.filter(item => item.status === 'pending');
    if (pendingFiles.length === 0 && pendingLinks.length === 0) return;

    setIsUploading(true);
    setError(null);

    for (const item of pendingFiles) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));
      await uploadFile(item);
    }
    for (const item of pendingLinks) {
      setLinkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));
      await submitLink(item);
    }

    setIsUploading(false);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(item => item.id !== id));
  const removeLink = (id: string) => setLinkItems(prev => prev.filter(item => item.id !== id));
  const clearCompleted = () => {
    setItems(prev => prev.filter(item => item.status !== 'completed' && item.status !== 'error'));
    setLinkItems(prev => prev.filter(item => item.status !== 'completed' && item.status !== 'error'));
    setFormData({});
  };

  const copyTelegramLink = () => {
    navigator.clipboard.writeText(`https://t.me/${TELEGRAM_USERNAME}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const pendingFiles = items.filter(i => i.status === 'pending').length;
  const pendingLinks = linkItems.filter(i => i.status === 'pending').length;
  const totalPending = pendingFiles + pendingLinks;
  const totalItems = items.length + linkItems.length;
  const completedItems = items.filter(i => i.status === 'completed').length + linkItems.filter(i => i.status === 'completed').length;
  const uploadingItems = items.filter(i => i.status === 'uploading').length + linkItems.filter(i => i.status === 'uploading').length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 selection:bg-primary/20 transition-colors duration-500">
      
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-gradient-to-br from-purple-500/10 to-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-primary/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 group-hover:scale-105 transition-all duration-300">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">PYQERA</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary/80">Community</p>
            </div>
          </div>
          
          <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:scale-110 hover:rotate-12 transition-all duration-300 text-slate-600 dark:text-slate-400">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        
        {/* Hero */}
        <div className="text-center mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3 border border-primary/20">
            <Sparkles className="w-3 h-3" />
            Share & Help Students
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-2">
            Upload Notes & <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">PYQs</span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">Help thousands of students by sharing your study materials</p>
        </div>

        {/* Two Options Grid */}
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          
          {/* Option 1: Website Upload */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden animate-in fade-in slide-in-from-left-4 duration-700">
            
            {/* Tab Header */}
            <div className="flex border-b border-slate-200/50 dark:border-slate-800/50">
              <button onClick={() => setActiveTab('files')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all relative ${activeTab === 'files' ? 'text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <Upload className="w-4 h-4" />
                Files {items.length > 0 && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-white">{items.length}</span>}
                {activeTab === 'files' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
              <button onClick={() => setActiveTab('links')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all relative ${activeTab === 'links' ? 'text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <LinkIcon className="w-4 h-4" />
                Links {linkItems.length > 0 && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-white">{linkItems.length}</span>}
                {activeTab === 'links' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
            </div>

            <div className="p-4">
              {/* Files Tab */}
              {activeTab === 'files' && (
                <div className="space-y-3">
                  {/* Drop Zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 group ${isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-slate-300 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-300">
                      <FolderOpen className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Drop files or click</p>
                    <p className="text-xs text-slate-500 mt-0.5">PDF, Images, Docs supported</p>
                    <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>

                  {/* Files List */}
                  {items.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar animate-in fade-in duration-300">
                      {items.map((item, idx) => (
                        <div key={item.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg overflow-hidden group animate-in slide-in-from-right-2 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                          {/* File Row */}
                          <div className="flex items-center gap-2 p-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-400 flex-shrink-0">{idx + 1}</span>
                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${item.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : item.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : item.status === 'uploading' ? 'bg-primary/10 text-primary' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                              {item.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : item.status === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : item.status === 'uploading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{item.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] text-slate-500">{formatFileSize(item.size)}</p>
                                {item.description && <p className="text-[10px] text-primary truncate">• {item.description}</p>}
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            {item.status === 'pending' && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setExpandedDesc(expandedDesc === item.id ? null : item.id)} 
                                  className={`p-1 rounded transition-all ${expandedDesc === item.id ? 'bg-primary/10 text-primary' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-primary'}`}
                                  title="Add description"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => removeItem(item.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-all">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Description Input (Expandable) */}
                          {expandedDesc === item.id && item.status === 'pending' && (
                            <div className="px-2 pb-2 pt-0 animate-in fade-in slide-in-from-top-2 duration-200">
                              <input
                                type="text"
                                placeholder="e.g., BCA 3rd Sem Computer Networks"
                                value={item.description || ''}
                                onChange={(e) => updateItemDescription(item.id, e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none transition-all"
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
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Paste any cloud link..." value={newLink} onChange={(e) => setNewLink(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                    <button onClick={addLink} disabled={!newLink.trim()} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95">
                      <Zap className="w-4 h-4" />
                    </button>
                  </div>
                  <input type="text" placeholder="Description (optional)" value={newLinkDesc} onChange={(e) => setNewLinkDesc(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />

                  {/* Links List */}
                  {linkItems.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1.5 animate-in fade-in duration-300">
                      {linkItems.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 group animate-in slide-in-from-right-2 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-400">{idx + 1}</span>
                          <div className={`p-1.5 rounded-lg ${item.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : item.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : item.status === 'uploading' ? 'bg-primary/10 text-primary' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                            {item.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : item.status === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : item.status === 'uploading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-primary truncate">{item.url.length > 35 ? item.url.substring(0, 35) + '...' : item.url}</p>
                            {item.description && <p className="text-[10px] text-slate-500 truncate">{item.description}</p>}
                          </div>
                          {item.status === 'pending' && <button onClick={() => removeLink(item.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X className="w-3.5 h-3.5" /></button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* User Details & Submit */}
              {totalItems > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 animate-in fade-in duration-300">
                  <div className="flex gap-2 mb-3">
                    <input type="text" placeholder="Your name (optional)" value={formData.name || ''} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                    <input type="text" placeholder="Subject/Semester" value={formData.message || ''} onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                  </div>
                  
                  {/* Stats Bar */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {totalItems > 0 && <span>{totalItems} total</span>}
                      {completedItems > 0 && <span className="text-emerald-600">{completedItems} done</span>}
                      {uploadingItems > 0 && <span className="text-primary">{uploadingItems} uploading</span>}
                    </div>
                    {completedItems > 0 && <button onClick={clearCompleted} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Clear done</button>}
                  </div>

                  {/* Submit Button */}
                  {totalPending > 0 && (
                    <button onClick={startUpload} className="w-full py-2.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 animate-in fade-in duration-300">
                      <Send className="w-4 h-4" />
                      Submit {totalPending} {totalPending === 1 ? 'item' : 'items'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Option 2: Telegram */}
          <div className="bg-gradient-to-br from-[#0088cc]/10 via-[#0088cc]/5 to-blue-500/5 dark:from-[#0088cc]/20 dark:via-[#0088cc]/10 dark:to-blue-500/10 rounded-2xl border border-[#0088cc]/20 p-5 relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-700 group">
            {/* Animated Glow */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#0088cc]/20 rounded-full blur-3xl group-hover:bg-[#0088cc]/30 transition-all duration-700 animate-pulse" style={{ animationDuration: '3s' }} />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#0088cc] flex items-center justify-center shadow-lg shadow-[#0088cc]/30">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#0088cc] uppercase tracking-wider">Quick Option</span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Send via Telegram</h3>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Share files, links, or PYQs directly with us on Telegram. Quick response guaranteed!
              </p>

              {/* Features */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {['Large files', 'Any link', 'Quick reply', 'Direct chat'].map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0088cc]" />
                    {f}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <a href={`https://t.me/${TELEGRAM_USERNAME}`} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#0088cc]/25 hover:shadow-[#0088cc]/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300">
                  <Send className="w-4 h-4" />
                  Open Telegram
                </a>
                <button onClick={copyTelegramLink} className="px-4 py-2.5 bg-white/50 dark:bg-white/10 hover:bg-white/70 dark:hover:bg-white/20 border border-[#0088cc]/20 rounded-xl transition-all hover:scale-105 active:scale-95">
                  {linkCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center py-3 animate-in fade-in duration-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
            <Heart className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
            Your contribution helps students prepare better
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">PYQERA</span>
          </div>
          <p className="text-xs text-slate-500">Built by students, for students</p>
        </div>
      </footer>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 z-50 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500 text-white rounded-xl shadow-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium flex-1">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded"><XCircle className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Upload Progress Toast */}
      {isUploading && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-full shadow-lg shadow-primary/30">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Uploading...</span>
          </div>
        </div>
      )}
    </div>
  );
}
