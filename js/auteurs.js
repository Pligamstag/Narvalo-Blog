/**
 * auteurs.js — Page équipe redesignée
 * Avatar taille fixe + displayMode + modal profil
 */

const API_BASE = 'https://narvalo-blog.onrender.com/api';
let profiles = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  setupAuth();
  await loadProfiles();
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
      // Header
      const signinBtn = document.getElementById('btn-signin');
      const userChip  = document.getElementById('user-chip');
      document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = user?.isAdmin ? '' : 'none';
      });
      if (user) {
        signinBtn?.classList.add('hidden');
        userChip?.classList.remove('hidden');
        const nameEl = document.getElementById('user-chip-name');
        if (nameEl) nameEl.textContent = user.name?.split(' ')[0] || 'Toi';
        const av  = document.getElementById('user-chip-avatar');
        const ini = document.getElementById('user-chip-initial');
        if (user.avatar && av) {
          av.src = user.avatar; av.style.display = 'block';
          if (ini) ini.style.display = 'none';
        } else if (ini) {
          ini.textContent = (user.name || '?').charAt(0).toUpperCase();
          ini.style.display = 'flex';
          if (av) av.style.display = 'none';
        }
        // Clic chip → paramètres
        userChip?.addEventListener('click', () => window.location.href = 'parametres.html');
      } else {
        signinBtn?.classList.remove('hidden');
        userChip?.classList.add('hidden');
      }
    });
  };
  tryAuth();
}

/* ── Helpers ── */
function getDisplayName(p) {
  const fn = p.firstName || '';
  const ps = p.pseudo    || '';
  const dm = p.displayMode || 'firstName';
  if (dm === 'pseudo' && ps)     return ps;
  if (dm === 'both' && fn && ps) return fn + ' · @' + ps;
  if (fn)                        return fn;
  if (ps)                        return ps;
  return p.username || '?';
}

function buildAvatar(p, size) {
  // size: 'fixed' (72px) ou 'modal' (88px)
  const cls  = size === 'modal' ? 'avatar-fixed' : 'avatar-fixed';
  const name = getDisplayName(p);
  const ini  = name.charAt(0).toUpperCase();
  const colors = [
    'linear-gradient(135deg,#9b59f5,#7c3aed)',
    'linear-gradient(135deg,#ff6b9d,#e91e8c)',
    'linear-gradient(135deg,#56f09f,#0ea5e9)',
    'linear-gradient(135deg,#f5a623,#f0932b)',
  ];
  const colorIdx = (p.username || '').length % colors.length;

  if (p.avatar && p.avatar.trim()) {
    return `<div class="${cls}" style="background:transparent">
      <img src="${p.avatar}" alt="${name}" onerror="this.parentElement.style.background='${colors[colorIdx]}';this.parentElement.textContent='${ini}';this.remove()" />
    </div>`;
  }
  return `<div class="${cls}" style="background:${colors[colorIdx]}">${ini}</div>`;
}

function buildLinks(links, type) {
  if (!links) return '';
  const icons = { instagram:'📸', spotify:'🎵', twitter:'🐦', youtube:'🎬', tiktok:'🎶', other:'🔗' };
  const names = { instagram:'Instagram', spotify:'Spotify', twitter:'Twitter/X', youtube:'YouTube', tiktok:'TikTok', other:'Lien' };
  return Object.entries(links)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => {
      if (type === 'card') {
        return `<a href="${v}" target="_blank" class="author-link" onclick="event.stopPropagation()" title="${names[k]}">${icons[k]||'🔗'}</a>`;
      }
      return `<a href="${v}" target="_blank" class="modal-link">${icons[k]||'🔗'} ${names[k]||k}</a>`;
    }).join('');
}

/* ── Load profiles ── */
async function loadProfiles() {
  try {
    const res  = await fetch(API_BASE + '/profiles');
    const data = await res.json();
    profiles   = data;
    renderProfiles(profiles);
  } catch {
    document.getElementById('authors-grid').innerHTML =
      '<p style="color:var(--text3);text-align:center;grid-column:1/-1;padding:40px">Impossible de charger les profils.</p>';
  }
}

