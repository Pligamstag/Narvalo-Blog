/**
 * js/notifications.js
 * Gère les notifications push côté client
 * Inclure dans index.html et post.html
 */

const API_BASE = 'https://narvalo-blog.onrender.com/api';

// Enregistrer le service worker
async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (e) {
    console.warn('SW non enregistré:', e);
    return null;
  }
}

// Vérifier si l'utilisateur est abonné à un auteur
function isSubscribed(uid, authorUsername) {
  try {
    const subs = JSON.parse(localStorage.getItem('notif_subs_' + uid) || '{}');
    return subs[authorUsername] || false;
  } catch { return false; }
}

// Envoyer une notification locale (sans serveur push)
function sendLocalNotification(title, body, url) {
  if (Notification.permission !== 'granted') return;
  const notif = new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url },
  });
  notif.onclick = () => {
    window.open(url, '_blank');
    notif.close();
  };
}

// Vérifier les nouveaux posts et notifier les abonnés
async function checkNewPosts(currentUser) {
  if (!currentUser || Notification.permission !== 'granted') return;

  const lastCheck = localStorage.getItem('last_notif_check') || '0';
  const now       = new Date().toISOString();

  try {
    const res   = await fetch(API_BASE + '/posts?limit=10&sort=-publishedAt');
    const data  = await res.json();
    const posts = data.posts || [];

    const newPosts = posts.filter(p => {
      const pubDate = new Date(p.publishedAt).getTime();
      return pubDate > parseInt(lastCheck) && pubDate <= Date.now();
    });

    newPosts.forEach(post => {
      // Chercher le username de l'auteur
      const authorUsername = post.author.toLowerCase();
      if (isSubscribed(currentUser.uid, authorUsername)) {
        sendLocalNotification(
          '🌀 ' + post.author + ' a publié !',
          post.title,
          '/post.html?id=' + post._id
        );
      }
    });

    localStorage.setItem('last_notif_check', Date.now().toString());
  } catch {}
}

// Init notifications
async function initNotifications(currentUser) {
  if (!currentUser) return;
  await registerSW();

  // Vérifier toutes les 5 minutes
  checkNewPosts(currentUser);
  setInterval(() => checkNewPosts(currentUser), 5 * 60 * 1000);
}

window.initNotifications  = initNotifications;
window.sendLocalNotification = sendLocalNotification;
window.isSubscribed       = isSubscribed;
