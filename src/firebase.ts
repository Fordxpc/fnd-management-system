import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU",
  authDomain: "fnd-ops-management.firebaseapp.com",
  projectId: "fnd-ops-management",
  storageBucket: "fnd-ops-management.firebasestorage.app",
  messagingSenderId: "76853703487",
  appId: "1:76853703487:web:18695b45ebddc57593998a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);