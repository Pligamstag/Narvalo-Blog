/**
 * js/firebase.js
 * Firebase Auth — Google + Email/Password
 * Pour tous les utilisateurs et admins
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

// ── Emails admins autorisés ──
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

/* ── Connexion Google ── */
window.signInWithGoogle = async () => {
  try {
    const result  = await signInWithPopup(auth, provider);
    const user    = result.user;
    const email   = user.email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(email);
    return {
      success: true, isAdmin,
      email: user.email, name: user.displayName,
      avatar: user.photoURL, uid: user.uid,
      token: await user.getIdToken(),
    };
  } catch (err) {
    return { success: false, reason: err.code || 'error' };
  }
};

/* ── Connexion Email/Password ── */
window.signInWithEmail = async (email, password) => {
  try {
    const result  = await signInWithEmailAndPassword(auth, email, password);
    const user    = result.user;
    const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
    return {
      success: true, isAdmin,
      email: user.email, name: user.displayName || user.email.split('@')[0],
      avatar: user.photoURL || null, uid: user.uid,
      token: await user.getIdToken(),
    };
  } catch (err) {
    let message = 'Erreur de connexion.';
    if (err.code === 'auth/user-not-found')    message = 'Aucun compte avec cet email.';
    if (err.code === 'auth/wrong-password')    message = 'Mot de passe incorrect.';
    if (err.code === 'auth/invalid-email')     message = 'Email invalide.';
    if (err.code === 'auth/invalid-credential') message = 'Email ou mot de passe incorrect.';
    return { success: false, reason: err.code, message };
  }
};

/* ── Inscription Email/Password ── */
window.signUpWithEmail = async (email, password) => {
  try {
    const result  = await createUserWithEmailAndPassword(auth, email, password);
    const user    = result.user;
    const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
    return {
      success: true, isAdmin,
      email: user.email, name: user.email.split('@')[0],
      avatar: null, uid: user.uid,
      token: await user.getIdToken(),
    };
  } catch (err) {
    let message = 'Erreur lors de la création du compte.';
    if (err.code === 'auth/email-already-in-use') message = 'Cet email est déjà utilisé.';
    if (err.code === 'auth/weak-password')         message = 'Mot de passe trop faible (6 caractères min).';
    if (err.code === 'auth/invalid-email')         message = 'Email invalide.';
    return { success: false, reason: err.code, message };
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
    let message = 'Erreur lors du changement de mot de passe.';
    if (err.code === 'auth/wrong-password') message = 'Mot de passe actuel incorrect.';
    if (err.code === 'auth/weak-password')  message = 'Nouveau mot de passe trop faible.';
    return { success: false, message };
  }
};

/* ── Déconnexion ── */
window.signOutGoogle = async () => { await signOut(auth); };

/* ── État connexion (tout utilisateur) ── */
window.onUserAuthChange = (callback) => {
  onAuthStateChanged(auth, async user => {
    if (!user) { callback(null); return; }
    const email   = user.email?.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(email);
    callback({
      isAdmin, email: user.email,
      name:   user.displayName || user.email.split('@')[0],
      avatar: user.photoURL || null,
      uid:    user.uid,
      token:  await user.getIdToken(),
    });
  });
};

/* ── État connexion (admins seulement) ── */
window.onAdminAuthChange = (callback) => {
  onAuthStateChanged(auth, async user => {
    if (!user) { callback(null); return; }
    const email = user.email?.toLowerCase();
    if (ADMIN_EMAILS.includes(email)) {
      callback({
        isAdmin: true, email: user.email,
        name:   user.displayName || user.email.split('@')[0],
        avatar: user.photoURL || null,
        uid:    user.uid,
        token:  await user.getIdToken(),
      });
    } else { callback(null); }
  });
};

window.getCurrentAdmin = () => {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();
      if (!user) { resolve(null); return; }
      const email = user.email?.toLowerCase();
      if (ADMIN_EMAILS.includes(email)) {
        resolve({
          isAdmin: true, email: user.email,
          name:   user.displayName || user.email.split('@')[0],
          avatar: user.photoURL || null,
          uid:    user.uid,
          token:  await user.getIdToken(),
        });
      } else { resolve(null); }
    });
  });
};

console.log('🔥 Firebase — Les Narvalos');
