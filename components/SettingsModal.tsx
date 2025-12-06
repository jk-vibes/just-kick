import React, { useRef, useState } from 'react';
import { X, Plus, Trash2, Settings, Tag, Moon, Sun, Monitor, Download, Upload, HardDrive, AlertCircle, CheckCircle2, Clipboard, Map, Database, Globe } from 'lucide-react';
import type { Theme } from '../App';
import { localDB } from '../services/db';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customBuckets: string[];
  setCustomBuckets: (val: string[]) => void;
  customInterests: string[];
  setCustomInterests: (val: string[]) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onImport: (data: any) => void;
  onImportFromText: (text: string) => void;
  onImportGoogleTakeout: (json: string) => void;
  onLoad7Wonders: () => void;
  onLoadNearbyDemo: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  customBuckets,
  setCustomBuckets,
  customInterests,
  setCustomInterests,
  theme,
  setTheme,
  onImport,
  onImportFromText,
  onImportGoogleTakeout,
  onLoad7Wonders,
  onLoadNearbyDemo
}) => {
  const [newBucket, setNewBucket] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [importMsg, setImportMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [clipboardText, setClipboardText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const takeoutInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAddBucket = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBucket.trim() && !customBuckets.includes(newBucket.trim())) {
      setCustomBuckets([...customBuckets, newBucket.trim()]);
      setNewBucket('');
    }
  };

  const handleDeleteBucket = (tag: string) => {
    setCustomBuckets(customBuckets.filter(t => t !== tag));
  };

  const handleAddInterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (newInterest.trim() && !customInterests.includes(newInterest.trim())) {
      setCustomInterests([...customInterests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const handleDeleteInterest = (tag: string) => {
    setCustomInterests(customInterests.filter(t => t !== tag));
  };

  const handleExport = async () => {
    try {
      await localDB.exportBackup(customBuckets, customInterests);
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to export data");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await localDB.importBackup(file);
      onImport(data);
      setImportMsg({ type: 'success', text: `Restored ${data.items.length} items successfully.` });
    } catch (err) {
      console.error(err);
      setImportMsg({ type: 'error', text: "Invalid backup file." });
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTextImport = () => {
    if (!clipboardText.trim()) return;
    onImportFromText(clipboardText);
    setClipboardText('');
    setImportMsg({ type: 'success', text: 'Items imported from text successfully.' });
  };

  const handleTakeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        onImportGoogleTakeout(json);
        setImportMsg({ type: 'success', text: 'Google Takeout data processed.' });
      } catch (err) {
        setImportMsg({ type: 'error', text: 'Invalid JSON file.' });
      }
    };
    reader.readAsText(file);
    if (takeoutInputRef.current) takeoutInputRef.current.value = '';
  };

  const handle7WondersClick = () => {
    onLoad7Wonders();
    setImportMsg({ type: 'success', text: '7 Wonders demo data loaded!' });
  };

  const handleNearbyClick = () => {
    onLoadNearbyDemo();
    setImportMsg({ type: 'success', text: 'Nearby demo data loaded!' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 shadow-xl max-h-[85vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Settings className="text-gray-700 dark:text-gray-200" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-8">
          
          {/* Appearance */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Monitor size={16} /> Appearance
            </h3>
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button 
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  theme === 'light' 
                    ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-600 dark:text-white' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Sun size={16} /> Light
              </button>
              <button 
                 onClick={() => setTheme('dark')}
                 className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                   theme === 'dark' 
                     ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-600 dark:text-white' 
                     : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                 }`}
              >
                <Moon size={16} /> Dark
              </button>
              <button 
                 onClick={() => setTheme('system')}
                 className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                   theme === 'system' 
                     ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-600 dark:text-white' 
                     : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                 }`}
              >
                <Monitor size={16} /> System
              </button>
            </div>
          </section>

          <div className="h-px bg-gray-100 dark:bg-gray-700 w-full"></div>

          {/* Quick Import */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clipboard size={16} /> Quick Import
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Paste your bucket list (e.g. from Instagram notes) here. One item per line.
            </p>
            <div className="space-y-2">
              <textarea 
                value={clipboardText}
                onChange={(e) => setClipboardText(e.target.value)}
                placeholder="Visit Paris&#10;Skydiving&#10;Learn Guitar"
                className="w-full h-24 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              <button 
                onClick={handleTextImport}
                disabled={!clipboardText.trim()}
                className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Items
              </button>
            </div>
          </section>

          <div className="h-px bg-gray-100 dark:bg-gray-700 w-full"></div>

          {/* Data & Backup */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
              <HardDrive size={16} /> Data & Backup
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Manage your data source and backups.
            </p>

            <div className="flex flex-col gap-3">
              <div className="relative">
                <input 
                  ref={takeoutInputRef}
                  type="file" 
                  accept=".json"
                  onChange={handleTakeoutChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium transition-colors border border-blue-200 dark:border-blue-800 pointer-events-none">
                  <Map size={16} /> Import Google Takeout (Saved Places)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleExport}
                  className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-gray-600"
                >
                  <Download size={16} />
                  Export
                </button>

                <div className="relative">
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".json"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <button 
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-gray-600 pointer-events-none"
                  >
                    <Upload size={16} />
                    Restore
                  </button>
                </div>
              </div>

              {/* Demo Data Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={handle7WondersClick}
                  className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-gray-600"
                >
                  <Globe size={16} />
                  Load 7 Wonders
                </button>
                <button 
                  onClick={handleNearbyClick}
                  className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-gray-600"
                >
                  <Database size={16} />
                  Load Nearby Demo
                </button>
              </div>

              {importMsg && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-xs font-medium ${
                  importMsg.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {importMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {importMsg.text}
                </div>
              )}
            </div>
          </section>

          <div className="h-px bg-gray-100 dark:bg-gray-700 w-full"></div>

          {/* Manage Buckets */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Tag size={16} /> Manage Buckets
            </h3>
            
            <form onSubmit={handleAddBucket} className="flex gap-2 mb-3">
              <input
                type="text"
                value={newBucket}
                onChange={(e) => setNewBucket(e.target.value)}
                placeholder="New Bucket (e.g. Hiking)"
                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button 
                type="submit"
                disabled={!newBucket.trim()}
                className="bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={20} />
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {customBuckets.length === 0 ? (
                <span className="text-xs text-gray-400 italic">No custom buckets added.</span>
              ) : (
                customBuckets.map(bucket => (
                  <span key={bucket} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800">
                    {bucket}
                    <button 
                      onClick={() => handleDeleteBucket(bucket)}
                      className="text-brand-400 hover:text-brand-600 dark:hover:text-brand-200 ml-1"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </section>

          <div className="h-px bg-gray-100 dark:bg-gray-700 w-full"></div>

          {/* Manage Interests */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Tag size={16} /> Manage Interests
            </h3>

            <form onSubmit={handleAddInterest} className="flex gap-2 mb-3">
              <input
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                placeholder="New Interest (e.g. Weekend Trip)"
                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button 
                type="submit"
                disabled={!newInterest.trim()}
                className="bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={20} />
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {customInterests.length === 0 ? (
                <span className="text-xs text-gray-400 italic">No custom interests added.</span>
              ) : (
                customInterests.map(interest => (
                  <span key={interest} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                    {interest}
                    <button 
                      onClick={() => handleDeleteInterest(interest)}
                      className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 ml-1"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};