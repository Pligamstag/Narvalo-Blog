/**
 * js/firebase.js — Version fiable sans appel backend bloquant
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged,
  updatePassword, updateProfile, EmailAuthProvider, reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBtz9h8VnBJu3XczbP6-dZIYHY0GNNPKI0",
  authDomain: "narvalo-blog.firebaseapp.com",
  projectId: "narvalo-blog",
  storageBucket: "narvalo-blog.firebasestorage.app",
  messagingSenderId: "398627409507",
  appId: "1:398627409507:web:c80b39c5175bb34551f256",
  measurementId: "G-5RN3YPKNV4"
};

const ADMIN_EMAILS = [
  'samyfoot51@gmail.com', 'vyrdox@gmail.com',
  'lulummix30@kitoy.me', 'zaynebdeschassagnes@gmail.com',
];

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
window.firebaseAuth = auth;
window.ADMIN_EMAILS = ADMIN_EMAILS;

function buildUserObj(user) {
  const email   = (user.email || '').toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(email);
  const name    = user.displayName || localStorage.getItem('name_' + user.uid) || user.email.split('@')[0];
  const avatar  = user.photoURL || localStorage.getItem('avatar_' + user.uid) || null;
  return { isAdmin, email: user.email, name, avatar, uid: user.uid };
}

window.signInWithEmail = async function(email, password) {
  try {
    const r = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, token: await r.user.getIdToken(), ...buildUserObj(r.user) };
  } catch (err) {
    let msg = 'Erreur de connexion.';
    if (err.code === 'auth/invalid-credential')  msg = 'Email ou mot de passe incorrect.';
    if (err.code === 'auth/user-not-found')      msg = 'Aucun compte avec cet email.';
    if (err.code === 'auth/wrong-password')      msg = 'Mot de passe incorrect.';
    if (err.code === 'auth/invalid-email')       msg = 'Email invalide.';
    if (err.code === 'auth/too-many-requests')   msg = 'Trop de tentatives, réessaie plus tard.';
    return { success: false, reason: err.code, message: msg };
  }
};

window.signUpWithEmail = async function(email, password, displayName) {
  try {
    const r = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(r.user, { displayName });
      localStorage.setItem('name_' + r.user.uid, displayName);
    }
    return { success: true, token: await r.user.getIdToken(), ...buildUserObj(r.user) };
  } catch (err) {
    let msg = 'Erreur création compte.';
    if (err.code === 'auth/email-already-in-use') msg = 'Email déjà utilisé.';
    if (err.code === 'auth/weak-password')         msg = 'Mot de passe trop court (6 min).';
    if (err.code === 'auth/invalid-email')         msg = 'Email invalide.';
    return { success: false, reason: err.code, message: msg };
  }
};

window.resetPassword = async function(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (err) {
    let msg = 'Erreur.';
    if (err.code === 'auth/user-not-found') msg = 'Aucun compte avec cet email.';
    if (err.code === 'auth/invalid-email')  msg = 'Email invalide.';
    return { success: false, message: msg };
  }
};

window.updateUserProfile = async function(displayName, photoURL) {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false };
    const u = {};
    if (displayName !== undefined) u.displayName = displayName;
    if (photoURL    !== undefined) u.photoURL    = photoURL;
    await updateProfile(user, u);
    if (displayName) localStorage.setItem('name_'   + user.uid, displayName);
    if (photoURL)    localStorage.setItem('avatar_' + user.uid, photoURL);
    return { success: true };
  } catch { return { success: false, message: 'Erreur.' }; }
};

window.invalidateProfileCache = function(uid) {
  if (uid) { localStorage.removeItem('name_' + uid); localStorage.removeItem('avatar_' + uid); }
};

window.changePassword = async function(cur, nw) {
  try {
    const user = auth.currentUser;
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, cur));
    await updatePassword(user, nw);
    return { success: true };
  } catch (err) {
    let msg = 'Erreur.';
    if (err.code === 'auth/wrong-password')        msg = 'Mot de passe actuel incorrect.';
    if (err.code === 'auth/weak-password')         msg = 'Nouveau trop court.';
    if (err.code === 'auth/requires-recent-login') msg = 'Reconnecte-toi d\'abord.';
    return { success: false, message: msg };
  }
};

window.signOutGoogle = async function() { await signOut(auth); };

window.onUserAuthChange = function(cb) {
  onAuthStateChanged(auth, async function(user) {
    if (!user) { cb(null); return; }
    cb({ ...buildUserObj(user), token: await user.getIdToken() });
  });
};

window.onAdminAuthChange = function(cb) {
  onAuthStateChanged(auth, async function(user) {
    if (!user) { cb(null); return; }
    const obj = buildUserObj(user);
    if (obj.isAdmin) cb({ ...obj, token: await user.getIdToken() });
    else cb(null);
  });
};

window.getCurrentAdmin = function() {
  return new Promise(function(resolve) {
    const unsub = onAuthStateChanged(auth, async function(user) {
      unsub();
      if (!user) { resolve(null); return; }
      const obj = buildUserObj(user);
      if (obj.isAdmin) resolve({ ...obj, token: await user.getIdToken() });
      else resolve(null);
    });
  });
};

window.signInWithGoogle = async function() {
  return { success: false, message: 'Utilise email + mot de passe.' };
};

console.log('Firebase — Les Narvalos');
