/**
 * admin.js — Les Narvalos
 * Pas d'écran de login ici.
 * Au chargement : on vérifie via Firebase si l'utilisateur est admin.
 *   → Admin confirmé : dashboard direct (ou onboarding si premier login)
 *   → Non admin / non connecté : écran "Accès refusé" + redirection auto
 */

const API_BASE = 'https://narvalo-blog.onrender.com/api';

let currentToken    = null;
let currentAdmin    = null;
let allPosts        = [];
let deleteTargetId  = null;

document.addEventListener('DOMContentLoaded', () => {
  bindSidebar();
  bindPostForm();
  bindFilters();
  bindModals();
  bindProfileForm();
  bindPasswordChange();

  // Déconnexion depuis le dashboard
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await window.signOutGoogle?.();
    currentAdmin = null;
    currentToken = null;
    showDenied(); // après déco, accès refusé
  });

  // Attendre que Firebase soit prêt puis vérifier l'admin
  waitForFirebase(() => {
    window.getCurrentAdmin().then(user => {
      if (user) {
        currentAdmin = user;
        currentToken = user.token;
        checkOnboarding(user);
      } else {
        showDenied();
      }
    });
  });
});

function waitForFirebase(cb) {
  if (window.getCurrentAdmin) cb();
  else setTimeout(() => waitForFirebase(cb), 100);
}

/* ============================================================
   ÉCRANS
   ============================================================ */

/** Affiche l'écran "Accès refusé" avec compte à rebours 5s → index.html */
function showDenied() {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('onboarding-screen').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.add('hidden');
  document.getElementById('denied-screen').classList.remove('hidden');

  let count = 5;
  const numEl = document.getElementById('countdown-num');
  const timer = setInterval(() => {
    count--;
    if (numEl) numEl.textContent = count;
    if (count <= 0) {
      clearInterval(timer);
      window.location.href = 'index.html';
    }
  }, 1000);
}

function showOnboarding() {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('denied-screen').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.add('hidden');
  document.getElementById('onboarding-screen').classList.remove('hidden');

  document.getElementById('btn-onboarding-save').addEventListener('click', saveOnboarding);
}

function showDashboard() {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('denied-screen').classList.add('hidden');
  document.getElementById('onboarding-screen').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.remove('hidden');

  const name  = currentAdmin.name || currentAdmin.email.split('@')[0];
  const email = currentAdmin.email;
  document.getElementById('sidebar-username').textContent = name;
  document.getElementById('sidebar-email').textContent    = email;

  loadPosts();
  loadStats();
  loadMyProfile();
}

/* ============================================================
   ONBOARDING (premier accès — profil pas encore créé)
   ============================================================ */

async function checkOnboarding(user) {
  try {
    const username = user.name?.split(' ')[0].toLowerCase() || user.email.split('@')[0];
    const res = await fetch(`${API_BASE}/profiles/${encodeURIComponent(username)}`);
    if (res.ok) {
      showDashboard();
    } else {
      showOnboarding();
    }
  } catch {
    showDashboard(); // En cas d'erreur réseau, on laisse passer
  }
}

async function saveOnboarding() {
  const firstName = document.getElementById('ob-firstname').value.trim();
  const errEl     = document.getElementById('onboarding-error');

  if (!firstName) {
    errEl.textContent = 'Le prénom est obligatoire.';
    errEl.classList.remove('hidden');
    return;
  }

  const passions = document.getElementById('ob-passions').value
    .split(',').map(s => s.trim()).filter(Boolean);

  const payload = {
    firstName,
    pseudo:       document.getElementById('ob-pseudo').value.trim(),
    quote:        document.getElementById('ob-quote').value.trim(),
    bio:          document.getElementById('ob-bio').value.trim(),
    nationality:  document.getElementById('ob-nationality').value.trim(),
    dreamCountry: document.getElementById('ob-dreamcountry').value.trim(),
    passions,
    links: {},
  };

  try {
    const res = await fetchAuth(`${API_BASE}/profiles/me`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
    showDashboard();
  } catch {
    errEl.textContent = 'Erreur lors de la création du profil.';
    errEl.classList.remove('hidden');
  }
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function bindSidebar() {
  document.querySelectorAll('.sidebar-link').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
      if (btn.dataset.section === 'stats') loadStats();
    });
  });
  document.getElementById('btn-new-post-shortcut').addEventListener('click', () => {
    switchSection('new-post'); resetForm();
  });
}

function switchSection(name) {
  document.querySelectorAll('.sidebar-link').forEach(b =>
    b.classList.toggle('active', b.dataset.section === name));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
}

/* ============================================================
   POSTS
   ============================================================ */
