import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "../config/firebase";

export { firebaseConfigured };

const requireFirebase = () => {
  if (!firebaseConfigured || !firebaseAuth) {
    throw new Error("Firebase authentication is not configured");
  }
  return firebaseAuth;
};

export const googleSignIn = async () => {
  const auth = requireFirebase();
  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return result.user;
};

export const emailSignIn = async (email, password) => {
  const auth = requireFirebase();
  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const emailRegister = async ({ name, email, password }) => {
  const auth = requireFirebase();
  await setPersistence(auth, browserLocalPersistence);
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(result.user, { displayName: name });
  return result.user;
};

export const getFirebaseIdToken = (user) => user.getIdToken();
export const observeFirebaseAuth = (callback) => {
  const auth = requireFirebase();
  return onAuthStateChanged(auth, callback);
};
export const firebaseLogout = () => requireFirebase() && signOut(firebaseAuth);
