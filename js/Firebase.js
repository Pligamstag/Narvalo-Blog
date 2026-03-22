/**
 * js/firebase.js
 * Firebase Auth — Google + Email/Password
 * Gestion du nom d'affichage et photo de profil
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  updatePassword,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBtz9h8VnBJu3XczbP6-dZIYHY0GNNPKI0",
  authDomain:        "narvalo-blog.firebaseapp.com",
  projectId:         "narvalo-blog",
  storageBucket:     "narvalo-blog.firebasestorage.app",
  messagingSenderId: "398627409507",
  appId:             "1:398627409507:web:c80b39c5175bb34551f256",
  measurementId:     "G-5RN3YPKNV4"
};

const ADMIN_EMAILS = [
  'samyfoot51@gmail.com',
  'vyrdox@gmail.com',
  'lulummix30@kitoy.me',
  'zaynebdeschassagnes@gmail.com',
];

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

window.firebaseAuth     = auth;
window.ADMIN_EMAILS     = ADMIN_EMAILS;
window.firebaseProvider = provider;

/* ── Helpers ── */
function buildUserObj(user) {
  const email   = user.email?.toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(email);
  // Priorité : displayName Firebase > email username
  const name = user.displayName || localStorage.getItem(`display_name_${user.uid}`) || user.email.split('@')[0];
  const avatar = user.photoURL || localStorage.getItem(`avatar_${user.uid}`) || null;
  return { isAdmin, email: user.email, name, avatar, uid: user.uid };
}

/* ── Connexion Google ── */
window.signInWithGoogle = async () => {
  try {
    const result  = await signInWithPopup(auth, provider);
    const user    = result.user;
    const obj     = buildUserObj(user);
    return { success: true, ...obj, token: await user.getIdToken() };
  } catch (err) {
    return { success: false, reason: err.code, message: err.message };
  }
};

/* ── Connexion Email/Password ── */
window.signInWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user   = result.user;
    const obj    = buildUserObj(user);
    return { success: true, ...obj, token: await user.getIdToken() };
  } catch (err) {
    let message = 'Erreur de connexion.';
    if (err.code === 'auth/invalid-credential') message = 'Email ou mot de passe incorrect.';
    if (err.code === 'auth/user-not-found')     message = 'Aucun compte avec cet email.';
    if (err.code === 'auth/wrong-password')     message = 'Mot de passe incorrect.';
    if (err.code === 'auth/invalid-email')      message = 'Email invalide.';
    return { success: false, reason: err.code, message };
  }
};

/* ── Inscription Email/Password ── */
window.signUpWithEmail = async (email, password, displayName) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user   = result.user;
    // Enregistrer le displayName
    if (displayName) {
      await updateProfile(user, { displayName });
      localStorage.setItem(`display_name_${user.uid}`, displayName);
    }
    const obj = buildUserObj(user);
    return { success: true, ...obj, token: await user.getIdToken() };
  } catch (err) {
    let message = 'Erreur lors de la création du compte.';
    if (err.code === 'auth/email-already-in-use') message = 'Cet email est déjà utilisé.';
    if (err.code === 'auth/weak-password')         message = 'Mot de passe trop faible (6 caractères min).';
    if (err.code === 'auth/invalid-email')         message = 'Email invalide.';
    return { success: false, reason: err.code, message };
  }
};

/* ── Mettre à jour le profil utilisateur ── */
window.updateUserProfile = async (displayName, photoURL) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, message: 'Non connecté.' };
    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (photoURL !== undefined) updates.photoURL = photoURL;
    await updateProfile(user, updates);
    // Sauvegarder localement aussi
    if (displayName) localStorage.setItem(`display_name_${user.uid}`, displayName);
    if (photoURL) localStorage.setItem(`avatar_${user.uid}`, photoURL);
    return { success: true };
  } catch (err) {
    return { success: false, message: 'Erreur lors de la mise à jour.' };
  }
};

/* ── Changer le mot de passe ── */
window.changePassword = async (currentPassword, newPassword) => {
  try {
    const user       = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    return { success: true };
  } catch (err) {
    let message = 'Erreur.';
    if (err.code === 'auth/wrong-password')        message = 'Mot de passe actuel incorrect.';
    if (err.code === 'auth/weak-password')         message = 'Nouveau mot de passe trop faible.';
    if (err.code === 'auth/requires-recent-login') message = 'Reconnecte-toi d\'abord.';
    return { success: false, message };
  }
};

/* ── Déconnexion ── */
window.signOutGoogle = async () => { await signOut(auth); };

/* ── État connexion (tout utilisateur) ── */
window.onUserAuthChange = (callback) => {
  onAuthStateChanged(auth, async user => {
    if (!user) { callback(null); return; }
    const obj = buildUserObj(user);
    callback({ ...obj, token: await user.getIdToken() });
  });
};

/* ── État connexion (admins) ── */
window.onAdminAuthChange = (callback) => {
  onAuthStateChanged(auth, async user => {
    if (!user) { callback(null); return; }
    const obj = buildUserObj(user);
    if (obj.isAdmin) callback({ ...obj, token: await user.getIdToken() });
    else callback(null);
  });
};

window.getCurrentAdmin = () => {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();
      if (!user) { resolve(null); return; }
      const obj = buildUserObj(user);
      if (obj.isAdmin) resolve({ ...obj, token: await user.getIdToken() });
      else resolve(null);
    });
  });
};

console.log('🔥 Firebase — Les Narvalos');
