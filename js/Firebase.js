/**
 * js/firebase.js
 * Firebase Auth — Email/Password uniquement (plus de Google popup)
 * Inclut : connexion, inscription, mot de passe oublié, changement mdp
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
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

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

window.firebaseAuth = auth;
window.ADMIN_EMAILS = ADMIN_EMAILS;

function buildUserObj(user) {
  const email   = user.email ? user.email.toLowerCase() : '';
  const isAdmin = ADMIN_EMAILS.includes(email);
  const name    = user.displayName
    || localStorage.getItem('display_name_' + user.uid)
    || user.email.split('@')[0];
  const avatar  = user.photoURL
    || localStorage.getItem('avatar_' + user.uid)
    || null;
  return { isAdmin, email: user.email, name, avatar, uid: user.uid };
}

/* ── Connexion Email/Password ── */
window.signInWithEmail = async function(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const obj    = buildUserObj(result.user);
    const token  = await result.user.getIdToken();
    return { success: true, token, ...obj };
  } catch (err) {
    var msg = 'Erreur de connexion.';
    if (err.code === 'auth/invalid-credential')  msg = 'Email ou mot de passe incorrect.';
    if (err.code === 'auth/user-not-found')      msg = 'Aucun compte avec cet email.';
    if (err.code === 'auth/wrong-password')      msg = 'Mot de passe incorrect.';
    if (err.code === 'auth/invalid-email')       msg = 'Email invalide.';
    if (err.code === 'auth/too-many-requests')   msg = 'Trop de tentatives. Réessaie plus tard.';
    return { success: false, reason: err.code, message: msg };
  }
};

/* ── Inscription Email/Password ── */
window.signUpWithEmail = async function(email, password, displayName) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user   = result.user;
    if (displayName) {
      await updateProfile(user, { displayName: displayName });
      localStorage.setItem('display_name_' + user.uid, displayName);
    }
    const obj   = buildUserObj(user);
    const token = await user.getIdToken();
    return { success: true, token, ...obj };
  } catch (err) {
    var msg = 'Erreur lors de la creation du compte.';
    if (err.code === 'auth/email-already-in-use') msg = 'Cet email est deja utilise.';
    if (err.code === 'auth/weak-password')         msg = 'Mot de passe trop faible (6 min).';
    if (err.code === 'auth/invalid-email')         msg = 'Email invalide.';
    return { success: false, reason: err.code, message: msg };
  }
};

/* ── Mot de passe oublié ── */
window.resetPassword = async function(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (err) {
    var msg = 'Erreur.';
    if (err.code === 'auth/user-not-found') msg = 'Aucun compte avec cet email.';
    if (err.code === 'auth/invalid-email')  msg = 'Email invalide.';
    return { success: false, message: msg };
  }
};

/* ── Mettre à jour le profil ── */
window.updateUserProfile = async function(displayName, photoURL) {
  try {
    var user    = auth.currentUser;
    if (!user) return { success: false, message: 'Non connecte.' };
    var updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (photoURL    !== undefined) updates.photoURL    = photoURL;
    await updateProfile(user, updates);
    if (displayName) localStorage.setItem('display_name_' + user.uid, displayName);
    if (photoURL)    localStorage.setItem('avatar_' + user.uid, photoURL);
    return { success: true };
  } catch (e) {
    return { success: false, message: 'Erreur mise a jour.' };
  }
};

/* ── Changer mot de passe ── */
window.changePassword = async function(currentPassword, newPassword) {
  try {
    var user = auth.currentUser;
    var cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
    return { success: true };
  } catch (err) {
    var msg = 'Erreur.';
    if (err.code === 'auth/wrong-password')        msg = 'Mot de passe actuel incorrect.';
    if (err.code === 'auth/weak-password')         msg = 'Nouveau mot de passe trop faible.';
    if (err.code === 'auth/requires-recent-login') msg = 'Reconnecte-toi d abord.';
    return { success: false, message: msg };
  }
};

/* ── Déconnexion ── */
window.signOutGoogle = async function() {
  await signOut(auth);
};

/* ── État connexion (tout utilisateur) ── */
window.onUserAuthChange = function(callback) {
  onAuthStateChanged(auth, async function(user) {
    if (!user) { callback(null); return; }
    var obj   = buildUserObj(user);
    var token = await user.getIdToken();
    callback(Object.assign({ token: token }, obj));
  });
};

/* ── État connexion (admins seulement) ── */
window.onAdminAuthChange = function(callback) {
  onAuthStateChanged(auth, async function(user) {
    if (!user) { callback(null); return; }
    var obj = buildUserObj(user);
    if (obj.isAdmin) {
      var token = await user.getIdToken();
      callback(Object.assign({ token: token }, obj));
    } else {
      callback(null);
    }
  });
};

window.getCurrentAdmin = function() {
  return new Promise(function(resolve) {
    var unsub = onAuthStateChanged(auth, async function(user) {
      unsub();
      if (!user) { resolve(null); return; }
      var obj = buildUserObj(user);
      if (obj.isAdmin) {
        var token = await user.getIdToken();
        resolve(Object.assign({ token: token }, obj));
      } else {
        resolve(null);
      }
    });
  });
};

/* ── Compat Google (redirige vers email) ── */
window.signInWithGoogle = async function() {
  return { success: false, message: 'Utilise email + mot de passe.' };
};

console.log('Firebase — Les Narvalos');
