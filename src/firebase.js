import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAxR3zmjsl81QKBWySUzwjGbYGFUY1SPjE",
  authDomain: "rehab-connect-83639.firebaseapp.com",
  projectId: "rehab-connect-83639",
  storageBucket: "rehab-connect-83639.firebasestorage.app",
  messagingSenderId: "392277309947",
  appId: "1:392277309947:web:9999bc9955875b8781b35e",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
