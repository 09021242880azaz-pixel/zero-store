import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCZMrfjQsF61oAn_kNlxd_j8m8b-VEa4dI",
  authDomain: "zero-store-9e8ec.firebaseapp.com",
  projectId: "zero-store-9e8ec",
  storageBucket: "zero-store-9e8ec.firebasestorage.app",
  messagingSenderId: "960048085383",
  appId: "1:960048085383:web:37bba392dc93b654757b22",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
