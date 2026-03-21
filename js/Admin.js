/**
 * admin.js — Les Narvalos
 * Auth via Firebase Google Sign-In
 */

const API_BASE = 'https://narvalo-blog.onrender.com/api';

let currentToken = null;
let currentAdmin = null;
let allPosts     = [];
let deleteTargetId = null;

// Attendre que Firebase soit prêt
document.addEventListener('DOMContentLoaded', () => {
  bindSidebar();
  bindPostForm();
  bindFilters();
  bindModals();
  bindProfileForm();

  // Bouton connexion Google
  document.getElementById('btn-google-login').addEventListener('click', handleGoogleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Vérifier si déjà connecté
  // Auto-login check
waitForFirebase(() => {
    window.getCurrentAdmin().then(user => {
      if (user) {
        currentAdmin = user;
        currentToken = user.token;
        showDashboard();
      } else {
        showLogin();
      }
    });
  });
});

function waitForFirebase(callback) {
  if (window.getCurrentAdmin) {
    callback();
  } else {
    setTimeout(() => waitForFirebase(callback), 100);
  }
}

/* ── Auth ── */
async function handleGoogleLogin() {
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('btn-google-login');
  errEl.classList.add('hidden');
  btn.textContent = '⏳ Connexion...';
  btn.disabled = true;

  const result = await window.signInWithGoogle();

  btn.disabled = false;
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
    Se connecter avec Google`;

  if (!result.success) {
    if (result.reason === 'not_admin') {
      errEl.textContent = '❌ Cet email n\'est pas autorisé comme admin.';
    } else if (result.reason === 'auth/popup-closed-by-user') {
      // Popup fermée — pas d'erreur
      return;
    } else {
      errEl.textContent = '❌ Erreur de connexion. Réessaie.';
    }
    errEl.classList.remove('hidden');
    return;
  }

  currentAdmin = result;
  currentToken = result.token;
  showDashboard();
}

async function handleLogout() {
  await window.signOutGoogle();
  currentAdmin = null;
  currentToken = null;
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('admin-dashboard').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.remove('hidden');

  const name   = currentAdmin.name || currentAdmin.email.split('@')[0];
  const email  = currentAdmin.email;
  const avatar = currentAdmin.avatar;

  document.getElementById('sidebar-username').textContent = name;
  document.getElementById('sidebar-email').textContent    = email;

  const avatarEl = document.getElementById('sidebar-avatar');
  if (avatar) { avatarEl.src = avatar; avatarEl.style.display = 'block'; }
  else avatarEl.style.display = 'none';

  // Pré-remplir l'auteur avec le prénom Google
  document.getElementById('post-author').value = name.split(' ')[0];

  loadPosts();
  loadStats();
  loadMyProfile();
}

/* ── Sidebar ── */
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
  document.querySelectorAll('.sidebar-link').forEach(b => b.classList.toggle('active', b.dataset.section === name));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
}

/* ── Posts ── */
async function loadPosts() {
  try {
    const res  = await fetchAuth(`${API_BASE}/posts?limit=100&sort=-publishedAt`);
    const data = await res.json();
    allPosts   = data.posts || [];
    renderTable(allPosts);
  } catch { notify('Impossible de charger les posts.', 'error'); }
}

function renderTable(posts) {
  const tbody = document.getElementById('posts-table-body');
  tbody.innerHTML = '';
  if (!posts.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:32px">
      Aucun texte — commence à écrire ! ✍️</td></tr>`;
    return;
  }
  posts.forEach(post => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="table-title">${escapeHtml(post.title)}</td>
      <td><span class="badge badge-${post.category}">${categoryLabel(post.category)}</span></td>
      <td>${formatDate(post.publishedAt)}</td>
      <td><span class="status-badge ${statusClass(post)}">${statusLabel(post)}</span></td>
      <td><div class="table-actions">
        <button class="btn-edit" data-id="${post._id}">Modifier</button>
        <button class="btn-delete" data-id="${post._id}">Supprimer</button>
      </div></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => editPost(b.dataset.id)));
  tbody.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => promptDelete(b.dataset.id)));
}

function bindFilters() {
  document.getElementById('search-posts').addEventListener('input', filterTable);
  document.getElementById('filter-cat').addEventListener('change', filterTable);
}

function filterTable() {
  const q   = document.getElementById('search-posts').value.toLowerCase();
  const cat = document.getElementById('filter-cat').value;
  renderTable(allPosts.filter(p =>
    (cat === 'all' || p.category === cat) &&
    (p.title.toLowerCase().includes(q) || (p.author||'').toLowerCase().includes(q))
  ));
}

function bindPostForm() {
  document.getElementById('post-summary').addEventListener('input', e => {
    document.getElementById('summary-count').textContent = `${e.target.value.length}/300`;
  });
  document.getElementById('post-form').addEventListener('submit', e => { e.preventDefault(); savePost(); });
  document.getElementById('btn-cancel-edit').addEventListener('click', () => { resetForm(); switchSection('posts'); });
  document.getElementById('btn-preview').addEventListener('click', showPreview);
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.execCommand(btn.dataset.cmd, false, null);
      document.getElementById('post-content').focus();
    });
  });
}