async function loadPosts() {
  try {
    const res  = await fetchAuth(`${API_BASE}/posts?limit=100&sort=-publishedAt`);
    const data = await res.json();
    allPosts   = data.posts || [];
    renderTable(allPosts);
    populateAuthorFilter(allPosts);
  } catch { notify('Impossible de charger les posts.', 'error'); }
}

function populateAuthorFilter(posts) {
  const select  = document.getElementById('filter-author');
  const authors = [...new Set(posts.map(p => p.author))];
  select.innerHTML = '<option value="all">Tous les auteurs</option>';
  authors.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    select.appendChild(opt);
  });
}

function renderTable(posts) {
  const tbody = document.getElementById('posts-table-body');
  tbody.innerHTML = '';
  if (!posts.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:32px">
      Aucun texte — commencez à écrire ! ✍️</td></tr>`;
    return;
  }
  posts.forEach(post => {
    const isOwn = post.author === (
      currentAdmin?.name?.split(' ')[0] || currentAdmin?.email?.split('@')[0]
    );
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="table-title">${escapeHtml(post.title)}</td>
      <td>${escapeHtml(post.author)}</td>
      <td><span class="badge badge-${post.category}">${categoryLabel(post.category)}</span></td>
      <td>${formatDate(post.publishedAt)}</td>
      <td><span class="status-badge ${statusClass(post)}">${statusLabel(post)}</span></td>
      <td><div class="table-actions">
        ${isOwn ? `<button class="btn-edit" data-id="${post._id}">Modifier</button>` : ''}
        ${isOwn ? `<button class="btn-delete" data-id="${post._id}">Supprimer</button>` : ''}
        ${!isOwn ? '<span style="color:var(--text3);font-size:.75rem">Lecture seule</span>' : ''}
      </div></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-edit').forEach(b =>
    b.addEventListener('click', () => editPost(b.dataset.id)));
  tbody.querySelectorAll('.btn-delete').forEach(b =>
    b.addEventListener('click', () => promptDelete(b.dataset.id)));
}

function bindFilters() {
  document.getElementById('search-posts').addEventListener('input', filterTable);
  document.getElementById('filter-cat').addEventListener('change', filterTable);
  document.getElementById('filter-author').addEventListener('change', filterTable);
}

function filterTable() {
  const q      = document.getElementById('search-posts').value.toLowerCase();
  const cat    = document.getElementById('filter-cat').value;
  const author = document.getElementById('filter-author').value;
  renderTable(allPosts.filter(p =>
    (cat === 'all' || p.category === cat) &&
    (author === 'all' || p.author === author) &&
    p.title.toLowerCase().includes(q)
  ));
}

/* ── Post form ── */
function bindPostForm() {
  document.getElementById('post-summary').addEventListener('input', e => {
    document.getElementById('summary-count').textContent = `${e.target.value.length}/300`;
  });
  document.getElementById('post-form').addEventListener('submit', e => {
    e.preventDefault(); savePost();
  });
  document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    resetForm(); switchSection('posts');
  });
  document.getElementById('btn-preview').addEventListener('click', showPreview);
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.execCommand(btn.dataset.cmd, false, null);
      document.getElementById('post-content').focus();
    });
  });
}

function resetForm() {
  document.getElementById('edit-post-id').value        = '';
  document.getElementById('post-title').value          = '';
  document.getElementById('post-category').value       = '';
  document.getElementById('post-summary').value        = '';
  document.getElementById('post-content').innerHTML    = '';
  document.getElementById('summary-count').textContent = '0/300';
  document.getElementById('form-title').textContent    = 'Nouveau texte';
  document.getElementById('btn-submit-post').textContent = '🚀 Publier';
}

async function savePost() {
  const id       = document.getElementById('edit-post-id').value;
  const title    = document.getElementById('post-title').value.trim();
  const category = document.getElementById('post-category').value;
  const summary  = document.getElementById('post-summary').value.trim();
  const content  = document.getElementById('post-content').innerHTML.trim();
  const author   = currentAdmin?.name?.split(' ')[0]
    || currentAdmin?.email?.split('@')[0]
    || 'Narvalos';

  if (!title || !category || !summary || !content) {
    notify('Remplis tous les champs obligatoires.', 'error'); return;
  }

  const payload = {
    title, author, category, summary, content,
    publishedAt: new Date().toISOString(),
  };

  try {
    const res  = await fetchAuth(
      id ? `${API_BASE}/posts/${id}` : `${API_BASE}/posts`,
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    notify(id ? '✅ Texte modifié !' : '🚀 Texte publié !', 'success');
    resetForm(); loadPosts(); switchSection('posts');
  } catch (err) { notify(err.message, 'error'); }
}

async function editPost(id) {
  const post = allPosts.find(p => p._id === id);
  if (!post) return;
  document.getElementById('form-title').textContent      = 'Modifier le texte';
  document.getElementById('btn-submit-post').textContent = '💾 Enregistrer';
  document.getElementById('edit-post-id').value          = post._id;
  document.getElementById('post-title').value            = post.title;
  document.getElementById('post-category').value         = post.category;
  document.getElementById('post-summary').value          = post.summary;
  document.getElementById('summary-count').textContent   = `${post.summary.length}/300`;
  document.getElementById('post-content').innerHTML      = post.content;
  switchSection('new-post');
}

function promptDelete(id) {
  deleteTargetId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
}

async function deletePost(id) {
  try {
    const res  = await fetchAuth(`${API_BASE}/posts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    notify('🗑️ Texte supprimé.', 'success');
    loadPosts(); loadStats();
  } catch (err) { notify(err.message, 'error'); }
}