/* ── Render cards ── */
function renderProfiles(list) {
  const grid = document.getElementById('authors-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!list.length) {
    grid.innerHTML = '<p style="color:var(--text3);text-align:center;grid-column:1/-1;padding:40px">Aucun profil disponible.</p>';
    return;
  }

  list.forEach((p, i) => {
    const name  = getDisplayName(p);
    const card  = document.createElement('div');
    card.className = 'author-card';
    card.style.animationDelay = (i * 0.08) + 's';

    const tags = [];
    if (p.nationality)  tags.push('🌍 ' + p.nationality);
    if (p.origin)       tags.push('🏠 ' + p.origin);
    if (p.dreamCountry) tags.push('✈️ ' + p.dreamCountry);

    const tagsHTML     = tags.map(t => '<span class="author-tag">' + t + '</span>').join('');
    const passionsHTML = (p.passions || []).slice(0,4).map(ps => '<span class="passion-tag">' + ps + '</span>').join('');
    const linksHTML    = buildLinks(p.links, 'card');
    const showHandle   = p.pseudo && p.displayMode !== 'pseudo';

    card.innerHTML = `
      <div class="author-card-banner"></div>
      <div class="author-card-body">
        <div class="author-avatar-outer">
          ${buildAvatar(p, 'fixed')}
          <div class="author-status"></div>
        </div>
        <div class="author-name">${name}</div>
        ${showHandle ? '<div class="author-handle">@' + p.pseudo + '</div>' : '<div style="margin-bottom:10px"></div>'}
        ${p.quote ? '<div class="author-quote">"' + p.quote + '"</div>' : ''}
        ${tagsHTML ? '<div class="author-tags">' + tagsHTML + '</div>' : ''}
        ${passionsHTML ? '<div class="author-passions">' + passionsHTML + '</div>' : ''}
        ${linksHTML ? '<div class="author-links">' + linksHTML + '</div>' : ''}
      </div>
    `;

    card.addEventListener('click', () => openModal(p));
    grid.appendChild(card);
  });
}

/* ── Modal ── */
function openModal(p) {
  const modal  = document.getElementById('profile-modal');
  const name   = getDisplayName(p);

  // Avatar modal (88px)
  const avatarEl = document.getElementById('modal-avatar');
  if (avatarEl) {
    avatarEl.className = 'avatar-fixed';
    avatarEl.style.width = avatarEl.style.minWidth = avatarEl.style.maxWidth = '88px';
    avatarEl.style.height = avatarEl.style.minHeight = avatarEl.style.maxHeight = '88px';
    avatarEl.style.fontSize = '2rem';
    if (p.avatar && p.avatar.trim()) {
      avatarEl.innerHTML = '<img src="' + p.avatar + '" alt="' + name + '" onerror="this.parentElement.textContent=\'' + name.charAt(0).toUpperCase() + '\';this.remove()" />';
      avatarEl.style.background = 'transparent';
    } else {
      avatarEl.textContent = name.charAt(0).toUpperCase();
      avatarEl.style.background = 'linear-gradient(135deg,#9b59f5,#7c3aed)';
    }
  }

  document.getElementById('modal-name').textContent = name;

  const handleEl = document.getElementById('modal-handle');
  handleEl.textContent = p.pseudo && p.displayMode !== 'pseudo' ? '@' + p.pseudo : '';

  const quoteEl = document.getElementById('modal-quote');
  if (p.quote) { quoteEl.textContent = '"' + p.quote + '"'; quoteEl.style.display = 'block'; }
  else quoteEl.style.display = 'none';

  document.getElementById('modal-bio').textContent = p.bio || '';

  // Tags
  const tagsEl    = document.getElementById('modal-tags');
  const tagsTitEl = document.getElementById('modal-tags-title');
  const tags = [];
  if (p.nationality)  tags.push('🌍 ' + p.nationality);
  if (p.origin)       tags.push('🏠 ' + p.origin);
  if (p.dreamCountry) tags.push('✈️ ' + p.dreamCountry);
  if (tags.length) {
    tagsEl.innerHTML = tags.map(t => '<span class="modal-tag">' + t + '</span>').join('');
    tagsTitEl.style.display = 'block';
  } else {
    tagsEl.innerHTML = ''; tagsTitEl.style.display = 'none';
  }

  // Passions
  const passionsEl    = document.getElementById('modal-passions');
  const passionsTitEl = document.getElementById('modal-passions-title');
  if (p.passions?.length) {
    passionsEl.innerHTML = p.passions.map(ps => '<span class="passion-tag">' + ps + '</span>').join('');
    passionsTitEl.style.display = 'block';
  } else {
    passionsEl.innerHTML = ''; passionsTitEl.style.display = 'none';
  }

  // Liens
  const linksEl    = document.getElementById('modal-links');
  const linksTitEl = document.getElementById('modal-links-title');
  const linksHTML  = buildLinks(p.links, 'modal');
  if (linksHTML) {
    linksEl.innerHTML = linksHTML; linksTitEl.style.display = 'block';
  } else {
    linksEl.innerHTML = ''; linksTitEl.style.display = 'none';
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('profile-modal').classList.add('hidden');
}

document.getElementById('close-modal')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', closeModal);
