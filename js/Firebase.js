/**
 * js/firebase.js — Version fiable avec token admin frais
 * CORRIGÉ : Force le rafraîchissement du token pour les admins
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
  'lulumix30@kitoy.me', 'zaynebdeschassagnes@gmail.com',
];

const API_BASE = 'https://narvalo-blog.onrender.com/api';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

window.firebaseAuth = auth;
window.ADMIN_EMAILS = ADMIN_EMAILS;

// Récupérer le profil depuis le backend
async function fetchProfileName(uid, email) {
  var cached = localStorage.getItem('profile_name_' + uid);
  var cachedAvatar = localStorage.getItem('profile_avatar_' + uid);
  if (cached) return { name: cached, avatar: cachedAvatar };

  try {
    var username = email.split('@')[0].toLowerCase();
    var res = await fetch(API_BASE + '/profiles/' + encodeURIComponent(username));
    if (res.ok) {
      var p = await res.json();
      var name = p.firstName || p.pseudo || username;
      var avatar = p.avatar || null;
      localStorage.setItem('profile_name_' + uid, name);
      if (avatar) localStorage.setItem('profile_avatar_' + uid, avatar);
      return { name, avatar };
    }
  } catch(e) {}

  var fallback = localStorage.getItem('display_name_' + uid) || email.split('@')[0];
  return { name: fallback, avatar: localStorage.getItem('avatar_' + uid) || null };
}

window.invalidateProfileCache = function(uid) {
  if (uid) {
    localStorage.removeItem('profile_name_' + uid);
    localStorage.removeItem('profile_avatar_' + uid);
  }
};

async function buildUserObj(user) {
  var email = user.email ? user.email.toLowerCase() : '';
  var isAdmin = ADMIN_EMAILS.includes(email);
  var profile = await fetchProfileName(user.uid, email);
  return {
    isAdmin,
    email: user.email,
    name: profile.name,
    avatar: profile.avatar,
    uid: user.uid,
  };
}

// ⭐ NOUVEAU : Fonction pour obtenir un token frais avec vérification admin
window.getAdminToken = async function() {
  const user = auth.currentUser;
  if (!user) return null;
  
  const email = (user.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) return null;
  
  // Force le rafraîchissement du token
  const token = await user.getIdToken(true);
  return token;
};

window.signInWithEmail = async function(email, password) {
  try {
    var result = await signInWithEmailAndPassword(auth, email, password);
    var obj = await buildUserObj(result.user);
    var token = await result.user.getIdToken(true); // ⭐ Force refresh
    return Object.assign({ success: true, token }, obj);
  } catch (err) {
    var msg = 'Erreur de connexion.';
    if (err.code === 'auth/invalid-credential') msg = 'Email ou mot de passe incorrect.';
    if (err.code === 'auth/user-not-found') msg = 'Aucun compte avec cet email.';
    if (err.code === 'auth/wrong-password') msg = 'Mot de passe incorrect.';
    if (err.code === 'auth/invalid-email') msg = 'Email invalide.';
    if (err.code === 'auth/too-many-requests') msg = 'Trop de tentatives. Reessaye plus tard.';
    return { success: false, reason: err.code, message: msg };
  }
};

window.signUpWithEmail = async function(email, password, displayName) {
  try {
    var result = await createUserWithEmailAndPassword(auth, email, password);
    var user = result.user;
    if (displayName) {
      await updateProfile(user, { displayName: displayName });
      localStorage.setItem('display_name_' + user.uid, displayName);
    }
    var obj = await buildUserObj(user);
    var token = await user.getIdToken(true);
    return Object.assign({ success: true, token }, obj);
  } catch (err) {
    var msg = 'Erreur lors de la creation du compte.';
    if (err.code === 'auth/email-already-in-use') msg = 'Cet email est deja utilise.';
    if (err.code === 'auth/weak-password') msg = 'Mot de passe trop faible (6 min).';
    if (err.code === 'auth/invalid-email') msg = 'Email invalide.';
    return { success: false, reason: err.code, message: msg };
  }
};

window.resetPassword = async function(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (err) {
    var msg = 'Erreur.';
    if (err.code === 'auth/user-not-found') msg = 'Aucun compte avec cet email.';
    if (err.code === 'auth/invalid-email') msg = 'Email invalide.';
    return { success: false, message: msg };
  }
};

window.updateUserProfile = async function(displayName, photoURL, uid) {
  try {
    var user = auth.currentUser;
    if (!user) return { success: false };
    var updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (photoURL !== undefined) updates.photoURL = photoURL;
    await updateProfile(user, updates);
    window.invalidateProfileCache(uid || user.uid);
    if (displayName) localStorage.setItem('display_name_' + user.uid, displayName);
    if (photoURL) localStorage.setItem('avatar_' + user.uid, photoURL);
    return { success: true };
  } catch(e) {
    return { success: false, message: 'Erreur mise a jour.' };
  }
};

window.changePassword = async function(currentPassword, newPassword) {
  try {
    var user = auth.currentUser;
    var cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
    return { success: true };
  } catch (err) {
    var msg = 'Erreur.';
    if (err.code === 'auth/wrong-password') msg = 'Mot de passe actuel incorrect.';
    if (err.code === 'auth/weak-password') msg = 'Nouveau mot de passe trop faible.';
    if (err.code === 'auth/requires-recent-login') msg = 'Reconnecte-toi dabord.';
    return { success: false, message: msg };
  }
};

window.signOutGoogle = async function() { 
  await signOut(auth);
  localStorage.removeItem('admin_token');
};

// ⭐ CORRECTION : Retourne toujours un token frais pour l'admin
window.onUserAuthChange = function(callback) {
  onAuthStateChanged(auth, async function(user) {
    if (!user) { callback(null); return; }
    var obj = await buildUserObj(user);
    var token = await user.getIdToken(true); // Force refresh
    callback(Object.assign({ token }, obj));
  });
};

// ⭐ CORRECTION : Vérifie l'admin avec token frais
window.onAdminAuthChange = function(callback) {
  onAuthStateChanged(auth, async function(user) {
    if (!user) { callback(null); return; }
    var obj = await buildUserObj(user);
    if (obj.isAdmin) {
      var token = await user.getIdToken(true); // Force refresh
      callback(Object.assign({ token }, obj));
    } else {
      callback(null);
    }
  });
};

// ⭐ CORRECTION : Promise avec token frais
window.getCurrentAdmin = function() {
  return new Promise(async function(resolve) {
    const user = auth.currentUser;
    if (!user) {
      resolve(null);
      return;
    }
    
    const obj = await buildUserObj(user);
    if (obj.isAdmin) {
      const token = await user.getIdToken(true);
      resolve(Object.assign({ token }, obj));
    } else {
      resolve(null);
    }
  });
};

window.signInWithGoogle = async function() {
  return { success: false, message: 'Utilise email + mot de passe.' };
};

console.log('Firebase — Les Narvalos (version corrigée)');
