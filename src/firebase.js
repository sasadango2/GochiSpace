// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBO35b9ftQyEOx7YP7gJEQ4OJ0OrE4MbbU",
  authDomain: "gochispace-4a3c1.firebaseapp.com",
  projectId: "gochispace-4a3c1",
  storageBucket: "gochispace-4a3c1.firebasestorage.app",
  messagingSenderId: "1081744681726",
  appId: "1:1081744681726:web:db9a9b8e176199676ad3af",
  measurementId: "G-VVHDELS8X3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);