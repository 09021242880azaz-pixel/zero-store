import { db } from "../firebase";
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc,
} from "firebase/firestore";

export async function fetchProducts() {
  const snap = await getDocs(collection(db, "products"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function saveProductDoc(product) {
  const { id, ...data } = product;
  await setDoc(doc(db, "products", id), data);
}
export async function deleteProductDoc(id) {
  await deleteDoc(doc(db, "products", id));
}

export async function fetchOrders() {
  const snap = await getDocs(collection(db, "orders"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function saveOrderDoc(order) {
  const { id, ...data } = order;
  await setDoc(doc(db, "orders", id), data);
}

export async function fetchSettings(fallback) {
  const snap = await getDoc(doc(db, "settings", "config"));
  return snap.exists() ? { ...fallback, ...snap.data() } : fallback;
}
export async function saveSettingsDoc(settings) {
  await setDoc(doc(db, "settings", "config"), settings);
}
