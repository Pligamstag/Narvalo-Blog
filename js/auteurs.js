/**
 * auteurs.js — Page équipe
 * Affiche le nom selon displayMode du profil
 */

const API_BASE = 'https://narvalo-blog.onrender.com/api';
let profiles = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  await loadProfiles();
  setupAuth();
});

function setupNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.querySelector('.main-nav');
  toggle?.addEventListener('click', () => nav?.classList.toggle('open'));
}

function setupAuth() {
  const tryAuth = () => {
    if (!window.onUserAuthChange) { setTimeout(tryAuth, 100); return; }
    window.onUserAuthChange(user => {
      updateHeaderUI(user);
      updateAdminVisibility(user);
    });
  };
  tryAuth();
}

function updateHeaderUI(user) {
  const signinBtn = document.getElementById('btn-signin');
  const userChip  = document.getElementById('user-chip');
  if (user) {
    signinBtn?.classList.add('hidden');
    userChip?.classList.remove('hidden');
    const nameEl = document.getElementById('user-chip-name');
    if (nameEl) nameEl.textContent = user.name?.split(' ')[0] || 'Toi';
    const av = document.getElementById('user-chip-avatar');
    if (av && user.avatar) { av.src = user.avatar; av.style.display = 'block'; }
  } else {
    signinBtn?.classList.remove('hidden');
    userChip?.classList.add('hidden');
  }
  document.getElementById('btn-signin')?.addEventListener('click', () => window.location.href = 'login.html');
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

async function loadProfiles() {
  try {
    const res  = await fetch(API_BASE + '/profiles');
    const data = await res.json();
    profiles   = data;
    renderProfiles(profiles);
  } catch {
    document.getElementById('authors-grid').innerHTML =
      '<p style="color:var(--text3);text-align:center">Impossible de charger les profils.</p>';
  }
}

function getDisplayName(profile) {
  const fn = profile.firstName || '';
  const ps = profile.pseudo    || '';
  const dm = profile.displayMode || 'firstName';
  if (dm === 'pseudo' && ps)     return ps;
  if (dm === 'both' && fn && ps) return fn + ' · @' + ps;
  if (fn)                        return fn;
  if (ps)                        return ps;
  return profile.username || '?';
}

function renderProfiles(profiles) {
  const grid = document.getElementById('authors-grid');
  if (!grid) return;
  grid.innerHTML = '';

  profiles.forEach((p, i) => {
    const name    = getDisplayName(p);
    const initial = name.charAt(0).toUpperCase();

    const card = document.createElement('div');
    card.className = 'author-card';
    card.style.animationDelay = (i * 0.1) + 's';

    const avatarHTML = p.avatar
      ? '<img src="' + p.avatar + '" alt="' + name + '" class="author-avatar-img" />'
      : '<div class="author-avatar-placeholder">' + initial + '</div>';

    // Tags nationalité + origine
    const tags = [];
    if (p.nationality)  tags.push('🌍 ' + p.nationality);
    if (p.origin)       tags.push('🏠 ' + p.origin);
    if (p.dreamCountry) tags.push('✈️ ' + p.dreamCountry);

    const passionsHTML = (p.passions || []).slice(0, 4).map(passion =>
      '<span class="passion-tag">' + passion + '</span>'
    ).join('');

    const linksHTML = buildLinks(p.links || {});

    card.innerHTML = `
      <div class="author-card-banner"></div>
      <div class="author-card-content">
        <div class="author-avatar-wrap">
          ${avatarHTML}
          <div class="author-status-dot"></div>
        </div>
        <h3 class="author-name">${name}</h3>
        ${p.pseudo && p.displayMode !== 'pseudo' ? '<p class="author-handle">@' + p.pseudo + '</p>' : ''}
        ${p.quote ? '<p class="author-quote">"' + p.quote + '"</p>' : ''}
        ${p.bio ? '<p class="author-bio">' + p.bio + '</p>' : ''}
        <div class="author-tags">
          ${tags.map(t => '<span class="author-tag">' + t + '</span>').join('')}
        </div>
        ${passionsHTML ? '<div class="author-passions">' + passionsHTML + '</div>' : ''}
        ${linksHTML ? '<div class="author-links">' + linksHTML + '</div>' : ''}
      </div>
    `;

    card.addEventListener('click', () => openProfileModal(p));
    grid.appendChild(card);
  });
}

function buildLinks(links) {
  const icons = {
    instagram: '📸', spotify: '🎵', twitter: '🐦',
    youtube: '🎬', tiktok: '🎶', other: '🔗'
  };
  return Object.entries(links)
    .filter(([, v]) => v)
    .map(([k, v]) => '<a href="' + v + '" target="_blank" class="author-link" onclick="event.stopPropagation()">' + (icons[k] || '🔗') + '</a>')
    .join('');
}

function openProfileModal(profile) {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;

  const name    = getDisplayName(profile);
  const initial = name.charAt(0).toUpperCase();

  const avatarEl = document.getElementById('modal-avatar');
  if (profile.avatar) {
    avatarEl.innerHTML = '<img src="' + profile.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />';
  } else {
    avatarEl.textContent = initial;
  }

  document.getElementById('modal-name').textContent   = name;
  document.getElementById('modal-pseudo').textContent = profile.pseudo && profile.displayMode !== 'pseudo' ? '@' + profile.pseudo : '';
  document.getElementById('modal-quote').textContent  = profile.quote  ? '"' + profile.quote + '"' : '';
  document.getElementById('modal-bio').textContent    = profile.bio    || '';

  const tagsEl = document.getElementById('modal-tags');
  tagsEl.innerHTML = '';
  const tags = [];
  if (profile.nationality)  tags.push('🌍 ' + profile.nationality);
  if (profile.origin)       tags.push('🏠 ' + profile.origin);
  if (profile.dreamCountry) tags.push('✈️ ' + profile.dreamCountry);
  tags.forEach(t => {
    const span = document.createElement('span');
    span.className = 'popup-tag'; span.textContent = t;
    tagsEl.appendChild(span);
  });

  const passionsEl = document.getElementById('modal-passions');
  passionsEl.innerHTML = (profile.passions || []).map(p =>
    '<span class="passion-tag">' + p + '</span>'
  ).join('');

  const linksEl = document.getElementById('modal-links');
  linksEl.innerHTML = buildLinks(profile.links || {});

  modal.classList.remove('hidden');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

document.getElementById('modal-overlay')?.addEventListener('click', closeModal);
document.getElementById('close-modal')?.addEventListener('click', closeModal);

function closeModal() {
  document.getElementById('profile-modal')?.classList.add('hidden');
  document.getElementById('modal-overlay')?.classList.add('hidden');
}
