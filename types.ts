export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface BucketItem {
  id: string;
  title: string;
  description?: string;
  targetLocation: GeoLocation;
  completed: boolean;
  completedAt?: number; // Timestamp of completion
  notified: boolean; // Persist if we have already alerted the user
  category: string; // Renamed to "Bucket" in UI, allows custom strings
  interest: string; // New field: "Before die", "ASAP", etc.
  createdAt: number;
  userId?: string; // Optional: if null, it's a local item
}

export interface User {
  uid: string;
  email: string | null;
}

export interface AIRecommendation {
  title: string;
  description: string;
  category: string;
  interest: string;
  approxLat: number;
  approxLng: number;
}