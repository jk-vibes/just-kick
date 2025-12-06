import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { BucketItem, GeoLocation } from '../types';
import { fixLeafletIcons } from '../utils/geoUtils';

interface MainMapViewProps {
  items: BucketItem[];
  currentLocation: GeoLocation | null;
  focusedItemId: string | null;
  onToggleComplete: (id: string) => void;
  onClearFocus: () => void;
}

export const MainMapView: React.FC<MainMapViewProps> = ({
  items,
  currentLocation,
  focusedItemId,
  onToggleComplete,
  onClearFocus
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    fixLeafletIcons();

    // Default view (will be overridden if items exist or location exists)
    const startLat = currentLocation?.lat || 20;
    const startLng = currentLocation?.lng || 0;
    const startZoom = currentLocation ? 12 : 2;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false // We can add custom controls if needed
      }).setView([startLat, startLng], startZoom);

      // Use CartoDB Voyager tiles for better street detail
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      // Create a layer group for easy clearing
      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Markers
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    // Clear existing markers
    layerGroupRef.current.clearLayers();

    // Add User Location Marker
    if (currentLocation) {
        const userIcon = L.divIcon({
            className: 'custom-user-location',
            html: '<div style="background-color: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        L.marker([currentLocation.lat, currentLocation.lng], { icon: userIcon, title: "You are here" })
         .addTo(layerGroupRef.current);
    }

    // Green Marker for completed items
    const greenIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add Bucket Item Markers
    const markers: {[id: string]: L.Marker} = {};

    items.forEach(item => {
      const isCompleted = item.completed;
      const completedDateStr = item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '';
      
      // Create Popup Content
      const container = document.createElement('div');
      container.className = "p-1 min-w-[200px]";
      container.innerHTML = `
        <h3 class="font-bold text-gray-900 text-sm mb-1">${item.title}</h3>
        ${item.description ? `<p class="text-xs text-gray-500 mb-2 line-clamp-2">${item.description}</p>` : ''}
        ${isCompleted && completedDateStr ? `<div class="flex items-center gap-1 text-xs text-green-600 font-medium mb-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Completed on ${completedDateStr}</div>` : ''}
        <div class="flex gap-2 mt-3">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${item.targetLocation.lat},${item.targetLocation.lng}" 
               target="_blank"
               class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-1.5 rounded text-center transition-colors no-underline">
               Navigate
            </a>
            <button id="btn-complete-${item.id}" 
                class="flex-1 ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-brand-600 text-white hover:bg-brand-700'} text-xs font-semibold py-1.5 rounded transition-colors">
                ${isCompleted ? 'Undo' : 'Mark Done'}
            </button>
        </div>
      `;

      // Bind Click Event for "Complete" button
      const btn = container.querySelector(`#btn-complete-${item.id}`);
      if (btn) {
          btn.addEventListener('click', (e) => {
              e.stopPropagation(); // Prevent map click
              onToggleComplete(item.id);
          });
      }

      const marker = L.marker([item.targetLocation.lat, item.targetLocation.lng], {
          icon: isCompleted ? greenIcon : new L.Icon.Default(),
          opacity: isCompleted ? 0.9 : 1.0,
          zIndexOffset: isCompleted ? -100 : 100 // Keep active items on top
      });
      
      marker.bindPopup(container);
      marker.addTo(layerGroupRef.current!);
      
      // Store reference if we need to open it later programmatically
      if (focusedItemId === item.id) {
          // If this is the focused item, open popup and pan
          setTimeout(() => {
             marker.openPopup();
             mapRef.current?.flyTo([item.targetLocation.lat, item.targetLocation.lng], 14, {
                 animate: true,
                 duration: 1.5
             });
          }, 100);
      }
    });

  }, [items, currentLocation, focusedItemId, onToggleComplete]);

  // Handle Resize
  useEffect(() => {
      const timeout = setTimeout(() => {
          mapRef.current?.invalidateSize();
      }, 100);
      return () => clearTimeout(timeout);
  }, []);

  return <div ref={mapContainerRef} className="w-full h-full bg-gray-50" />;
};