/* ============================================================
   PROFIL
   ============================================================ */
async function loadMyProfile() {
  try {
    const username = currentAdmin?.name?.split(' ')[0].toLowerCase()
      || currentAdmin?.email?.split('@')[0];
    const res = await fetch(`${API_BASE}/profiles/${encodeURIComponent(username)}`);
    if (!res.ok) return;
    fillProfileForm(await res.json());
  } catch { }
}

function fillProfileForm(p) {
  document.getElementById('prof-firstname').value    = p.firstName    || '';
  document.getElementById('prof-pseudo').value       = p.pseudo       || '';
  document.getElementById('prof-avatar').value       = p.avatar       || '';
  document.getElementById('prof-quote').value        = p.quote        || '';
  document.getElementById('prof-bio').value          = p.bio          || '';
  document.getElementById('prof-nationality').value  = p.nationality  || '';
  document.getElementById('prof-dreamcountry').value = p.dreamCountry || '';
  document.getElementById('prof-passions').value     = (p.passions||[]).join(', ');
  if (p.links) {
    ['instagram','spotify','twitter','youtube','tiktok','other'].forEach(k => {
      const el = document.getElementById(`link-${k}`);
      if (el) el.value = p.links[k] || '';
    });
  }
  updatePreview();
}

function bindProfileForm() {
  ['prof-firstname','prof-pseudo','prof-quote','prof-avatar'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePreview);
  });
  document.getElementById('prof-avatar-file')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('prof-avatar').value = reader.result;
      updatePreview();
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('profile-form').addEventListener('submit', async e => {
    e.preventDefault(); await saveProfile();
  });
}

