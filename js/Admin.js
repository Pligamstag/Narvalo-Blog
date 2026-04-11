/**
 * admin.js — Les Narvalos
 * Vérif admin → onboarding si premier login → dashboard
 */

const API_BASE = 'https://narvalo-blog.onrender.com/api';

let currentToken   = null;
let currentAdmin   = null;
let allPosts       = [];
let deleteTargetId = null;

document.addEventListener('DOMContentLoaded', function() {

  bindSidebar();
  bindPostForm();
  bindFilters();
  bindModals();
  bindProfileForm();
  bindPasswordChange();

  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
      await window.signOutGoogle();
      window.location.href = 'login.html';
    });
  }

  var tryCheck = function() {
    if (!window.onUserAuthChange) { setTimeout(tryCheck, 100); return; }
    window.onUserAuthChange(async function(user) {
      var checking  = document.getElementById('checking-screen');
      var denied    = document.getElementById('denied-screen');
      var onboarding = document.getElementById('onboarding-screen');
      var dashboard = document.getElementById('admin-dashboard');

      checking.style.display  = 'none';
      denied.style.display    = 'none';
      onboarding.style.display = 'none';
      dashboard.style.display = 'none';

      if (!user) { window.location.href = 'login.html'; return; }

      if (!user.isAdmin) {
        denied.style.display = 'flex'; return;
      }

      currentAdmin = user;
      currentToken = user.token;

      // Vérifier si profil existe
      var username = (user.email || '').split('@')[0].toLowerCase();
      try {
        var profileRes = await fetch(API_BASE + '/profiles/' + encodeURIComponent(username));
        if (!profileRes.ok) {
          // Premier login → onboarding
          onboarding.style.display = 'flex';
          bindOnboarding();
          return;
        }
      } catch(e) {}

      showDashboard(user);
    });
  };
  tryCheck();
});

/* ── Onboarding ── */
function bindOnboarding() {
  var btn = document.getElementById('btn-onboarding-save');
  if (!btn) return;
  btn.addEventListener('click', async function() {
    var firstname = document.getElementById('ob-firstname').value.trim();
    var errEl     = document.getElementById('onboarding-error');
    errEl.classList.add('hidden');

    if (!firstname) {
      errEl.textContent = 'Le prénom est obligatoire.';
      errEl.classList.remove('hidden');
      return;
    }

    var passions = (document.getElementById('ob-passions').value || '')
      .split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    var payload = {
      firstName:    firstname,
      pseudo:       document.getElementById('ob-pseudo').value.trim(),
      quote:        document.getElementById('ob-quote').value.trim(),
      bio:          document.getElementById('ob-bio').value.trim(),
      nationality:  document.getElementById('ob-nationality').value.trim(),
      origin:       document.getElementById('ob-origin').value.trim(),
      dreamCountry: document.getElementById('ob-dreamcountry').value.trim(),
      passions:     passions,
      links:        {},
    };

    btn.disabled = true; btn.textContent = 'Création...';

    try {
      var res = await fetchAuth(API_BASE + '/profiles/me', {
        method: 'PUT', body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      // Invalider le cache pour que le nom se mette à jour
      if (window.invalidateProfileCache && currentAdmin) {
        window.invalidateProfileCache(currentAdmin.uid);
      }
      document.getElementById('onboarding-screen').style.display = 'none';
      showDashboard(currentAdmin);
    } catch(e) {
      errEl.textContent = 'Erreur lors de la création du profil.';
      errEl.classList.remove('hidden');
    }

    btn.disabled = false; btn.textContent = 'Créer mon profil →';
  });
}

function showDashboard(user) {
  document.getElementById('admin-dashboard').style.display = 'flex';
  document.getElementById('sidebar-username').textContent  = user.name || 'Admin';
  document.getElementById('sidebar-email').textContent     = user.email || '';
  loadPosts();
  loadStats();
  loadMyProfile();
}

/* ── Sidebar ── */
function bindSidebar() {
  document.querySelectorAll('.sidebar-link').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.sidebar-link').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(function(s) { s.classList.remove('active'); });
      document.getElementById('section-' + btn.dataset.section).classList.add('active');
      if (btn.dataset.section === 'stats') loadStats();
    });
  });
  document.getElementById('btn-new-post-shortcut').addEventListener('click', function() {
    switchSection('new-post'); resetForm();
  });
}

