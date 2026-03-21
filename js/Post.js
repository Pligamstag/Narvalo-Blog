/**
 * post.js — Page de détail d'un post Narvalos
 */

const API_BASE = 'https://narvalo-blog.onrender.com/api';
let profiles = {};

document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  await loadProfiles();

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { showError('Aucun post spécifié.'); return; }

  fetchPost(id);
  document.getElementById('popup-overlay')?.addEventListener('click', hidePopup);
});

function setupNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.querySelector('.main-nav');
  toggle?.addEventListener('click', () => nav.classList.toggle('open'));
}

async function loadProfiles() {
  try {
    const res  = await fetch(`${API_BASE}/profiles`);
    const data = await res.json();
    data.forEach(p => { profiles[p.username] = p; });
  } catch { }
}

async function fetchPost(id) {
  try {
    const res  = await fetch(`${API_BASE}/posts/${id}`);
    if (!res.ok) throw new Error();
    const post = await res.json();
    renderPost(post);
    fetchSuggestions(post.category, post._id);
    document.title = `${post.title} — Narvalos`;
  } catch { showError('Ce texte est introuvable ou a été supprimé.'); }
}

function renderPost(post) {
  const container = document.getElementById('post-content');
  const profile   = findProfileByName(post.author);
  const date      = formatDate(post.publishedAt);

  const avatarHTML = profile?.avatar
    ? `<img class="byline-avatar" src="${profile.avatar}" alt="${post.author}" data-username="${profile.username}" />`
    : `<div class="byline-avatar-placeholder" data-username="${profile?.username || ''}">${post.author.charAt(0).toUpperCase()}</div>`;

  container.innerHTML = `
    <div class="container">
      <div class="post-hero-meta">
        <span class="post-category-badge">${categoryLabel(post.category)}</span>
        <h1 class="post-title">${escapeHtml(post.title)}</h1>
        <div class="post-byline">
          ${avatarHTML}
          <div class="byline-info">
            <span class="byline-name" data-username="${profile?.username || ''}">${escapeHtml(post.author)}</span>
            <span class="byline-date">${date}</span>
          </div>
        </div>
      </div>
      <div class="post-divider"></div>
      <div class="post-body ${post.category === 'poeme' ? 'poeme' : ''}">${post.content}</div>
      <a href="index.html" class="post-back-link">Retour à l'accueil</a>
    </div>
  `;

  // Clic sur l'auteur → popup
  container.querySelectorAll('[data-username]').forEach(el => {
    el.addEventListener('click', (e) => {
      const u = el.dataset.username;
      if (u) showProfilePopup(u, e);
    });
  });
}

async function fetchSuggestions(category, excludeId) {
  try {
    const res  = await fetch(`${API_BASE}/posts?category=${category}&limit=4&sort=-publishedAt`);
    const data = await res.json();
    const others = (data.posts || []).filter(p => p._id !== excludeId).slice(0, 3);

    if (!others.length) { document.getElementById('suggestions').style.display = 'none'; return; }

    const grid = document.getElementById('suggestions-grid');
    others.forEach((post, i) => {
      const card = buildMiniCard(post, i);
      grid.appendChild(card);
    });
  } catch { document.getElementById('suggestions').style.display = 'none'; }
}

function buildMiniCard(post, index) {
  const article = document.createElement('article');
  article.className = 'post-card';
  article.style.animationDelay = `${index * 0.1}s`;

  const profile = findProfileByName(post.author);
  const avatarHTML = profile?.avatar
    ? `<img class="card-author-avatar" src="${profile.avatar}" alt="${post.author}" />`
    : `<div class="card-author-placeholder">${post.author.charAt(0).toUpperCase()}</div>`;

  article.innerHTML = `
    <div class="card-top">
      <div class="card-meta">
        <span class="category-badge">${categoryLabel(post.category)}</span>
        <span class="card-date">${formatDate(post.publishedAt)}</span>
      </div>
      <h3 class="card-title">${escapeHtml(post.title)}</h3>
      <p class="card-summary">${escapeHtml(post.summary)}</p>
    </div>
    <div class="card-footer">
      <div class="card-author">
        ${avatarHTML}
        <span class="card-author-name">${escapeHtml(post.author)}</span>
      </div>
      <a href="post.html?id=${post._id}" class="btn-read">Lire →</a>
    </div>
  `;
  return article;
}

/* ── Profile popup ── */
function showProfilePopup(username, event) {
  const profile = profiles[username];
  if (!profile) return;

  const popup   = document.getElementById('profile-popup');
  const overlay = document.getElementById('popup-overlay');

  const avatar = document.getElementById('popup-avatar');
  if (profile.avatar) { avatar.src = profile.avatar; avatar.style.display = 'block'; }
  else avatar.style.display = 'none';

  document.getElementById('popup-name').textContent   = profile.firstName || profile.username;
  document.getElementById('popup-pseudo').textContent = profile.pseudo ? `@${profile.pseudo}` : '';
  document.getElementById('popup-quote').textContent  = profile.quote || '';

  const tagsEl = document.getElementById('popup-tags');
  tagsEl.innerHTML = '';
  const tags = [];
  if (profile.nationality) tags.push(profile.nationality);
  if (profile.dreamCountry) tags.push(`✈️ ${profile.dreamCountry}`);
  (profile.passions || []).slice(0, 3).forEach(p => tags.push(p));
  tags.forEach(t => {
    const span = document.createElement('span');
    span.className = 'popup-tag';
    span.textContent = t;
    tagsEl.appendChild(span);
  });

  document.getElementById('popup-profile-link').href = `auteurs.html?user=${username}`;

  const el   = event.target.closest('[data-username]') || event.target;
  const rect = el.getBoundingClientRect();
  const popupW = 300;
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

function findProfileByName(name) {
  return Object.values(profiles).find(p => p.firstName === name || p.username === name) || null;
}

function showError(msg) {
  document.getElementById('post-content').innerHTML = `
    <div class="container" style="padding:80px 24px;text-align:center;color:var(--ink-muted)">
      <p style="font-family:var(--font-hand);font-size:1.3rem">${msg}</p>
      <a href="index.html" class="post-back-link" style="display:inline-block;margin-top:20px">← Retour</a>
    </div>`;
  document.getElementById('suggestions').style.display = 'none';
}

function categoryLabel(cat) {
  return { anecdote:'Anecdote', poeme:'Poème', journee:'Journée', autre:'Autre' }[cat] || cat;
}
function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '';
}
function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
