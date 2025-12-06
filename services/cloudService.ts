import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  setDoc 
} from 'firebase/firestore';
import { BucketItem, User } from '../types';

// --- CONFIGURATION ---
// TODO: Replace this object with your real Firebase Project config to enable cross-device sync.
// You can get this from the Firebase Console > Project Settings > General > Your Apps
const firebaseConfig = {
  apiKey: "", 
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// --- INTERFACES ---
export type AuthCallback = (user: User | null) => void;
export type DataCallback = (items: BucketItem[]) => void;

// --- MOCK IMPLEMENTATION (Fallback if no keys) ---
// This simulates a cloud backend using LocalStorage so the UI works immediately for testing
class MockCloudService {
  private currentUser: User | null = null;
  private authSubscribers: AuthCallback[] = [];

  constructor() {
    // Restore session
    const savedUser = localStorage.getItem('mock_session_user');
    if (savedUser) {
      this.currentUser = JSON.parse(savedUser);
    }
  }

  onAuthChange(callback: AuthCallback) {
    this.authSubscribers.push(callback);
    callback(this.currentUser);
    return () => {
      this.authSubscribers = this.authSubscribers.filter(cb => cb !== callback);
    };
  }

  async signInWithGoogle() {
    await new Promise(r => setTimeout(r, 800)); // Fake latency
    this.currentUser = { uid: 'mock_google_user', email: 'mockuser@gmail.com' };
    localStorage.setItem('mock_session_user', JSON.stringify(this.currentUser));
    this.notifyAuth();
  }

  async signOut() {
    await new Promise(r => setTimeout(r, 400));
    this.currentUser = null;
    localStorage.removeItem('mock_session_user');
    this.notifyAuth();
  }

  private notifyAuth() {
    this.authSubscribers.forEach(cb => cb(this.currentUser));
  }

  // Data Methods
  subscribeToItems(userId: string, callback: DataCallback) {
    const load = () => {
      const raw = localStorage.getItem(`cloud_mock_${userId}_items`);
      const items = raw ? JSON.parse(raw) : [];
      callback(items);
    };

    load();
    // Poll for changes (simulating real-time listener)
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }

  async addItem(userId: string, item: BucketItem) {
    await new Promise(r => setTimeout(r, 300));
    const items = this.getMockItems(userId);
    items.unshift({ ...item, userId });
    this.saveMockItems(userId, items);
  }

  async updateItem(userId: string, item: BucketItem) {
    await new Promise(r => setTimeout(r, 300));
    let items = this.getMockItems(userId);
    items = items.map(i => i.id === item.id ? item : i);
    this.saveMockItems(userId, items);
  }

  async deleteItem(userId: string, itemId: string) {
    await new Promise(r => setTimeout(r, 300));
    let items = this.getMockItems(userId);
    items = items.filter(i => i.id !== itemId);
    this.saveMockItems(userId, items);
  }

  private getMockItems(userId: string): BucketItem[] {
    const raw = localStorage.getItem(`cloud_mock_${userId}_items`);
    return raw ? JSON.parse(raw) : [];
  }

  private saveMockItems(userId: string, items: BucketItem[]) {
    localStorage.setItem(`cloud_mock_${userId}_items`, JSON.stringify(items));
  }
}

// --- REAL FIREBASE IMPLEMENTATION ---
class FirebaseCloudService {
  private auth: any;
  private db: any;

  constructor(app: any) {
    this.auth = getAuth(app);
    this.db = getFirestore(app);
  }

  onAuthChange(callback: AuthCallback) {
    return onAuthStateChanged(this.auth, (user: FirebaseUser | null) => {
      if (user) {
        callback({ uid: user.uid, email: user.email });
      } else {
        callback(null);
      }
    });
  }

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.auth, provider);
  }

  async signOut() {
    await firebaseSignOut(this.auth);
  }

  subscribeToItems(userId: string, callback: DataCallback) {
    const q = query(collection(this.db, "bucketItems"), where("userId", "==", userId));
    
    return onSnapshot(q, (querySnapshot) => {
      const items: BucketItem[] = [];
      querySnapshot.forEach((doc) => {
        // We store the ID inside the object for easier handling in app
        items.push({ ...doc.data(), id: doc.id } as BucketItem);
      });
      // Sort by created
      items.sort((a, b) => b.createdAt - a.createdAt);
      callback(items);
    });
  }

  async addItem(userId: string, item: BucketItem) {
    // Create a doc ref first so we can use its ID if we want, 
    // but our app generates UUIDs. We can use the item.id as the doc ID.
    await setDoc(doc(this.db, "bucketItems", item.id), {
      ...item,
      userId
    });
  }

  async updateItem(userId: string, item: BucketItem) {
    const docRef = doc(this.db, "bucketItems", item.id);
    await updateDoc(docRef, { ...item });
  }

  async deleteItem(userId: string, itemId: string) {
    await deleteDoc(doc(this.db, "bucketItems", itemId));
  }
}

// --- FACTORY ---
let serviceInstance: any;
let isMock = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5) {
    const app = initializeApp(firebaseConfig);
    serviceInstance = new FirebaseCloudService(app);
  } else {
    console.warn("JustKick: Firebase config missing. Using Mock Cloud Service (LocalStorage simulated).");
    isMock = true;
    serviceInstance = new MockCloudService();
  }
} catch (e) {
  console.error("Failed to init Firebase, falling back to mock", e);
  isMock = true;
  serviceInstance = new MockCloudService();
}

export const cloudService = serviceInstance;
export const isUsingMock = isMock;