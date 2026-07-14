// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCQ-BVpJ7X_dRt4EoarX_Zo3mupBvKr1vY",
  authDomain: "ai-interview-platform-f0545.firebaseapp.com",
  projectId: "ai-interview-platform-f0545",
  storageBucket: "ai-interview-platform-f0545.firebasestorage.app",
  messagingSenderId: "877980243475",
  appId: "1:877980243475:web:365da4202356ac0407d1e6",
  measurementId: "G-41YPQQN0QV"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-southeast1'); // Match your region
export default app;
