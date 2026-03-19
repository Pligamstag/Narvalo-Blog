/**
 * auteurs.js — Page des auteurs Narvalos
 * Affiche les cartes + modal profil complet
 */

const API_BASE = 'http://localhost:3000/api';
let profiles = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  await loadProfiles();

  // Si URL contient ?user=xxx, ouvrir directement ce profil
  const username = new URLSearchParams(window.location.search).get('user');
  if (username) {
    const profile = profiles.find(p => p.username === username);
    if (profile) setTimeout(() => openModal(profile), 300);
  }
});

function setupNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.querySelector('.main-nav');
  toggle?.addEventListener('click', () => nav.classList.toggle('open'));
}

async function loadProfiles() {
  const grid = document.getElementById('authors-grid');
  try {
    const res  = await fetch(`${API_BASE}/profiles`);
    profiles   = await res.json();

    grid.innerHTML = '';

    if (!profiles.length) {
      grid.innerHTML = `<p style="color:var(--ink-muted);font-family:var(--font-hand);font-size:1.2rem;padding:40px">
        Les auteurs n'ont pas encore configuré leur profil.</p>`;
      return;
    }

    // Récupérer le nb de posts par auteur
    const postCounts = await fetchPostCounts();

    profiles.forEach((p, i) => {
      const card = buildAuthorCard(p, postCounts[p.firstName || p.username] || 0, i);
      grid.appendChild(card);
    });

    // Modal
    setupModal();

  } catch (err) {
    grid.innerHTML = `<p style="color:var(--ink-muted);font-family:var(--font-hand);font-size:1.1rem;padding:40px">
      Impossible de charger les profils. Vérifiez que le serveur est démarré.</p>`;
  }
}

async function fetchPostCounts() {
  try {
    const res  = await fetch(`${API_BASE}/posts?limit=1000`);
    const data = await res.json();
    const counts = {};
    (data.posts || []).forEach(p => {
      counts[p.author] = (counts[p.author] || 0) + 1;
    });
    return counts;
  } catch { return {}; }
}

function buildAuthorCard(profile, postCount, index) {
  const card = document.createElement('div');
  card.className = 'author-card';
  card.style.animationDelay = `${index * 0.1}s`;

  const name = profile.firstName || profile.username;
  const avatarHTML = profile.avatar
    ? `<img class="author-card-avatar" src="${profile.avatar}" alt="${name}" />`
    : `<div class="author-card-placeholder">${name.charAt(0).toUpperCase()}</div>`;

  const passions = (profile.passions || []).slice(0, 4);
  const tagsHTML = passions.map(p => `<span class="author-tag">${p}</span>`).join('');

  card.innerHTML = `
    <div class="author-card-banner"></div>
    <div class="author-card-body">
      <div class="author-card-avatar-wrap">${avatarHTML}</div>
      <h3 class="author-card-name">${escapeHtml(name)}</h3>
      ${profile.pseudo ? `<p class="author-card-pseudo">@${escapeHtml(profile.pseudo)}</p>` : ''}
      ${profile.quote ? `<p class="author-card-quote">"${escapeHtml(profile.quote)}"</p>` : ''}
      ${tagsHTML ? `<div class="author-card-tags">${tagsHTML}</div>` : ''}
      <p class="author-card-stats">${postCount} texte${postCount > 1 ? 's' : ''} publié${postCount > 1 ? 's' : ''}</p>
    </div>
  `;

  card.addEventListener('click', () => openModal(profile, postCount));
  return card;
}

function setupModal() {
  document.getElementById('modal-overlay')?.addEventListener('click', closeModal);
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

async function openModal(profile, postCount) {
  // Si postCount pas fourni, le recalculer
  if (postCount === undefined) {
    const counts = await fetchPostCounts();
    postCount = counts[profile.firstName || profile.username] || 0;
  }

  const name = profile.firstName || profile.username;

  // Avatar
  const avatarEl = document.getElementById('modal-avatar');
  if (profile.avatar) {
    avatarEl.src = profile.avatar;
    avatarEl.style.display = 'block';
  } else {
    avatarEl.style.display = 'none';
  }

  document.getElementById('modal-name').textContent   = name;
  document.getElementById('modal-pseudo').textContent = profile.pseudo ? `@${profile.pseudo}` : '';
  document.getElementById('modal-quote').textContent  = profile.quote  ? `"${profile.quote}"` : '';
  document.getElementById('modal-bio').textContent    = profile.bio    || '';
  document.getElementById('modal-posts-count').textContent = postCount;

  // Nationalité / Pays de rêve
  const natWrap = document.getElementById('modal-nationality-wrap');
  const drmWrap = document.getElementById('modal-dreamcountry-wrap');
  if (profile.nationality) {
    document.getElementById('modal-nationality').textContent = profile.nationality;
    natWrap.style.display = 'flex';
  } else natWrap.style.display = 'none';

  if (profile.dreamCountry) {
    document.getElementById('modal-dreamcountry').textContent = profile.dreamCountry;
    drmWrap.style.display = 'flex';
  } else drmWrap.style.display = 'none';

  // Passions
  const passionsEl = document.getElementById('modal-passions');
  passionsEl.innerHTML = '';
  (profile.passions || []).forEach(p => {
    const span = document.createElement('span');
    span.className = 'passion-tag';
    span.textContent = p;
    passionsEl.appendChild(span);
  });

  // Liens
  const linksEl = document.getElementById('modal-links');
  linksEl.innerHTML = '';
  if (profile.links) {
    Object.entries(profile.links).forEach(([key, val]) => {
      if (!val) return;
      const a = document.createElement('a');
      a.className = 'modal-link-btn';
      a.href      = val.startsWith('http') ? val : `https://${val}`;
      a.target    = '_blank';
      a.rel       = 'noopener noreferrer';
      const icons = { instagram: '📸', spotify: '🎵', twitter: '🐦', youtube: '🎬', tiktok: '🎶', other: '🔗' };
      a.textContent = `${icons[key] || '🔗'} ${key.charAt(0).toUpperCase() + key.slice(1)}`;
      linksEl.appendChild(a);
    });
  }

  document.getElementById('author-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('author-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