function updatePreview() {
  const name   = document.getElementById('prof-firstname').value || 'Ton prénom';
  const pseudo = document.getElementById('prof-pseudo').value    || '';
  const quote  = document.getElementById('prof-quote').value     || 'Ta citation…';
  const avatar = document.getElementById('prof-avatar').value    || '';
  document.getElementById('preview-name-display').textContent   = name;
  document.getElementById('preview-pseudo-display').textContent = pseudo ? `@${pseudo}` : '';
  document.getElementById('preview-quote-display').textContent  = quote;
  const avatarEl = document.getElementById('preview-avatar-display');
  if (avatar) {
    avatarEl.innerHTML = `<img src="${avatar}"
      style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
  } else {
    avatarEl.textContent = name.charAt(0).toUpperCase();
  }
}

async function saveProfile() {
  const passions = document.getElementById('prof-passions').value
    .split(',').map(s => s.trim()).filter(Boolean);
  const payload  = {
    firstName:    document.getElementById('prof-firstname').value.trim(),
    pseudo:       document.getElementById('prof-pseudo').value.trim(),
    avatar:       document.getElementById('prof-avatar').value.trim(),
    quote:        document.getElementById('prof-quote').value.trim(),
    bio:          document.getElementById('prof-bio').value.trim(),
    nationality:  document.getElementById('prof-nationality').value.trim(),
    dreamCountry: document.getElementById('prof-dreamcountry').value.trim(),
    passions,
    links: {
      instagram: document.getElementById('link-instagram').value.trim(),
      spotify:   document.getElementById('link-spotify').value.trim(),
      twitter:   document.getElementById('link-twitter').value.trim(),
      youtube:   document.getElementById('link-youtube').value.trim(),
      tiktok:    document.getElementById('link-tiktok').value.trim(),
      other:     document.getElementById('link-other').value.trim(),
    },
  };
  try {
    const res  = await fetchAuth(`${API_BASE}/profiles/me`, {
      method: 'PUT', body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    notify('💾 Profil sauvegardé !', 'success');
  } catch (err) { notify(err.message, 'error'); }
}

/* ── Changement mot de passe ── */
function bindPasswordChange() {
  document.getElementById('btn-change-password')?.addEventListener('click', async () => {
    const current   = document.getElementById('current-password').value;
    const newPass   = document.getElementById('new-password').value;
    const errEl     = document.getElementById('password-error');
    const successEl = document.getElementById('password-success');

    errEl.classList.add('hidden');
    successEl.classList.add('hidden');

    if (!current || !newPass) {
      errEl.textContent = 'Remplis les deux champs.';
      errEl.classList.remove('hidden'); return;
    }
    if (newPass.length < 6) {
      errEl.textContent = 'Mot de passe trop court (6 caractères min).';
      errEl.classList.remove('hidden'); return;
    }

    const result = await window.changePassword(current, newPass);
    if (result.success) {
      successEl.classList.remove('hidden');
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value     = '';
    } else {
      errEl.textContent = result.message;
      errEl.classList.remove('hidden');
    }
  });
}

/* ============================================================
   STATS
   ============================================================ */
async function loadStats() {
  try {
    const res   = await fetch(`${API_BASE}/posts?limit=1000`);
    const data  = await res.json();
    const posts = data.posts || [];
    const now   = new Date();
    const c     = cat => posts.filter(p => p.category === cat).length;
    document.getElementById('stat-total').textContent     = posts.length;
    document.getElementById('stat-anecdote').textContent  = c('anecdote');
    document.getElementById('stat-poeme').textContent     = c('poeme');
    document.getElementById('stat-journee').textContent   = c('journee');
    document.getElementById('stat-autre').textContent     = c('autre');
    document.getElementById('stat-scheduled').textContent =
      posts.filter(p => new Date(p.publishedAt) > now).length;
  } catch { }
}

/* ============================================================
   MODALS
   ============================================================ */
function bindModals() {
  document.getElementById('cancel-delete').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.add('hidden');
  });
  document.getElementById('confirm-delete').addEventListener('click', async () => {
    document.getElementById('delete-modal').classList.add('hidden');
    if (deleteTargetId) { await deletePost(deleteTargetId); deleteTargetId = null; }
  });
  document.querySelector('#delete-modal .modal-overlay').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.add('hidden');
  });
  document.getElementById('close-preview').addEventListener('click', () => {
    document.getElementById('preview-modal').classList.add('hidden');
  });
  document.querySelector('#preview-modal .modal-overlay').addEventListener('click', () => {
    document.getElementById('preview-modal').classList.add('hidden');
  });
}

function showPreview() {
  const title   = document.getElementById('post-title').value || '(Sans titre)';
  const cat     = document.getElementById('post-category').value;
  const content = document.getElementById('post-content').innerHTML;
  const author  = currentAdmin?.name?.split(' ')[0] || '—';
  document.getElementById('preview-content').innerHTML = `
    <h1 style="font-family:var(--font-display);font-size:1.8rem;margin-bottom:12px">
      ${escapeHtml(title)}</h1>
    <p style="color:var(--text3);font-size:.85rem;margin-bottom:20px">
      — ${escapeHtml(author)} · ${categoryLabel(cat)}</p>
    <hr style="border:none;border-top:1px solid var(--border);margin-bottom:20px"/>
    <div style="font-size:1rem;line-height:1.8;color:var(--text2)">${content}</div>
  `;
  document.getElementById('preview-modal').classList.remove('hidden');
}

/* ============================================================
   UTILS
   ============================================================ */
let notifTimeout;
function notify(msg, type = 'info') {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.className   = `notification ${type}`;
  el.classList.remove('hidden');
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => el.classList.add('hidden'), 3500);
}

async function fetchAuth(url, options = {}) {
  try {
    if (window.firebaseAuth?.currentUser) {
      currentToken = await window.firebaseAuth.currentUser.getIdToken(true);
    }
  } catch(e) { }
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken || ''}`,
      ...(options.headers || {}),
    },
  });
}

function categoryLabel(cat) {
  return { anecdote:'😂 Anecdote', poeme:'🌙 Poème', journee:'☀️ Journée', autre:'✨ Autre' }[cat] || cat;
}
function statusClass(p) {
  return new Date(p.publishedAt) > new Date() ? 'status-scheduled' : 'status-published';
}
function statusLabel(p) {
  return new Date(p.publishedAt) > new Date() ? '⏰ Planifié' : '✅ Publié';
}
function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR', {
    day:'2-digit', month:'2-digit', year:'numeric'
  }) : '—';
}
function escapeHtml(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
