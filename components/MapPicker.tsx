import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { GeoLocation } from '../types';
import { fixLeafletIcons } from '../utils/geoUtils';

interface MapPickerProps {
  initialLocation: GeoLocation | null;
  selectedLocation: GeoLocation | null;
  onLocationSelect: (loc: GeoLocation) => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({ 
  initialLocation, 
  selectedLocation,
  onLocationSelect 
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    fixLeafletIcons();

    // Default to Paris if no location provided
    const startLat = initialLocation?.lat || 48.8566;
    const startLng = initialLocation?.lng || 2.3522;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([startLat, startLng], 13);

      // Use CartoDB Voyager tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        onLocationSelect({ lat, lng });
      });

      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // We only want to initialize the map once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when selectedLocation changes
  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([selectedLocation.lat, selectedLocation.lng]);
    } else {
      markerRef.current = L.marker([selectedLocation.lat, selectedLocation.lng]).addTo(mapRef.current);
    }
    
    // Pan to new location to ensure it is visible (e.g. after typeahead selection)
    mapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 13);
  }, [selectedLocation]);

  // Invalidate size when the component mounts/updates to ensure tiles load correctly
  useEffect(() => {
    const timeout = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden border border-gray-300 z-0">
      <div ref={mapContainerRef} className="w-full h-full bg-gray-100" />
      <div className="absolute bottom-2 right-2 bg-white/90 text-xs px-2 py-1 rounded text-gray-500 pointer-events-none z-[400] shadow-sm">
        Tap map to refine
      </div>
    </div>
  );
};