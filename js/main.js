/**
 * main.js — Les Narvalos
 * Auth obligatoire + WebSockets temps réel + profil header
 *
 * FIX : le nom et l'avatar dans le header viennent du profil Narvalos
 *       (firstName + avatar configuré dans l'admin), pas du compte Google/Firebase.
 */

const API_BASE  = 'https://narvalo-blog.onrender.com/api';
const WS_URL    = 'https://narvalo-blog.onrender.com';
const REACTIONS = ['🔥', '😂', '💜', '🥺', '🤯'];

let currentPage = 1;
const limit     = 9;
let currentCat  = 'all';
let currentSort = 'recent';
let totalPosts  = 0;
let profiles    = {};
let currentUser = null;
let socket      = null;

document.addEventListener('DOMContentLoaded', () => {
  // Auth guard — rediriger si non connecté
  const tryAuth = () => {
    if (!window.onUserAuthChange) { setTimeout(tryAuth, 100); return; }
    window.onUserAuthChange(user => {
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      currentUser = user;

      // Affichage provisoire avec les données Firebase le temps que les profils chargent
      updateHeaderUI(user);
      updateAdminVisibility(user);

      // Charger le contenu seulement si connecté
      if (!profiles || !Object.keys(profiles).length) {
        loadProfiles().then(() => {
          // Une fois les profils chargés, mettre à jour le header avec le profil Narvalos
          updateHeaderWithNarvalosProfile(user);
          fetchPosts(true);
          renderAuthorsStrip();
          loadHeroStats();
          initWebSocket();
        });
      }
    });
  };
  tryAuth();

  readURLParams();
  setupFilters();
  setupNav();
  document.getElementById('popup-overlay')?.addEventListener('click', hidePopup);
});

/**
 * Cherche le profil Narvalos de l'utilisateur connecté (par email)
 * et met à jour le header avec firstName + avatar du profil.
 */
function updateHeaderWithNarvalosProfile(user) {
  // Pour les admins : leur username = partie avant @ de l'email
  // On cherche dans les profils chargés celui qui correspond
  const userEmail = user.email?.toLowerCase();
  const narvalosProfile = Object.values(profiles).find(p =>
    // On essaie de matcher par email stocké ou par username (partie avant @)
    p.username && userEmail && (
      userEmail.startsWith(p.username.toLowerCase()) ||
      p.username.toLowerCase() === userEmail.split('@')[0]
    )
  );

  if (narvalosProfile) {
    // Nom : prénom Narvalos en priorité, sinon username, sinon fallback Firebase
    const displayName = narvalosProfile.firstName || narvalosProfile.username || user.name;
    // Avatar : avatar Narvalos en priorité, sinon fallback Firebase
    const displayAvatar = narvalosProfile.avatar || null;

    const nameEl = document.getElementById('user-chip-name');
    if (nameEl) nameEl.textContent = displayName;

    const avatarEl = document.getElementById('user-chip-avatar');
    if (avatarEl) {
      if (displayAvatar) {
        avatarEl.src = displayAvatar;
        avatarEl.style.display = 'block';
      } else {
        avatarEl.style.display = 'none';
      }
    }
  }
  // Si aucun profil Narvalos trouvé → on garde l'affichage Firebase déjà mis en place
}

/* ── WebSocket ── */
function initWebSocket() {
  if (socket) return;
  const script = document.createElement('script');
  script.src = `${WS_URL}/socket.io/socket.io.js`;
  script.onload = () => {
    socket = io(WS_URL);

    socket.on('connect', () => {
      console.log('🔌 WebSocket connecté');
    });

    socket.on('online_count', count => {
      const el = document.getElementById('online-count');
      if (el) el.textContent = count;
    });

    socket.on('post_published', () => {
      fetchPosts(true);
    });
  };
  document.head.appendChild(script);
}

/* ── Auth header (affichage initial avec données Firebase) ── */
function updateHeaderUI(user) {
  const signinBtn = document.getElementById('btn-signin');
  const userChip  = document.getElementById('user-chip');

  if (user) {
    signinBtn?.classList.add('hidden');
    userChip?.classList.remove('hidden');

    // Nom — on prend le displayName Firebase en attendant le profil Narvalos
    // (sera remplacé par updateHeaderWithNarvalosProfile une fois les profils chargés)
    const nameEl = document.getElementById('user-chip-name');
    if (nameEl) nameEl.textContent = user.name?.split(' ')[0] || 'Toi';

    // Avatar — même logique, sera mis à jour ensuite
    const avatarEl = document.getElementById('user-chip-avatar');
    if (avatarEl) {
      if (user.avatar) {
        avatarEl.src = user.avatar;
        avatarEl.style.display = 'block';
      } else {
        avatarEl.style.display = 'none';
      }
    }

    // Clic sur le nom → admin ou compte
    const nameClickEl = document.getElementById('user-chip-name');
    if (nameClickEl) {
      nameClickEl.style.cursor = 'pointer';
      nameClickEl.onclick = () => {
        window.location.href = user.isAdmin ? 'admin.html' : 'compte.html';
      };
    }
  } else {
    signinBtn?.classList.remove('hidden');
    userChip?.classList.add('hidden');
  }

  // Déconnexion
  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await window.signOutGoogle?.();
    window.location.href = 'login.html';
  });
}

function updateAdminVisibility(user) {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = user?.isAdmin ? '' : 'none';
  });
}

/* ── URL params ── */
function readURLParams() {
  const cat = new URLSearchParams(window.location.search).get('cat');
  if (cat) {
    currentCat = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  }
}

/* ── Profiles ── */
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

/* ── Filtres & Nav ── */
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

/* ── Posts ── */
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
    return `<button class="reaction-bubble ${reacted ? 'reacted' : ''}" data-emoji="${emoji}" data-postid="${post._id}">
      ${emoji}${reacted ? ' <span>1</span>' : ''}
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
  const emoji  = btn.dataset.emoji;
  const key    = `reactions_${currentUser.uid}_${postId}`;
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
    else btn.innerHTML = `${emoji} <span>1</span>`;
  } else {
    if (countEl) { const n = parseInt(countEl.textContent)-1; if(n<=0) countEl.remove(); else countEl.textContent=n; }
  }

  socket?.emit('reaction', { postId, emoji, reacted: saved[emoji], userId: currentUser.uid });
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
  if (profile.nationality)  tags.push(`🌍 ${profile.nationality}`);
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
  let left = rect.left + rect.width/2 - 145;
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
