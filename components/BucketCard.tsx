import React, { useState } from 'react';
import { BucketItem, GeoLocation } from '../types';
import { calculateDistance, formatDistance } from '../utils/geoUtils';
import { MapPin, CheckCircle2, Circle, Trash2, Pencil, Tag, Calendar, X, Check } from 'lucide-react';

interface BucketCardProps {
  item: BucketItem;
  currentLocation: GeoLocation | null;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: BucketItem) => void;
  onClick?: (item: BucketItem) => void;
}

export const BucketCard: React.FC<BucketCardProps> = ({
  item,
  currentLocation,
  onToggleComplete,
  onDelete,
  onEdit,
  onClick
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const distance = currentLocation
    ? calculateDistance(currentLocation, item.targetLocation)
    : null;

  // Visual proximity highlight threshold: 2km (2000m)
  const isNearby = distance !== null && distance < 2000; 

  const handleContainerClick = (e: React.MouseEvent) => {
    // Prevent click if we are confirming delete
    if (showDeleteConfirm) return;
    if (onClick) {
        onClick(item);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div 
      onClick={handleContainerClick}
      className={`relative p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:border-brand-200 dark:hover:border-brand-800 hover:shadow-md ${
      item.completed 
        ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 opacity-60' 
        : isNearby
          ? 'bg-white dark:bg-gray-800 border-brand-300 dark:border-brand-700 shadow-[0_0_10px_rgba(239,68,68,0.15)] dark:shadow-[0_0_10px_rgba(239,68,68,0.1)]'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
             {/* Bucket (Category) Badge */}
            {item.category && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                item.completed 
                  ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400' 
                  : 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300'
              }`}>
                {item.category}
              </span>
            )}

            {/* Interest Badge */}
            {item.interest && (
              <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                item.completed 
                  ? 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-700/50 dark:text-gray-500 dark:border-gray-700' 
                  : 'bg-white text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
              }`}>
                <Tag size={10} />
                {item.interest}
              </span>
            )}

            {isNearby && !item.completed && (
              <span className="flex h-2 w-2 relative ml-auto sm:ml-0" title="Nearby">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
            )}
          </div>
          <h3 className={`font-semibold text-lg truncate pr-2 ${
            item.completed 
              ? 'line-through text-gray-400 dark:text-gray-500' 
              : 'text-gray-900 dark:text-gray-100'
          }`}>
            {item.title}
          </h3>
          {item.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.description}</p>
          )}
          
          <div className="flex flex-col gap-1 mt-3">
             <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium">
                <MapPin size={12} />
                {distance !== null ? (
                <span className={isNearby && !item.completed ? 'text-brand-600 dark:text-brand-400 font-bold' : ''}>
                    {formatDistance(distance)} away
                </span>
                ) : (
                <span>Distance unavailable</span>
                )}
            </div>
            
            {item.completed && item.completedAt && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-medium">
                    <Calendar size={12} />
                    <span>Completed on {new Date(item.completedAt).toLocaleDateString()}</span>
                </div>
            )}
          </div>

        </div>

        <div className="flex flex-col gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
          {showDeleteConfirm ? (
            <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200 shadow-sm z-10">
                <p className="text-[10px] text-gray-500 text-center font-bold px-1">Sure?</p>
                <button 
                    onClick={handleConfirmDelete}
                    className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                    title="Yes, Delete"
                >
                    <Check size={16} />
                </button>
                <button 
                    onClick={handleCancelDelete}
                    className="p-1.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                    title="No, Cancel"
                >
                    <X size={16} />
                </button>
            </div>
          ) : (
            <>
              <button 
                onClick={() => onToggleComplete(item.id)}
                className="text-gray-400 hover:text-brand-500 dark:text-gray-500 dark:hover:text-brand-400 transition-colors p-1"
                title={item.completed ? "Mark as incomplete" : "Mark as complete"}
              >
                {item.completed ? <CheckCircle2 size={24} className="text-green-500 dark:text-green-400" /> : <Circle size={24} />}
              </button>
              <button 
                onClick={() => onEdit(item)}
                className="text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1"
                title="Edit"
              >
                <Pencil size={20} />
              </button>
              <button 
                onClick={handleDeleteClick}
                className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1"
                title="Delete"
              >
                <Trash2 size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};