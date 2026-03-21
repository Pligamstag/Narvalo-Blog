/**
 * js/firebase.js
 * Firebase Auth — admins ET lecteurs
 * - Admins : emails dans ADMIN_EMAILS → accès dashboard
 * - Lecteurs : n'importe quel compte Google → réactions/commentaires
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged
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
  // 'email3@gmail.com',
  // 'email4@gmail.com',
];

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

window.firebaseAuth     = auth;
window.ADMIN_EMAILS     = ADMIN_EMAILS;
window.firebaseProvider = provider;

/**
 * Connexion Google pour TOUT le monde (lecteurs + admins)
 */
window.signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user   = result.user;
    const email  = user.email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(email);

    return {
      success:  true,
      isAdmin,
      email:    user.email,
      name:     user.displayName,
      avatar:   user.photoURL,
      uid:      user.uid,
      token:    isAdmin ? await user.getIdToken() : null,
    };
  } catch (err) {
    return { success: false, reason: err.code || 'error' };
  }
};

/**
 * Déconnexion
 */
window.signOutGoogle = async () => {
  await signOut(auth);
};

/**
 * Vérifie si l'utilisateur courant est admin
 */
window.getCurrentAdmin = () => {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();
      if (!user) { resolve(null); return; }
      const email = user.email?.toLowerCase();
      if (ADMIN_EMAILS.includes(email)) {
        resolve({
          isAdmin: true,
          email:   user.email,
          name:    user.displayName,
          avatar:  user.photoURL,
          uid:     user.uid,
          token:   await user.getIdToken(),
        });
      } else {
        resolve(null);
      }
    });
  });
};

/**
 * Écoute l'état de connexion de N'IMPORTE QUEL utilisateur
 * Retourne { isAdmin, email, name, avatar, uid } ou null
 */
window.onUserAuthChange = (callback) => {
  onAuthStateChanged(auth, async user => {
    if (!user) { callback(null); return; }
    const email   = user.email?.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(email);
    callback({
      isAdmin,
      email:  user.email,
      name:   user.displayName,
      avatar: user.photoURL,
      uid:    user.uid,
      token:  isAdmin ? await user.getIdToken() : null,
    });
  });
};

// Pour compatibilité avec admin.js
window.onAdminAuthChange = (callback) => {
  onAuthStateChanged(auth, async user => {
    if (!user) { callback(null); return; }
    const email = user.email?.toLowerCase();
    if (ADMIN_EMAILS.includes(email)) {
      callback({
        isAdmin: true,
        email:   user.email,
        name:    user.displayName,
        avatar:  user.photoURL,
        uid:     user.uid,
        token:   await user.getIdToken(),
      });
    } else {
      callback(null);
    }
  });
};

console.log('🔥 Firebase — Les Narvalos');
