/**
 * main.js — Les Narvalos
 * Posts avec réactions emoji + popup profil
 */

const API_BASE = 'http://localhost:3000/api';

const REACTIONS = ['🔥', '😂', '💜', '🥺', '🤯'];

let currentPage = 1;
const limit     = 9;
let currentCat  = 'all';
let currentSort = 'recent';
let totalPosts  = 0;
let profiles    = {};

document.addEventListener('DOMContentLoaded', () => {
  readURLParams();
  setupFilters();
  setupNav();
  loadProfiles().then(() => {
    fetchPosts(true);
    renderAuthorsStrip();
    loadHeroStats();
  });
  document.getElementById('popup-overlay')?.addEventListener('click', hidePopup);
});

function readURLParams() {
  const cat = new URLSearchParams(window.location.search).get('cat');
  if (cat) {
    currentCat = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  }
}

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
  const list = Object.values(profiles);
  if (!list.length) return;

  list.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'author-avatar-chip';
    chip.dataset.username = p.username;

    const name = p.firstName || p.username;
    const avatarHTML = p.avatar
      ? `<img src="${p.avatar}" alt="${name}" />`
      : `<div class="chip-avatar-placeholder">${name.charAt(0).toUpperCase()}</div>`;

    chip.innerHTML = `
      <div class="chip-avatar-wrap">
        ${avatarHTML}
        <div class="status-dot"></div>
      </div>
      <span class="chip-name">${name}</span>
    `;
    chip.addEventListener('click', e => showProfilePopup(p.username, e));
    container.appendChild(chip);
  });
}

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
    currentSort = e.target.value;
    currentPage = 1;
    fetchPosts(true);
  });

  document.getElementById('load-more-btn')?.addEventListener('click', () => {
    currentPage++;
    fetchPosts(false);
  });
}

function setupNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.querySelector('.main-nav');
  toggle?.addEventListener('click', () => nav.classList.toggle('open'));
}

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
    if (reset) container.innerHTML = `
      <div class="no-posts">
        <p>😵 Impossible de charger les textes. Le serveur est démarré ?</p>
      </div>`;
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

  // Réactions sauvegardées localement
  const savedReactions = getSavedReactions(post._id);

  const reactionsHTML = REACTIONS.map(emoji => {
    const count   = (post.reactions?.[emoji] || 0) + (savedReactions[emoji] ? 1 : 0);
    const reacted = savedReactions[emoji] || false;
    return `<button class="reaction-bubble ${reacted ? 'reacted' : ''}"
      data-emoji="${emoji}" data-postid="${post._id}">
      ${emoji} ${count > 0 ? `<span>${count}</span>` : ''}
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

  // Clic auteur → popup
  article.querySelector('.card-author-row').addEventListener('click', e => {
    const username = findUsernameByName(post.author);
    if (username) showProfilePopup(username, e);
  });

  // Réactions
  article.querySelectorAll('.reaction-bubble').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      handleReaction(btn, post._id);
    });
  });

  return article;
}

/* ── Réactions (stockage local) ── */
function getSavedReactions(postId) {
  try {
    return JSON.parse(localStorage.getItem(`reactions_${postId}`) || '{}');
  } catch { return {}; }
}

function handleReaction(btn, postId) {
  const emoji   = btn.dataset.emoji;
  const saved   = getSavedReactions(postId);
  const reacted = saved[emoji] || false;

  saved[emoji] = !reacted;
  localStorage.setItem(`reactions_${postId}`, JSON.stringify(saved));

  btn.classList.toggle('reacted', !reacted);

  // Animation
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => btn.style.transform = '', 200);

  // Mettre à jour le compteur affiché
  const countEl  = btn.querySelector('span');
  const current  = countEl ? parseInt(countEl.textContent) || 0 : 0;
  const newCount = !reacted ? current + 1 : Math.max(0, current - 1);

  if (newCount > 0) {
    if (countEl) countEl.textContent = newCount;
    else btn.innerHTML = `${emoji} <span>${newCount}</span>`;
  } else {
    if (countEl) countEl.remove();
    else btn.textContent = emoji;
  }
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
  (profile.passions || []).slice(0, 3).forEach(p => tags.push(p));
  tags.forEach(t => {
    const span = document.createElement('span');
    span.className = 'popup-tag';
    span.textContent = t;
    tagsEl.appendChild(span);
  });

  document.getElementById('popup-profile-link').href = `auteurs.html?user=${username}`;

  const target = event.currentTarget || event.target;
  const rect   = target.getBoundingClientRect?.() || { left: event.clientX, bottom: event.clientY, width: 0 };
  const popupW = 290;
  let left = rect.left + rect.width / 2 - popupW / 2;
  let top  = rect.bottom + 8 + window.scrollY;
  left = Math.max(8, Math.min(left, window.innerWidth - popupW - 8));

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
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
}
function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