function switchSection(name) {
  document.querySelectorAll('.sidebar-link').forEach(function(b) {
    b.classList.toggle('active', b.dataset.section === name);
  });
  document.querySelectorAll('.admin-section').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById('section-' + name).classList.add('active');
}

/* ── Posts ── */
async function loadPosts() {
  try {
    var res  = await fetchAuth(API_BASE + '/posts?limit=100&sort=-publishedAt');
    var data = await res.json();
    allPosts = data.posts || [];
    renderTable(allPosts);
    populateAuthorFilter(allPosts);
  } catch(e) { notify('Impossible de charger les posts.', 'error'); }
}

function populateAuthorFilter(posts) {
  var select  = document.getElementById('filter-author');
  var authors = [...new Set(posts.map(function(p) { return p.author; }))];
  select.innerHTML = '<option value="all">Tous les auteurs</option>';
  authors.forEach(function(a) {
    var opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    select.appendChild(opt);
  });
}

function renderTable(posts) {
  var tbody = document.getElementById('posts-table-body');
  tbody.innerHTML = '';
  if (!posts.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:32px">Aucun texte — commence a ecrire !</td></tr>';
    return;
  }
  var myName = currentAdmin ? (currentAdmin.name || '').split(' ')[0] : '';
  posts.forEach(function(post) {
    var isOwn = post.author === myName;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="table-title">' + escapeHtml(post.title) + '</td>' +
      '<td>' + escapeHtml(post.author) + '</td>' +
      '<td><span class="badge badge-' + post.category + '">' + categoryLabel(post.category) + '</span></td>' +
      '<td>' + formatDate(post.publishedAt) + '</td>' +
      '<td><span class="status-badge ' + statusClass(post) + '">' + statusLabel(post) + '</span></td>' +
      '<td><div class="table-actions">' +
        (isOwn ? '<button class="btn-edit" data-id="' + post._id + '">Modifier</button>' : '') +
        (isOwn ? '<button class="btn-delete" data-id="' + post._id + '">Supprimer</button>' : '') +
        (!isOwn ? '<span style="color:var(--text3);font-size:.75rem">Lecture seule</span>' : '') +
      '</div></td>';
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-edit').forEach(function(b) { b.addEventListener('click', function() { editPost(b.dataset.id); }); });
  tbody.querySelectorAll('.btn-delete').forEach(function(b) { b.addEventListener('click', function() { promptDelete(b.dataset.id); }); });
}

function bindFilters() {
  document.getElementById('search-posts').addEventListener('input', filterTable);
  document.getElementById('filter-cat').addEventListener('change', filterTable);
  document.getElementById('filter-author').addEventListener('change', filterTable);
}

function filterTable() {
  var q      = document.getElementById('search-posts').value.toLowerCase();
  var cat    = document.getElementById('filter-cat').value;
  var author = document.getElementById('filter-author').value;
  renderTable(allPosts.filter(function(p) {
    return (cat === 'all' || p.category === cat) &&
           (author === 'all' || p.author === author) &&
           p.title.toLowerCase().includes(q);
  }));
}

function bindPostForm() {
  document.getElementById('post-summary').addEventListener('input', function(e) {
    document.getElementById('summary-count').textContent = e.target.value.length + '/300';
  });
  document.getElementById('post-form').addEventListener('submit', function(e) { e.preventDefault(); savePost(); });
  document.getElementById('btn-cancel-edit').addEventListener('click', function() { resetForm(); switchSection('posts'); });
  document.getElementById('btn-preview').addEventListener('click', showPreview);
  document.querySelectorAll('.toolbar-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
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
  document.getElementById('post-content').innerHTML     = '';
  document.getElementById('summary-count').textContent  = '0/300';
  document.getElementById('form-title').textContent     = 'Nouveau texte';
  document.getElementById('btn-submit-post').textContent = 'Publier';
}

async function savePost() {
  var id       = document.getElementById('edit-post-id').value;
  var title    = document.getElementById('post-title').value.trim();
  var category = document.getElementById('post-category').value;
  var summary  = document.getElementById('post-summary').value.trim();
  var content  = document.getElementById('post-content').innerHTML.trim();
  // Déterminer le nom d'affichage selon displayMode
  var author = 'Narvalos';
  if (currentAdmin) {
    // On récupère le displayMode depuis le select du profil
    var dm = document.getElementById('prof-display-mode')?.value || 'firstName';
    var fn = document.getElementById('prof-firstname')?.value.trim() || '';
    var ps = document.getElementById('prof-pseudo')?.value.trim() || '';
    if (dm === 'pseudo' && ps) author = ps;
    else if (dm === 'both' && fn && ps) author = fn + ' (' + ps + ')';
    else if (fn) author = fn;
    else author = (currentAdmin.name || currentAdmin.email.split('@')[0]).split(' ')[0];
  }

  if (!title || !category || !summary || !content) {
    notify('Remplis tous les champs obligatoires.', 'error'); return;
  }

  var payload = { title, author, category, summary, content, publishedAt: new Date().toISOString() };

  try {
    var res  = await fetchAuth(id ? API_BASE + '/posts/' + id : API_BASE + '/posts',
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message);
    notify(id ? 'Texte modifie !' : 'Texte publie !', 'success');
    resetForm(); loadPosts(); switchSection('posts');
  } catch(err) { notify(err.message, 'error'); }
}

async function editPost(id) {
  var post = allPosts.find(function(p) { return p._id === id; });
  if (!post) return;
  try {
    var res  = await fetchAuth(API_BASE + '/posts/' + id);
    var full = await res.json();
    post = full;
  } catch(e) {}
  document.getElementById('form-title').textContent      = 'Modifier le texte';
  document.getElementById('btn-submit-post').textContent = 'Enregistrer';
  document.getElementById('edit-post-id').value          = post._id;
  document.getElementById('post-title').value            = post.title;
  document.getElementById('post-category').value         = post.category;
  document.getElementById('post-summary').value          = post.summary;
  document.getElementById('summary-count').textContent   = post.summary.length + '/300';
  document.getElementById('post-content').innerHTML      = post.content || '';
  switchSection('new-post');
}

function promptDelete(id) {
  deleteTargetId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
}

async function deletePost(id) {
  try {
    var res  = await fetchAuth(API_BASE + '/posts/' + id, { method: 'DELETE' });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message);
    notify('Texte supprime.', 'success');
    loadPosts(); loadStats();
  } catch(err) { notify(err.message, 'error'); }
}

/* ── Profil ── */
async function loadMyProfile() {
  try {
    var username = currentAdmin ? (currentAdmin.email || '').split('@')[0].toLowerCase() : '';
    var res = await fetch(API_BASE + '/profiles/' + encodeURIComponent(username));
    if (!res.ok) return;
    fillProfileForm(await res.json());
  } catch(e) {}
}

function fillProfileForm(p) {
  document.getElementById('prof-firstname').value    = p.firstName    || '';
  document.getElementById('prof-pseudo').value       = p.pseudo       || '';
  document.getElementById('prof-avatar').value       = p.avatar       || '';
  document.getElementById('prof-quote').value        = p.quote        || '';
  document.getElementById('prof-bio').value          = p.bio          || '';
  document.getElementById('prof-nationality').value  = p.nationality  || '';
  document.getElementById('prof-origin').value       = p.origin       || '';
  document.getElementById('prof-dreamcountry').value = p.dreamCountry || '';
  document.getElementById('prof-passions').value     = (p.passions || []).join(', ');
  if (p.links) {
    ['instagram','spotify','twitter','youtube','tiktok','other'].forEach(function(k) {
      var el = document.getElementById('link-' + k);
      if (el) el.value = p.links[k] || '';
    });
  }
  updatePreview();
}

function bindProfileForm() {
  ['prof-firstname','prof-pseudo','prof-quote','prof-avatar'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
  });
  var fileInput = document.getElementById('prof-avatar-file');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        document.getElementById('prof-avatar').value = reader.result;
        updatePreview();
      };
      reader.readAsDataURL(file);
    });
  }
  document.getElementById('profile-form').addEventListener('submit', async function(e) {
    e.preventDefault(); await saveProfile();
  });
}

