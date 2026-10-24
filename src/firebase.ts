import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD6SjsizP7dtr02gmaaWrJ0ZQxIAUGHS8I",
  authDomain: "fnd-ops-management.firebaseapp.com",
  projectId: "fnd-ops-management",
  storageBucket: "fnd-ops-management.firebasestorage.app",
  messagingSenderId: "76853703487",
  appId: "1:76853703487:web:081b2d905668d1cb93998a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);