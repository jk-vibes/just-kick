import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Navigation, Map as MapIcon, List, LocateFixed, User as UserIcon, LogOut, Cloud, CloudOff, Globe, AlertTriangle, Settings, CheckCircle2, Filter, ArrowUpDown, Database } from 'lucide-react';
import { BucketItem, GeoLocation, User } from './types';
import { calculateDistance } from './utils/geoUtils';
import { BucketCard } from './components/BucketCard';
import { AddModal } from './components/AddModal';
import { AuthModal } from './components/AuthModal';
import { MainMapView } from './components/MainMapView';
import { SettingsModal } from './components/SettingsModal';
import { cloudService, isUsingMock } from './services/cloudService';
import { localDB } from './services/db';

// Proximity threshold in meters to trigger notification
const PROXIMITY_THRESHOLD = 2000;

type ViewMode = 'list' | 'map';
export type Theme = 'light' | 'dark' | 'system';
type SortOption = 'date' | 'distance';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  // Data State
  const [items, setItems] = useState<BucketItem[]>([]);
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null);
  
  // Custom Settings State (Dropdowns)
  const [customBuckets, setCustomBuckets] = useState<string[]>(() => {
    const saved = localStorage.getItem('jk_custom_buckets');
    return saved ? JSON.parse(saved) : [];
  });
  const [customInterests, setCustomInterests] = useState<string[]>(() => {
    const saved = localStorage.getItem('jk_custom_interests');
    return saved ? JSON.parse(saved) : [];
  });

  // Theme State
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('jk_theme');
    return (saved as Theme) || 'system';
  });
  
  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingItem, setEditingItem] = useState<BucketItem | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [geoError, setGeoError] = useState<string | null>(null);
  
  // Filtering & Sorting State
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterInterest, setFilterInterest] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [showFilters, setShowFilters] = useState(false);
  
  // Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem('jk_theme', theme);
  }, [theme]);

  // Save custom settings when changed
  useEffect(() => {
    localStorage.setItem('jk_custom_buckets', JSON.stringify(customBuckets));
  }, [customBuckets]);

  useEffect(() => {
    localStorage.setItem('jk_custom_interests', JSON.stringify(customInterests));
  }, [customInterests]);

  // Calculate unique existing buckets and interests for the dropdowns
  const uniqueBuckets = useMemo(() => {
    return Array.from(new Set(items.map(i => i.category))).filter(Boolean);
  }, [items]);

  const uniqueInterests = useMemo(() => {
    return Array.from(new Set(items.map(i => i.interest))).filter(Boolean);
  }, [items]);

  // Filter items for display
  const displayedItems = useMemo(() => {
    let filtered = items.filter(item => {
      // 1. Completion Status
      if (showCompletedOnly ? !item.completed : item.completed) return false;
      
      // 2. Category Filter
      if (filterCategory && item.category !== filterCategory) return false;
      
      // 3. Interest Filter
      if (filterInterest && item.interest !== filterInterest) return false;

      return true;
    });

    // Sort Logic
    return filtered.sort((a, b) => {
      if (sortBy === 'distance' && currentLocation) {
        const distA = calculateDistance(currentLocation, a.targetLocation);
        const distB = calculateDistance(currentLocation, b.targetLocation);
        return distA - distB;
      } else {
        // Default: Date Sort
        if (showCompletedOnly) {
           return (b.completedAt || 0) - (a.completedAt || 0);
        }
        return b.createdAt - a.createdAt;
      }
    });
  }, [items, showCompletedOnly, filterCategory, filterInterest, sortBy, currentLocation]);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = cloudService.onAuthChange((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Sync Logic (Local vs Cloud)
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const loadItems = async () => {
      if (user) {
        // CLOUD MODE
        setIsCloudLoading(true);
        unsubscribe = cloudService.subscribeToItems(user.uid, (cloudItems) => {
          setItems(cloudItems);
          setIsCloudLoading(false);
        });
      } else {
        // LOCAL DB MODE
        setIsCloudLoading(true);
        try {
          const dbItems = await localDB.getAllItems();
          // Sort by createdAt desc
          dbItems.sort((a, b) => b.createdAt - a.createdAt);
          setItems(dbItems);
        } catch (e) {
          console.error("Failed to load from local DB", e);
        } finally {
          setIsCloudLoading(false);
        }
      }
    };

    loadItems();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Check Notification Permissions on Mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
    } catch (e) {
      console.error("Failed to request notification permission", e);
    }
  };

  // Location Tracking Logic
  const updateLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser");
      setIsTracking(false);
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setGeoError(null);
      const newLoc = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setCurrentLocation(newLoc);
      checkProximity(newLoc);
    };

    const handleError = (error: GeolocationPositionError, isLowAccuracy: boolean) => {
      console.error(`Location error details: code=${error.code}, message=${error.message}`);
      
      // Error Code 3 = TIMEOUT
      if (error.code === 3 && !isLowAccuracy) {
        console.warn("High accuracy GPS timed out. Retrying with low accuracy (Wifi/Cell towers)...");
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (err) => handleError(err, true),
          { enableHighAccuracy: false, timeout: 30000, maximumAge: Infinity }
        );
        return;
      }

      let msg = "Unable to retrieve location.";
      switch(error.code) {
        case 1: // PERMISSION_DENIED
          msg = "Location permission denied. Please enable it in your browser settings.";
          setIsTracking(false);
          break;
        case 2: // POSITION_UNAVAILABLE
          msg = "Location information is unavailable.";
          break;
        case 3: // TIMEOUT
          msg = "Location request timed out. Please check your signal or move to an open area.";
          break;
      }
      setGeoError(msg);
    };

    // Attempt 1: High Accuracy (GPS), but relaxed timeout (30s) and cache age (60s)
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => handleError(err, false),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling Effect
  useEffect(() => {
    let intervalId: number;
    if (isTracking) {
      updateLocation(); // Initial call
      intervalId = window.setInterval(updateLocation, 10000); // Check every 10s (relaxed polling)
    }
    return () => clearInterval(intervalId);
  }, [isTracking, updateLocation]);

  const checkProximity = (currentLoc: GeoLocation) => {
    setItems(prevItems => {
      let hasChanges = false;
      const newItems = prevItems.map(item => {
        if (item.completed || item.notified) return item;

        const dist = calculateDistance(currentLoc, item.targetLocation);
        if (dist < PROXIMITY_THRESHOLD) {
          sendNotification(item);
          hasChanges = true;
          return { ...item, notified: true };
        }
        return item;
      });
      
      return hasChanges ? newItems : prevItems;
    });
  };

  const sendNotification = (item: BucketItem) => {
    if (permissionStatus === 'granted') {
      try {
        new Notification("You're close!", {
          body: `You are near "${item.title}". Time to check it off your bucket list!`,
          icon: 'https://cdn-icons-png.flaticon.com/512/854/854878.png'
        });
      } catch (e) {
        console.error("Notification failed", e);
      }
    }
  };

  // --- CRUD Operations (Abstracted for Cloud/Local) ---

  const handleSaveItem = async (title: string, category: string, interest: string, location: GeoLocation, description?: string) => {
    if (editingItem) {
      const updatedItem = { ...editingItem, title, category, interest, targetLocation: location, description };
      
      if (user) {
        await cloudService.updateItem(user.uid, updatedItem);
      } else {
        await localDB.saveItem(updatedItem);
        setItems(prev => prev.map(item => item.id === editingItem.id ? updatedItem : item));
      }
      setEditingItem(null);
    } else {
      const newItem: BucketItem = {
        id: crypto.randomUUID(),
        title,
        category,
        interest,
        targetLocation: location,
        description,
        completed: false,
        notified: false,
        createdAt: Date.now(),
        userId: user?.uid
      };

      if (user) {
        await cloudService.addItem(user.uid, newItem);
      } else {
        await localDB.saveItem(newItem);
        setItems(prev => [newItem, ...prev]);
      }
    }
  };

  const toggleComplete = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    // If marking as complete, add timestamp. If unmarking, remove it (undefined)
    const completed = !item.completed;
    const updatedItem = { 
      ...item, 
      completed,
      completedAt: completed ? Date.now() : undefined 
    };

    if (user) {
      await cloudService.updateItem(user.uid, updatedItem);
    } else {
      await localDB.saveItem(updatedItem);
      setItems(prev => prev.map(i => i.id === id ? updatedItem : i));
    }
  };

  const deleteItem = async (id: string) => {
    if (user) {
      await cloudService.deleteItem(user.uid, id);
    } else {
      await localDB.deleteItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const initiateEdit = (item: BucketItem) => {
    setEditingItem(item);
    setShowAddModal(true);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingItem(null);
  };

  const handleSignOut = () => {
    cloudService.signOut();
    setIsTracking(false);
    setGeoError(null);
  };

  const handleItemClick = (item: BucketItem) => {
    setViewMode('map');
    setFocusedItemId(item.id);
  };

  // --- DEMO LOADERS ---

  const ingestItems = async (itemsData: any[]) => {
    const newItems = itemsData.map(data => ({
        id: crypto.randomUUID(),
        title: data.title,
        description: data.description,
        category: data.category,
        interest: data.interest,
        targetLocation: data.targetLocation,
        completed: false,
        notified: false,
        createdAt: Date.now(),
        userId: user?.uid
    }));

    if (user) {
        setIsCloudLoading(true);
        for (const item of newItems) await cloudService.addItem(user.uid, item);
        setIsCloudLoading(false);
    } else {
        for (const item of newItems) await localDB.saveItem(item);
        const dbItems = await localDB.getAllItems();
        dbItems.sort((a, b) => b.createdAt - a.createdAt);
        setItems(dbItems);
    }
  };

  const handleLoad7Wonders = async () => {
    const wonders = [
      { title: "Great Wall of China", cat: "Adventure", int: "Must try", loc: { lat: 40.4319, lng: 116.5704 } },
      { title: "Petra", cat: "Adventure", int: "Before die", loc: { lat: 30.3285, lng: 35.4444 } },
      { title: "The Colosseum", cat: "Culture", int: "Must try", loc: { lat: 41.8902, lng: 12.4922 } },
      { title: "Chichén Itzá", cat: "Culture", int: "ASAP", loc: { lat: 20.6843, lng: -88.5678 } },
      { title: "Machu Picchu", cat: "Adventure", int: "Before die", loc: { lat: -13.1631, lng: -72.5450 } },
      { title: "Taj Mahal", cat: "Culture", int: "Must try", loc: { lat: 27.1751, lng: 78.0421 } },
      { title: "Christ the Redeemer", cat: "Culture", int: "ASAP", loc: { lat: -22.9519, lng: -43.2105 } },
    ];
    await ingestItems(wonders.map(w => ({ title: w.title, category: w.cat, interest: w.int, targetLocation: w.loc, description: "One of the 7 Wonders" })));
  };

  const handleLoadNearbyDemo = async () => {
    // If no location, default to Chennai for "Local" demo
    const baseLat = currentLocation ? currentLocation.lat : 13.0827;
    const baseLng = currentLocation ? currentLocation.lng : 80.2707;

    const nearbyPlaces = [
      { title: "Nearby Coffee Spot", cat: "Food", int: "Chill", desc: "Best brew in town." },
      { title: "Local Park", cat: "Parks", int: "Chill", desc: "Great for morning walks." },
      { title: "Historic Landmark", cat: "Culture", int: "Must try", desc: "Ancient architecture nearby." },
      { title: "Street Food Market", cat: "Food", int: "ASAP", desc: "Spicy local treats." },
      { title: "Shopping District", cat: "Cities", int: "Chill", desc: "Weekend shopping spree." },
    ];

    const newItems = nearbyPlaces.map(p => {
        // Random scatter 1-3km
        const latOffset = (Math.random() - 0.5) * 0.03; 
        const lngOffset = (Math.random() - 0.5) * 0.03;
        return {
            title: p.title,
            category: p.cat,
            interest: p.int,
            targetLocation: { lat: baseLat + latOffset, lng: baseLng + lngOffset },
            description: p.desc
        };
    });
    await ingestItems(newItems);
  };

  const toggleTracking = () => {
    if (isTracking) {
      setIsTracking(false);
      setGeoError(null);
    } else {
      setIsTracking(true);
      if (permissionStatus === 'default') {
        requestNotificationPermission();
      }
    }
  };

  const handleDataImport = (data: any) => {
    if (Array.isArray(data.items)) setItems(data.items);
    if (Array.isArray(data.customBuckets)) setCustomBuckets(data.customBuckets);
    if (Array.isArray(data.customInterests)) setCustomInterests(data.customInterests);
  };

  const handleTextImport = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const itemsData = lines.map(line => ({
        title: line.trim(),
        category: 'Imported',
        interest: 'Before die',
        targetLocation: currentLocation || { lat: 0, lng: 0 },
        description: 'Imported from text list'
    }));
    ingestItems(itemsData);
  };

  const handleGoogleTakeoutImport = (jsonText: string) => {
    try {
        const data = JSON.parse(jsonText);
        const itemsData: any[] = [];
        
        if (data.features && Array.isArray(data.features)) {
            data.features.forEach((feature: any) => {
                if (feature.geometry && feature.properties) {
                    const title = feature.properties.Title || feature.properties.Location?.["Business Name"] || feature.properties.Name || "Saved Place";
                    const address = feature.properties["Address"] || feature.properties.Location?.["Address"] || "";
                    
                    itemsData.push({
                        title: title,
                        description: address,
                        category: 'Google Maps',
                        interest: 'Must try',
                        targetLocation: {
                            lat: feature.geometry.coordinates[1],
                            lng: feature.geometry.coordinates[0]
                        }
                    });
                }
            });
        }

        if (itemsData.length > 0) {
            ingestItems(itemsData);
            alert(`Successfully imported ${itemsData.length} places from Google Takeout!`);
        } else {
            alert("No valid places found in the file.");
        }

    } catch (e) {
        console.error("Failed to parse Google Takeout file", e);
        alert("Failed to parse file.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4 shrink-0">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center cursor-help" title="Just Kick">
              <svg width="48" height="48" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M56 160c0-100 400-100 400 0" stroke="#ef4444" strokeWidth="40" strokeLinecap="round" fill="none"/>
                <path d="M56 160l40 320h320l40-320Z" fill="#ef4444"/>
                <text x="256" y="380" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="160" fill="#ffffff" textAnchor="middle">JK</text>
              </svg>
            </div>
            {/* Title Removed as requested */}
          </div>

          <div className="flex items-center gap-2">
            {/* Grouped View Controls */}
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center gap-1">
              {/* List / Filter Toggle */}
              <button
                onClick={() => {
                  if (viewMode === 'map') {
                    setViewMode('list');
                  } else {
                    setShowCompletedOnly(!showCompletedOnly);
                  }
                }}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'list' 
                    ? showCompletedOnly 
                      ? 'bg-green-100 text-green-700 shadow-sm dark:bg-green-900 dark:text-green-300' 
                      : 'bg-white text-brand-600 shadow-sm dark:bg-gray-700 dark:text-brand-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                title={viewMode === 'list' ? (showCompletedOnly ? "Switch to Pending" : "Switch to Completed") : "List View"}
              >
                <List size={18} />
              </button>

              {/* Map Toggle */}
              <button
                onClick={() => setViewMode('map')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'map' 
                    ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-700 dark:text-brand-400' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                title="Map View"
              >
                <MapIcon size={18} />
              </button>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>

            <button
              onClick={toggleTracking}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                isTracking 
                  ? 'bg-brand-50 text-brand-600 border border-brand-200 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-800' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
              }`}
            >
              {isTracking ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                  </span>
                  <span className="hidden xs:inline">Tracking</span>
                </>
              ) : (
                <>
                  <LocateFixed size={14} />
                  <span className="hidden xs:inline">Track</span>
                </>
              )}
            </button>

            {/* Auth Button */}
            {user ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                <UserIcon size={14} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 overflow-hidden relative ${viewMode === 'list' ? 'overflow-y-auto' : ''}`}>
        
        {/* Error Banner */}
        {geoError && (
          <div className="bg-red-50 dark:bg-red-900/30 px-4 py-2 flex items-center justify-center gap-2 border-b border-red-100 dark:border-red-800 animate-in slide-in-from-top duration-300">
            <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-700 dark:text-red-300 font-medium">{geoError}</span>
            <button onClick={() => setGeoError(null)} className="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm">Dismiss</button>
          </div>
        )}

        {viewMode === 'list' ? (
          <div className="h-full overflow-y-auto p-4 pb-24 scroll-smooth no-scrollbar">
            <div className="max-w-3xl mx-auto space-y-4">
              
              {/* Data Source Indicator */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
                  {user ? (
                    <>
                      <Cloud size={12} />
                      <span>Cloud Storage {isUsingMock ? '(Simulated)' : ''}</span>
                    </>
                  ) : (
                    <>
                      <CloudOff size={12} />
                      <span>Local Database</span>
                    </>
                  )}
                </div>
                {user && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{user.email}</span>
                )}
              </div>

              {/* Status Card */}
              {currentLocation ? (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400">
                      <Navigation size={18} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Current Location</p>
                      <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                        {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{items.filter(i => !i.completed).length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
                  </div>
                </div>
              ) : isTracking && !geoError && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-center gap-2 shadow-sm animate-pulse">
                   <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                   <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                   <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                   <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-medium">Acquiring satellite lock...</span>
                </div>
              )}

              {/* Filter & Sort Bar */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 flex flex-wrap gap-2 items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterCategory || filterInterest ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Filter size={14} />
                    Filters {(filterCategory || filterInterest) ? '(On)' : ''}
                  </button>

                  <button 
                    onClick={() => setSortBy(sortBy === 'date' ? 'distance' : 'date')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <ArrowUpDown size={14} />
                    Sort: {sortBy === 'distance' ? 'Distance' : 'Date'}
                  </button>
                </div>

                {showFilters && (
                  <div className="w-full flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-1">
                    <select 
                      value={filterCategory} 
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="flex-1 text-xs p-2 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">All Categories</option>
                      {[...uniqueBuckets, ...customBuckets].filter((v, i, a) => a.indexOf(v) === i).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    
                    <select 
                      value={filterInterest} 
                      onChange={(e) => setFilterInterest(e.target.value)}
                      className="flex-1 text-xs p-2 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">All Interests</option>
                      {[...uniqueInterests, ...customInterests].filter((v, i, a) => a.indexOf(v) === i).map(i => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>

                    {(filterCategory || filterInterest) && (
                      <button 
                        onClick={() => { setFilterCategory(''); setFilterInterest(''); }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* List */}
              <div className="space-y-4">
                {isCloudLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-3 opacity-50">
                      <span className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></span>
                      <p className="text-sm font-medium text-gray-500">Syncing your list...</p>
                  </div>
                ) : displayedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    {showCompletedOnly ? (
                      <>
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-full mb-4">
                          <CheckCircle2 size={40} className="text-green-400" />
                        </div>
                        <p className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-1">No completed items found</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your filters.</p>
                      </>
                    ) : (
                      <>
                        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                          <MapIcon size={40} className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <p className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-1">No items found</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Adjust filters or add a new destination.</p>
                        
                        {!items.length && (
                          <div className="flex gap-2">
                              <button onClick={handleLoad7Wonders} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <Globe size={16} className="text-blue-500" />
                                Load 7 Wonders Demo
                              </button>
                              <button onClick={handleLoadNearbyDemo} className="flex items-center gap-2 px-4 py-2 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 shadow-sm rounded-full text-sm font-medium text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors">
                                <Database size={16} />
                                Load Nearby Demo
                              </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  displayedItems.map(item => (
                    <BucketCard
                      key={item.id}
                      item={item}
                      currentLocation={currentLocation}
                      onToggleComplete={toggleComplete}
                      onDelete={deleteItem}
                      onEdit={initiateEdit}
                      onClick={handleItemClick}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <MainMapView 
            items={displayedItems}
            currentLocation={currentLocation}
            focusedItemId={focusedItemId}
            onToggleComplete={toggleComplete}
            onClearFocus={() => setFocusedItemId(null)}
          />
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => {
            setEditingItem(null);
            setShowAddModal(true);
          }}
          className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-900/20 rounded-full p-4 transition-transform hover:scale-105 active:scale-95"
        >
          <Plus size={28} />
        </button>
      </div>

      <AddModal
        isOpen={showAddModal}
        onClose={handleModalClose}
        onSave={handleSaveItem}
        currentLocation={currentLocation}
        itemToEdit={editingItem}
        existingBuckets={uniqueBuckets}
        existingInterests={uniqueInterests}
        customBuckets={customBuckets}
        customInterests={customInterests}
      />

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        customBuckets={customBuckets}
        setCustomBuckets={setCustomBuckets}
        customInterests={customInterests}
        setCustomInterests={setCustomInterests}
        theme={theme}
        setTheme={setTheme}
        onImport={handleDataImport}
        onImportFromText={handleTextImport}
        onImportGoogleTakeout={handleGoogleTakeoutImport} 
        onLoad7Wonders={handleLoad7Wonders}
        onLoadNearbyDemo={handleLoadNearbyDemo}
      />
    </div>
  );
};

export default App;