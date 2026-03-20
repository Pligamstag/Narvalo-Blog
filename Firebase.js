/**
 * js/firebase.js
 * Configuration Firebase + Google Auth
 * Gère la connexion Google et expose l'état d'auth globalement
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── Config Firebase (ta config) ──
const firebaseConfig = {
  apiKey:            "AIzaSyBtz9h8VnBJu3XczbP6-dZIYHY0GNNPKI0",
  authDomain:        "narvalo-blog.firebaseapp.com",
  projectId:         "narvalo-blog",
  storageBucket:     "narvalo-blog.firebasestorage.app",
  messagingSenderId: "398627409507",
  appId:             "1:398627409507:web:c80b39c5175bb34551f256",
  measurementId:     "G-5RN3YPKNV4"
};

// ── Emails autorisés comme admins ──
// Ajoute ou retire des emails ici
const ADMIN_EMAILS = [
  'samyfoot51@gmail.com',
  'vyrdox@gmail.com',
  // 'email3@gmail.com',
  // 'email4@gmail.com',
];

// ── Init Firebase ──
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// Exposer globalement pour admin.js et main.js
window.firebaseAuth     = auth;
window.ADMIN_EMAILS     = ADMIN_EMAILS;
window.firebaseProvider = provider;

/**
 * Connexion Google via popup
 */
window.signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user   = result.user;
    const email  = user.email.toLowerCase();

    if (!ADMIN_EMAILS.includes(email)) {
      // Email non autorisé → déconnexion immédiate
      await signOut(auth);
      return { success: false, reason: 'not_admin' };
    }

    return {
      success:  true,
      email:    user.email,
      name:     user.displayName,
      avatar:   user.photoURL,
      token:    await user.getIdToken(),
    };

  } catch (err) {
    console.error('Google login error:', err);
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
 * Vérifie si l'utilisateur courant est un admin
 * Retourne l'user ou null
 */
window.getCurrentAdmin = () => {
  return new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      unsubscribe();
      if (!user) { resolve(null); return; }
      const email = user.email?.toLowerCase();
      if (ADMIN_EMAILS.includes(email)) {
        resolve({
          email:  user.email,
          name:   user.displayName,
          avatar: user.photoURL,
          token:  await user.getIdToken(),
        });
      } else {
        resolve(null);
      }
    });
  });
};

/**
 * Écoute les changements d'état de connexion
 * Utilisé par main.js pour afficher/cacher le bouton admin
 */
window.onAdminAuthChange = (callback) => {
  onAuthStateChanged(auth, async user => {
    if (!user) { callback(null); return; }
    const email = user.email?.toLowerCase();
    if (ADMIN_EMAILS.includes(email)) {
      callback({
        email:  user.email,
        name:   user.displayName,
        avatar: user.photoURL,
        token:  await user.getIdToken(),
      });
    } else {
      callback(null);
    }
  });
};

console.log('🔥 Firebase initialisé — Les Narvalos');