function updatePreview() {
  var name   = document.getElementById('prof-firstname').value || 'Ton prenom';
  var pseudo = document.getElementById('prof-pseudo').value    || '';
  var quote  = document.getElementById('prof-quote').value     || 'Ta citation';
  var avatar = document.getElementById('prof-avatar').value    || '';
  document.getElementById('preview-name-display').textContent   = name;
  document.getElementById('preview-pseudo-display').textContent = pseudo ? '@' + pseudo : '';
  document.getElementById('preview-quote-display').textContent  = quote;
  var avatarEl = document.getElementById('preview-avatar-display');
  if (avatar) avatarEl.innerHTML = '<img src="' + avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />';
  else avatarEl.textContent = name.charAt(0).toUpperCase();
}

async function saveProfile() {
  var passions = document.getElementById('prof-passions').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  var payload  = {
    firstName:    document.getElementById('prof-firstname').value.trim(),
    pseudo:       document.getElementById('prof-pseudo').value.trim(),
    avatar:       document.getElementById('prof-avatar').value.trim(),
    quote:        document.getElementById('prof-quote').value.trim(),
    bio:          document.getElementById('prof-bio').value.trim(),
    nationality:  document.getElementById('prof-nationality').value.trim(),
    origin:       document.getElementById('prof-origin')?.value.trim() || '',
    displayMode:  document.getElementById('prof-display-mode')?.value || 'firstName',
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
    var res  = await fetchAuth(API_BASE + '/profiles/me', { method: 'PUT', body: JSON.stringify(payload) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message);
    if (window.invalidateProfileCache && currentAdmin) window.invalidateProfileCache(currentAdmin.uid);
    notify('Profil sauvegarde !', 'success');
  } catch(err) { notify(err.message, 'error'); }
}

function bindPasswordChange() {
  var btn = document.getElementById('btn-change-password');
  if (!btn) return;
  btn.addEventListener('click', async function() {
    var current = document.getElementById('current-password').value;
    var newPass = document.getElementById('new-password').value;
    var errEl   = document.getElementById('password-error');
    var sucEl   = document.getElementById('password-success');
    errEl.classList.add('hidden'); sucEl.classList.add('hidden');
    if (!current || !newPass) { errEl.textContent = 'Remplis les deux champs.'; errEl.classList.remove('hidden'); return; }
    if (newPass.length < 6)   { errEl.textContent = '6 caracteres minimum.'; errEl.classList.remove('hidden'); return; }
    var result = await window.changePassword(current, newPass);
    if (result.success) {
      sucEl.classList.remove('hidden');
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';
    } else {
      errEl.textContent = result.message;
      errEl.classList.remove('hidden');
    }
  });
}

/* ── Stats ── */
async function loadStats() {
  try {
    // Posts
    var res   = await fetch(API_BASE + '/posts?limit=1000');
    var data  = await res.json();
    var posts = data.posts || [];
    var c = function(cat) { return posts.filter(function(p) { return p.category === cat; }).length; };
    document.getElementById('stat-total').textContent    = posts.length;
    document.getElementById('stat-anecdote').textContent = c('anecdote');
    document.getElementById('stat-poeme').textContent    = c('poeme');
    document.getElementById('stat-journee').textContent  = c('journee');
    document.getElementById('stat-autre').textContent    = c('autre');

    // Stats backend (commentaires, membres)
    try {
      var resC  = await fetch(API_BASE + '/stats');
      var dataC = await resC.json();
      document.getElementById('stat-comments').textContent = dataC.totalComments || 0;
      document.getElementById('stat-members').textContent  = dataC.totalMembers  || '—';
      document.getElementById('stat-online').textContent   = dataC.onlineNow     || 0;

      // Réactions totales (depuis localStorage de tous les posts)
      var reactions = { fire: 0, lol: 0, heart: 0, sad: 0, shock: 0 };
      var emojis    = ['🔥','😂','💜','🥺','🤯'];
      var keys      = ['fire','lol','heart','sad','shock'];
      posts.forEach(function(post) {
        // Compter les réactions stockées localement (approximatif)
        emojis.forEach(function(emoji, i) {
          var key = 'reactions_all_' + post._id;
          try {
            var saved = JSON.parse(localStorage.getItem(key) || '{}');
            if (saved[emoji]) reactions[keys[i]]++;
          } catch(e) {}
        });
      });
      document.getElementById('stat-react-fire').textContent  = dataC.reactions ? dataC.reactions['🔥']  || 0 : '—';
      document.getElementById('stat-react-lol').textContent   = dataC.reactions ? dataC.reactions['😂']  || 0 : '—';
      document.getElementById('stat-react-heart').textContent = dataC.reactions ? dataC.reactions['💜'] || 0 : '—';
      document.getElementById('stat-react-sad').textContent   = dataC.reactions ? dataC.reactions['🥺']  || 0 : '—';
      document.getElementById('stat-react-shock').textContent = dataC.reactions ? dataC.reactions['🤯']  || 0 : '—';
    } catch(e) {}

    // Top posts par vues
    var topContainer = document.getElementById('stat-top-posts');
    if (topContainer) {
      var sorted = posts.slice().sort(function(a,b) { return (b.views||0) - (a.views||0); }).slice(0,5);
      if (sorted.length) {
        topContainer.innerHTML = sorted.map(function(p, i) {
          return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--surface2);border-radius:8px">' +
            '<span style="font-size:.75rem;font-weight:800;color:var(--accent);min-width:20px">#' + (i+1) + '</span>' +
            '<span style="flex:1;font-size:.88rem;color:var(--text);font-weight:600">' + escapeHtml(p.title) + '</span>' +
            '<span style="font-size:.78rem;color:var(--text3)">' + (p.views||0) + ' vues</span>' +
            '</div>';
        }).join('');
      } else {
        topContainer.innerHTML = '<p style="color:var(--text3);font-size:.85rem">Aucune vue enregistrée.</p>';
      }
    }
  } catch(e) {}
}

