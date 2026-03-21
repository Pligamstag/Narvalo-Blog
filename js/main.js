/**
 * main.js — Les Narvalos
 * Auth lecteurs + admins via Firebase Google
 * Réactions nécessitent d'être connecté
 */

const API_BASE  = 'https://distinguished-renewal-production.up.railway.app/api';
const REACTIONS = ['🔥', '😂', '💜', '🥺', '🤯'];

let currentPage = 1;
const limit     = 9;
let currentCat  = 'all';
let currentSort = 'recent';
let totalPosts  = 0;
let profiles    = {};
let currentUser = null;   // utilisateur connecté (lecteur ou admin)

document.addEventListener('DOMContentLoaded', () => {
  readURLParams();
  setupFilters();
  setupNav();
  setupAuth();
  loadProfiles().then(() => {
    fetchPosts(true);
    renderAuthorsStrip();
    loadHeroStats();
  });
  document.getElementById('popup-overlay')?.addEventListener('click', hidePopup);
});

/* ============================================================
   AUTH
   ============================================================ */
function setupAuth() {
  // Bouton Se connecter
  document.getElementById('btn-signin')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-signin');
    btn.textContent = '⏳...';
    btn.disabled = true;

    const result = await window.signInWithGoogle?.();

    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg> Se connecter`;

    if (!result?.success && result?.reason !== 'auth/popup-closed-by-user') {
      showToast('❌ Erreur de connexion');
    }
  });

  // Bouton Se déconnecter
  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await window.signOutGoogle?.();
  });

  // Toast "connecte-toi" → déclenche login
  document.getElementById('toast-login-btn')?.addEventListener('click', () => {
    hideToast();
    document.getElementById('btn-signin')?.click();
  });

  // Écouter les changements d'état
  const trySetup = () => {
    if (!window.onUserAuthChange) { setTimeout(trySetup, 100); return; }
    window.onUserAuthChange(user => {
      currentUser = user;
      updateHeaderUI(user);
      updateAdminVisibility(user);
      // Mettre à jour les boutons de réaction
      document.querySelectorAll('.reaction-bubble').forEach(btn => {
        btn.disabled = !user;
        btn.title    = user ? '' : 'Connecte-toi pour réagir';
      });
    });
  };
  trySetup();
}

function updateHeaderUI(user) {
  const signinBtn = document.getElementById('btn-signin');
  const userChip  = document.getElementById('user-chip');

  if (user) {
    signinBtn.classList.add('hidden');
    userChip.classList.remove('hidden');
    document.getElementById('user-chip-name').textContent = user.name?.split(' ')[0] || 'Toi';
    const avatarEl = document.getElementById('user-chip-avatar');
    if (user.avatar) { avatarEl.src = user.avatar; avatarEl.style.display = 'block'; }
    else avatarEl.style.display = 'none';
  } else {
    signinBtn.classList.remove('hidden');
    userChip.classList.add('hidden');
  }
}

function updateAdminVisibility(user) {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = user?.isAdmin ? '' : 'none';
  });
}

/* ============================================================
   URL PARAMS
   ============================================================ */
function readURLParams() {
  const cat = new URLSearchParams(window.location.search).get('cat');
  if (cat) {
    currentCat = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  }
}

/* ============================================================
   PROFILES
   ============================================================ */
async function loadProfiles() {
  try {
    const res  = await fetch(`${API_BASE}/profiles`);
    const data = await res.json();
    data.forEach(p => { profiles[p.username] = p; });
  } catch { }
}

async function loadHeroStats() {
  try {
    const res  = await fetch(`${API_BASE}/posts?limit=1`);
    const data = await res.json();
    const el   = document.getElementById('hero-stat-posts');
    if (el) el.textContent = data.total || 0;
  } catch { }
}

function renderAuthorsStrip() {
  const container = document.getElementById('authors-avatars');
  if (!container) return;
  container.innerHTML = '';
  Object.values(profiles).forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'author-avatar-chip';
    const name = p.firstName || p.username;
    const avatarHTML = p.avatar
      ? `<img src="${p.avatar}" alt="${name}" />`
      : `<div class="chip-avatar-placeholder">${name.charAt(0).toUpperCase()}</div>`;
    chip.innerHTML = `
      <div class="chip-avatar-wrap">${avatarHTML}<div class="status-dot"></div></div>
      <span class="chip-name">${name}</span>
    `;
    chip.addEventListener('click', e => showProfilePopup(p.username, e));
    container.appendChild(chip);
  });
}

/* ============================================================
   FILTRES & NAV
   ============================================================ */
function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      currentPage = 1;
      fetchPosts(true);
    });
  });
  document.getElementById('sort-select')?.addEventListener('change', e => {
    currentSort = e.target.value; currentPage = 1; fetchPosts(true);
  });
  document.getElementById('load-more-btn')?.addEventListener('click', () => {
    currentPage++; fetchPosts(false);
  });
}

function setupNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.querySelector('.main-nav');
  toggle?.addEventListener('click', () => nav.classList.toggle('open'));
}

/* ============================================================
   POSTS
   ============================================================ */
async function fetchPosts(reset = false) {
  const container = document.getElementById('posts-container');
  const noPosts   = document.getElementById('no-posts');
  const loadBtn   = document.getElementById('load-more-btn');

  if (reset) {
    container.innerHTML = '<div class="loading-skeleton">' +
      Array(6).fill('<div class="skeleton-card"></div>').join('') + '</div>';
    noPosts.classList.add('hidden');
  }

  try {
    const params = new URLSearchParams({
      page: currentPage, limit,
      sort: currentSort === 'recent' ? '-publishedAt' : 'publishedAt',
    });
    if (currentCat !== 'all') params.set('category', currentCat);

    const res  = await fetch(`${API_BASE}/posts?${params}`);
    const data = await res.json();
    totalPosts = data.total || 0;

    if (reset) container.innerHTML = '';
    if (!data.posts?.length) {
      if (reset) noPosts.classList.remove('hidden');
      loadBtn.classList.add('hidden');
      return;
    }

    data.posts.forEach((post, i) => container.appendChild(buildCard(post, i)));
    loadBtn.classList.toggle('hidden', currentPage * limit >= totalPosts);
  } catch {
    if (reset) container.innerHTML = `<div class="no-posts"><p>😵 Impossible de charger les textes.</p></div>`;
  }
}

function buildCard(post, index) {
  const article = document.createElement('article');
  article.className = 'post-card';
  article.dataset.cat = post.category;
  article.style.animationDelay = `${index * 0.06}s`;

  const profile    = findProfileByName(post.author);
  const avatarHTML = profile?.avatar
    ? `<img class="card-author-avatar" src="${profile.avatar}" alt="${post.author}" />`
    : `<div class="card-author-placeholder">${post.author.charAt(0).toUpperCase()}</div>`;

  const savedReactions = getSavedReactions(post._id);
  const reactionsHTML  = REACTIONS.map(emoji => {
    const reacted = savedReactions[emoji] || false;
    const count   = reacted ? 1 : 0;
    return `<button class="reaction-bubble ${reacted ? 'reacted' : ''}"
      data-emoji="${emoji}" data-postid="${post._id}"
      title="${currentUser ? '' : 'Connecte-toi pour réagir'}">
      ${emoji}${count > 0 ? ` <span>${count}</span>` : ''}
    </button>`;
  }).join('');

  article.innerHTML = `
    <div class="card-top">
      <div class="card-meta">
        <span class="category-badge badge-${post.category}">${categoryLabel(post.category)}</span>
        <span class="card-date">${formatDate(post.publishedAt)}</span>
      </div>
      <h2 class="card-title">${escapeHtml(post.title)}</h2>
      <p class="card-summary">${escapeHtml(post.summary)}</p>
    </div>
    <div class="card-footer">
      <div class="card-author-row" data-author="${escapeHtml(post.author)}">
        ${avatarHTML}
        <span class="card-author-name">${escapeHtml(post.author)}</span>
      </div>
      <div class="card-actions">
        ${reactionsHTML}
        <a href="post.html?id=${post._id}" class="btn-read">Lire →</a>
      </div>
    </div>
  `;

  article.querySelector('.card-author-row').addEventListener('click', e => {
    const username = findUsernameByName(post.author);
    if (username) showProfilePopup(username, e);
  });

  article.querySelectorAll('.reaction-bubble').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      if (!currentUser) {
        showToastLogin();
        return;
      }
      handleReaction(btn, post._id);
    });
  });

  return article;
}

/* ── Réactions ── */
function getSavedReactions(postId) {
  if (!currentUser) return {};
  try { return JSON.parse(localStorage.getItem(`reactions_${currentUser.uid}_${postId}`) || '{}'); }
  catch { return {}; }
}

function handleReaction(btn, postId) {
  const emoji   = btn.dataset.emoji;
  const key     = `reactions_${currentUser.uid}_${postId}`;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch { saved = {}; }

  saved[emoji] = !saved[emoji];
  localStorage.setItem(key, JSON.stringify(saved));

  btn.classList.toggle('reacted', saved[emoji]);
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => btn.style.transform = '', 200);

  const countEl = btn.querySelector('span');
  if (saved[emoji]) {
    if (countEl) countEl.textContent = (parseInt(countEl.textContent)||0) + 1;
    else btn.innerHTML = `${btn.dataset.emoji} <span>1</span>`;
  } else {
    if (countEl) { const n = parseInt(countEl.textContent) - 1; if (n <= 0) countEl.remove(); else countEl.textContent = n; }
  }
}

/* ── Toast ── */
function showToastLogin() {
  const toast = document.getElementById('toast-login');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

function hideToast() {
  document.getElementById('toast-login')?.classList.add('hidden');
}

function showToast(msg) {
  const toast = document.getElementById('toast-login');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

/* ── Profile Popup ── */
function showProfilePopup(username, event) {
  const profile = profiles[username];
  if (!profile) return;
  const popup   = document.getElementById('profile-popup');
  const overlay = document.getElementById('popup-overlay');
  const name    = profile.firstName || profile.username;
  const avatarEl = document.getElementById('popup-avatar');
  if (profile.avatar) { avatarEl.src = profile.avatar; avatarEl.style.display = 'block'; }
  else avatarEl.style.display = 'none';
  document.getElementById('popup-name').textContent   = name;
  document.getElementById('popup-pseudo').textContent = profile.pseudo ? `@${profile.pseudo}` : '';
  document.getElementById('popup-quote').textContent  = profile.quote || '';
  const tagsEl = document.getElementById('popup-tags');
  tagsEl.innerHTML = '';
  const tags = [];
  if (profile.nationality) tags.push(`🌍 ${profile.nationality}`);
  if (profile.dreamCountry) tags.push(`✈️ ${profile.dreamCountry}`);
  (profile.passions||[]).slice(0,3).forEach(p => tags.push(p));
  tags.forEach(t => {
    const span = document.createElement('span');
    span.className = 'popup-tag'; span.textContent = t;
    tagsEl.appendChild(span);
  });
  document.getElementById('popup-profile-link').href = `auteurs.html?user=${username}`;
  const target = event.currentTarget || event.target;
  const rect   = target.getBoundingClientRect?.() || { left: event.clientX, bottom: event.clientY, width: 0 };
  let left = rect.left + rect.width / 2 - 145;
  let top  = rect.bottom + 8 + window.scrollY;
  left = Math.max(8, Math.min(left, window.innerWidth - 298));
  popup.style.left = `${left}px`;
  popup.style.top  = `${top}px`;
  popup.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function hidePopup() {
  document.getElementById('profile-popup').classList.add('hidden');
  document.getElementById('popup-overlay').classList.add('hidden');
}

/* ── Utils ── */
function findProfileByName(name) {
  return Object.values(profiles).find(p => p.firstName === name || p.username === name) || null;
}
function findUsernameByName(name) {
  const p = findProfileByName(name); return p ? p.username : null;
}
function categoryLabel(cat) {
  return { anecdote:'😂 Anecdote', poeme:'🌙 Poème', journee:'☀️ Journée', autre:'✨ Autre' }[cat] || cat;
}
function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '';
}
function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
