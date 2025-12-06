import React, { useState, useEffect } from 'react';
import { GeoLocation, BucketItem } from '../types';
import { MapPin, Loader2, Sparkles, Globe, Search, X, Save } from 'lucide-react';
import { generateBucketListSuggestions } from '../services/geminiService';
import { MapPicker } from './MapPicker';
import { Combobox } from './Combobox';

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, category: string, interest: string, location: GeoLocation, desc?: string) => void;
  currentLocation: GeoLocation | null;
  itemToEdit?: BucketItem | null;
  existingBuckets?: string[];
  existingInterests?: string[];
  customBuckets?: string[];
  customInterests?: string[];
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

// Updated defaults to include user requested values
const DEFAULT_BUCKETS = ["Food", "Parks", "Cities", "Adventure", "Culture"];
const DEFAULT_INTERESTS = ["Before die", "ASAP", "Must try"];

export const AddModal: React.FC<AddModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  currentLocation, 
  itemToEdit,
  existingBuckets = [],
  existingInterests = [],
  customBuckets = [],
  customInterests = []
}) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('');
  const [interest, setInterest] = useState('');
  
  const [useCurrentLoc, setUseCurrentLoc] = useState(true);
  const [manualLoc, setManualLoc] = useState<GeoLocation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);

  // Merge defaults with existing values from the app state AND custom user settings
  const availableBuckets = Array.from(new Set([...DEFAULT_BUCKETS, ...customBuckets, ...existingBuckets]));
  const availableInterests = Array.from(new Set([...DEFAULT_INTERESTS, ...customInterests, ...existingInterests]));

  // Reset or populate form
  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setTitle(itemToEdit.title);
        setDesc(itemToEdit.description || '');
        setCategory(itemToEdit.category);
        setInterest(itemToEdit.interest || '');
        setManualLoc(itemToEdit.targetLocation);
        setUseCurrentLoc(false);
      } else {
        // Reset for new item
        setTitle('');
        setDesc('');
        setCategory(''); // Start empty as requested
        setInterest(''); // Start empty as requested
        setUseCurrentLoc(true);
        setManualLoc(null);
        setSearchQuery('');
        setSearchResults([]);
      }
    }
  }, [isOpen, itemToEdit]);

  // Debounced Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setIsSearchingPlaces(true);
        try {
            // Include addressdetails=1 to get more context if needed
            let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=8`;
            
            // Bias search to current location if available (approx 50km box)
            // Only bias if the query is short/generic. If it has commas (full address), search globally.
            if ((currentLocation || manualLoc) && !searchQuery.includes(',')) {
               const biasLoc = manualLoc || currentLocation;
               if (biasLoc) {
                   const viewbox = `${biasLoc.lng-0.5},${biasLoc.lat+0.5},${biasLoc.lng+0.5},${biasLoc.lat-0.5}`;
                   url += `&viewbox=${viewbox}`;
               }
            }

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'JustKickApp/1.0'
                }
            });
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setIsSearchingPlaces(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, currentLocation, manualLoc]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let targetLoc: GeoLocation;

    if (useCurrentLoc && currentLocation) {
      targetLoc = currentLocation;
    } else if (manualLoc) {
      targetLoc = manualLoc;
    } else {
        targetLoc = currentLocation || { lat: 0, lng: 0 };
    }

    onSave(title, category, interest, targetLoc, desc);
    onClose();
  };

  const handleGenerate = async () => {
    if (!currentLocation) return;
    setIsGenerating(true);
    try {
      const suggestions = await generateBucketListSuggestions(currentLocation.lat, currentLocation.lng);
      if (suggestions.length > 0) {
        const pick = suggestions[0];
        setTitle(pick.title);
        setDesc(pick.description);
        setCategory(pick.category);
        setInterest(pick.interest || DEFAULT_INTERESTS[2]); // Default to 'Must try' if AI misses it
        setUseCurrentLoc(false);
        setManualLoc({ lat: pick.approxLat, lng: pick.approxLng });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMapSelect = (loc: GeoLocation) => {
    setManualLoc(loc);
  };

  const handleSearchResultSelect = (place: NominatimResult) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    setManualLoc({ lat, lng });
    setSearchResults([]);
    setSearchQuery(''); // Clear query after selection so user can see map clearly
    setUseCurrentLoc(false);
    
    // Auto-fill title with the most relevant name part
    if (!title) {
      // Use road/street name if available, otherwise first part of display name
      const name = place.address?.road || place.display_name.split(',')[0];
      setTitle(name);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-6 w-full">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{itemToEdit ? 'Edit Item' : 'Add to JustKick'}</h2>
             {currentLocation && !itemToEdit && (
               <button 
                 onClick={handleGenerate}
                 disabled={isGenerating}
                 className="flex items-center gap-1 text-xs bg-gradient-to-r from-brand-600 to-orange-500 text-white px-3 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 whitespace-nowrap ml-2"
               >
                 {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                 AI Suggest
               </button>
            )}
          </div>
            
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              type="button"
              aria-label="Close"
            >
              <X size={24} />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="e.g., Visit Eiffel Tower"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Combobox 
              label="Bucket"
              value={category}
              onChange={setCategory}
              options={availableBuckets}
              placeholder="Select or type..."
            />
            
            <Combobox 
              label="Interests"
              value={interest}
              onChange={setInterest}
              options={availableInterests}
              placeholder="Select or type..."
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Location</label>
             <div className="flex gap-2 mb-2">
               <button
                 type="button"
                 onClick={() => setUseCurrentLoc(true)}
                 className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${useCurrentLoc ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
               >
                 Current Location
               </button>
               <button
                 type="button"
                 onClick={() => {
                    setUseCurrentLoc(false);
                    if (!manualLoc && currentLocation) setManualLoc(currentLocation);
                 }}
                 className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!useCurrentLoc ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
               >
                 <span className="flex items-center justify-center gap-1">
                   <Globe size={14} />
                   Pick on Map
                 </span>
               </button>
             </div>
             
             {!useCurrentLoc && (
               <div className="space-y-2">
                 {/* Search Bar */}
                 <div className="relative z-10">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search address (e.g. 123 Main St, New York)"
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none placeholder:text-gray-400"
                      />
                      {isSearchingPlaces ? (
                        <Loader2 size={16} className="absolute right-3 top-3 text-brand-500 animate-spin" />
                      ) : searchQuery && (
                        <button 
                          type="button"
                          onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    
                    {/* Search Results Dropdown */}
                    {searchResults.length > 0 && (
                      <ul className="absolute w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto no-scrollbar z-20">
                        {searchResults.map((result) => (
                          <li 
                            key={result.place_id}
                            onClick={() => handleSearchResultSelect(result)}
                            className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <p className="text-sm text-gray-900 dark:text-white font-medium whitespace-normal leading-tight mb-1">{result.display_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {result.address?.road ? `Street: ${result.address.road}` : 'Location'} 
                                {result.address?.city ? ` • ${result.address.city}` : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                 </div>

                 <MapPicker 
                    initialLocation={currentLocation}
                    selectedLocation={manualLoc}
                    onLocationSelect={handleMapSelect}
                 />
                 <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 px-1">
                   <span>Lat: {manualLoc?.lat.toFixed(6) || '-'}</span>
                   <span>Lng: {manualLoc?.lng.toFixed(6) || '-'}</span>
                 </div>
               </div>
             )}
          </div>
          
           <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Description (Optional)</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none h-20 resize-none"
              placeholder="Notes about this dream..."
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-3 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {itemToEdit ? (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              ) : (
                <>
                  <MapPin size={18} />
                  Add to List
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};