/* ── Modals ── */
function bindModals() {
  document.getElementById('cancel-delete').addEventListener('click', function() {
    document.getElementById('delete-modal').classList.add('hidden');
  });
  document.getElementById('confirm-delete').addEventListener('click', async function() {
    document.getElementById('delete-modal').classList.add('hidden');
    if (deleteTargetId) { await deletePost(deleteTargetId); deleteTargetId = null; }
  });
  document.querySelector('#delete-modal .modal-overlay').addEventListener('click', function() {
    document.getElementById('delete-modal').classList.add('hidden');
  });
  document.getElementById('close-preview').addEventListener('click', function() {
    document.getElementById('preview-modal').classList.add('hidden');
  });
  document.querySelector('#preview-modal .modal-overlay').addEventListener('click', function() {
    document.getElementById('preview-modal').classList.add('hidden');
  });
}

function showPreview() {
  var title   = document.getElementById('post-title').value || '(Sans titre)';
  var cat     = document.getElementById('post-category').value;
  var content = document.getElementById('post-content').innerHTML;
  var author  = currentAdmin ? (currentAdmin.name || '').split(' ')[0] : '';
  document.getElementById('preview-content').innerHTML =
    '<h1 style="font-family:var(--font-display);font-size:1.8rem;margin-bottom:12px">' + escapeHtml(title) + '</h1>' +
    '<p style="color:var(--text3);font-size:.85rem;margin-bottom:20px">— ' + escapeHtml(author) + ' · ' + categoryLabel(cat) + '</p>' +
    '<hr style="border:none;border-top:1px solid var(--border);margin-bottom:20px"/>' +
    '<div style="font-size:1rem;line-height:1.8;color:var(--text2)">' + content + '</div>';
  document.getElementById('preview-modal').classList.remove('hidden');
}

/* ── Utils ── */
var notifTimeout;
function notify(msg, type) {
  type = type || 'info';
  var el = document.getElementById('notification');
  el.textContent = msg;
  el.className   = 'notification ' + type;
  el.classList.remove('hidden');
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(function() { el.classList.add('hidden'); }, 3500);
}

async function fetchAuth(url, options) {
  options = options || {};
  try {
    if (window.firebaseAuth && window.firebaseAuth.currentUser) {
      currentToken = await window.firebaseAuth.currentUser.getIdToken(true);
    }
  } catch(e) {}
  return fetch(url, Object.assign({}, options, {
    headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (currentToken || '') }, options.headers || {})
  }));
}

function categoryLabel(cat) {
  var labels = { anecdote:'Anecdote', poeme:'Poeme', journee:'Journee', autre:'Autre' };
  return labels[cat] || cat;
}
function statusClass(p) { return new Date(p.publishedAt) > new Date() ? 'status-scheduled' : 'status-published'; }
function statusLabel(p) { return new Date(p.publishedAt) > new Date() ? 'Planifie' : 'Publie'; }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'; }
function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