function resetForm() {
  document.getElementById('edit-post-id').value         = '';
  document.getElementById('post-title').value           = '';
  document.getElementById('post-category').value        = '';
  document.getElementById('post-summary').value         = '';
  document.getElementById('post-publish-date').value    = '';
  document.getElementById('post-content').innerHTML     = '';
  document.getElementById('summary-count').textContent  = '0/300';
  document.getElementById('form-title').textContent     = 'Nouveau texte';
  document.getElementById('btn-submit-post').textContent = '🚀 Publier';
  // Remettre le prénom Google
  if (currentAdmin) {
    const name = currentAdmin.name || '';
    document.getElementById('post-author').value = name.split(' ')[0];
  }
}

async function savePost() {
  const id       = document.getElementById('edit-post-id').value;
  const title    = document.getElementById('post-title').value.trim();
  const author   = document.getElementById('post-author').value.trim();
  const category = document.getElementById('post-category').value;
  const summary  = document.getElementById('post-summary').value.trim();
  const content  = document.getElementById('post-content').innerHTML.trim();
  const pubDate  = document.getElementById('post-publish-date').value;

  if (!title || !author || !category || !summary || !content) {
    notify('Remplis tous les champs obligatoires.', 'error'); return;
  }

  const payload = { title, author, category, summary, content,
    publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString() };

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
  document.getElementById('post-author').value           = post.author;
  document.getElementById('post-category').value         = post.category;
  document.getElementById('post-summary').value          = post.summary;
  document.getElementById('summary-count').textContent   = `${post.summary.length}/300`;
  document.getElementById('post-content').innerHTML      = post.content;
  if (post.publishedAt) {
    const d = new Date(post.publishedAt);
    document.getElementById('post-publish-date').value =
      new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
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

/* ── Profil ── */
async function loadMyProfile() {
  try {
    const username = currentAdmin?.name?.split(' ')[0].toLowerCase() || 'me';
    const res = await fetch(`${API_BASE}/profiles/${username}`);
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
    reader.onload = () => { document.getElementById('prof-avatar').value = reader.result; updatePreview(); };
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
  if (avatar) avatarEl.innerHTML = `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
  else avatarEl.textContent = name.charAt(0).toUpperCase();
}

async function saveProfile() {
  const passions = document.getElementById('prof-passions').value.split(',').map(s => s.trim()).filter(Boolean);
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
    const res  = await fetchAuth(`${API_BASE}/profiles/me`, { method: 'PUT', body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    notify('💾 Profil sauvegardé !', 'success');
  } catch (err) { notify(err.message, 'error'); }
}

async function loadStats() {
  try {
    const res   = await fetchAuth(`${API_BASE}/posts?limit=1000`);
    const data  = await res.json();
    const posts = data.posts || [];
    const now   = new Date();
    const c     = cat => posts.filter(p => p.category === cat).length;
    document.getElementById('stat-total').textContent     = posts.length;
    document.getElementById('stat-anecdote').textContent  = c('anecdote');
    document.getElementById('stat-poeme').textContent     = c('poeme');
    document.getElementById('stat-journee').textContent   = c('journee');
    document.getElementById('stat-autre').textContent     = c('autre');
    document.getElementById('stat-scheduled').textContent = posts.filter(p => new Date(p.publishedAt) > now).length;
  } catch { }
}

/* ── Modals ── */
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
  const author  = document.getElementById('post-author').value || '—';
  const cat     = document.getElementById('post-category').value;
  const content = document.getElementById('post-content').innerHTML;
  document.getElementById('preview-content').innerHTML = `
    <h1 style="font-family:var(--font-display);font-size:1.8rem;margin-bottom:12px">${escapeHtml(title)}</h1>
    <p style="color:var(--text3);font-size:.85rem;margin-bottom:20px">— ${escapeHtml(author)} · ${categoryLabel(cat)}</p>
    <hr style="border:none;border-top:1px solid var(--border);margin-bottom:20px"/>
    <div style="font-size:1rem;line-height:1.8;color:var(--text2)">${content}</div>
  `;
  document.getElementById('preview-modal').classList.remove('hidden');
}

/* ── Utils ── */
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
  // Toujours récupérer un token frais depuis Firebase
  try {
    if (window.firebaseAuth?.currentUser) {
      currentToken = await window.firebaseAuth.currentUser.getIdToken(true);
    }
  } catch(e) { console.warn('Token refresh failed', e); }

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken || ''}`,
      ...(options.headers||{})
    },
  });
}

function categoryLabel(cat) {
  return { anecdote:'😂 Anecdote', poeme:'🌙 Poème', journee:'☀️ Journée', autre:'✨ Autre' }[cat] || cat;
}
function statusClass(p) { return new Date(p.publishedAt) > new Date() ? 'status-scheduled' : 'status-published'; }
function statusLabel(p) { return new Date(p.publishedAt) > new Date() ? '⏰ Planifié' : '✅ Publié'; }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'; }
function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
