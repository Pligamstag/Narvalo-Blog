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
      var checking   = document.getElementById('checking-screen');
      var denied     = document.getElementById('denied-screen');
      var onboarding = document.getElementById('onboarding-screen');
      var dashboard  = document.getElementById('admin-dashboard');

      if (checking)   checking.style.display   = 'none';
      if (denied)     denied.style.display     = 'none';
      if (onboarding) onboarding.style.display = 'none';
      if (dashboard)  dashboard.style.display  = 'none';

      if (!user) { window.location.href = 'login.html'; return; }
      if (!user.isAdmin) { if (denied) denied.style.display = 'flex'; return; }

      currentAdmin = user;
      currentToken = user.token;

      var username = (user.email || '').split('@')[0].toLowerCase();
      try {
        var profileRes = await fetch(API_BASE + '/profiles/' + encodeURIComponent(username));
        if (!profileRes.ok) {
          if (onboarding) onboarding.style.display = 'flex';
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
    if (errEl) errEl.classList.add('hidden');

    if (!firstname) {
      if (errEl) { errEl.textContent = 'Le prénom est obligatoire.'; errEl.classList.remove('hidden'); }
      return;
    }

    var passions = (document.getElementById('ob-passions')?.value || '')
      .split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    var payload = {
      firstName:    firstname,
      pseudo:       document.getElementById('ob-pseudo')?.value.trim() || '',
      quote:        document.getElementById('ob-quote')?.value.trim() || '',
      bio:          document.getElementById('ob-bio')?.value.trim() || '',
      nationality:  document.getElementById('ob-nationality')?.value.trim() || '',
      origin:       document.getElementById('ob-origin')?.value.trim() || '',
      dreamCountry: document.getElementById('ob-dreamcountry')?.value.trim() || '',
      passions:     passions,
      links:        {},
    };

    btn.disabled = true; btn.textContent = 'Création...';

    try {
      var res = await fetchAuth(API_BASE + '/profiles/me', { method: 'PUT', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      if (window.invalidateProfileCache && currentAdmin) window.invalidateProfileCache(currentAdmin.uid);
      var ob = document.getElementById('onboarding-screen');
      if (ob) ob.style.display = 'none';
      showDashboard(currentAdmin);
    } catch(e) {
      if (errEl) { errEl.textContent = 'Erreur lors de la création du profil.'; errEl.classList.remove('hidden'); }
    }

    btn.disabled = false; btn.textContent = 'Créer mon profil →';
  });
}

function showDashboard(user) {
  var dashboard = document.getElementById('admin-dashboard');
  if (dashboard) dashboard.style.display = 'flex';
  var su = document.getElementById('sidebar-username');
  var se = document.getElementById('sidebar-email');
  if (su) su.textContent = user.name || 'Admin';
  if (se) se.textContent = user.email || '';
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
      var sec = document.getElementById('section-' + btn.dataset.section);
      if (sec) sec.classList.add('active');
      if (btn.dataset.section === 'stats') loadStats();
    });
  });
  var shortcut = document.getElementById('btn-new-post-shortcut');
  if (shortcut) shortcut.addEventListener('click', function() { switchSection('new-post'); resetForm(); });
}

function switchSection(name) {
  document.querySelectorAll('.sidebar-link').forEach(function(b) {
    b.classList.toggle('active', b.dataset.section === name);
  });
  document.querySelectorAll('.admin-section').forEach(function(s) { s.classList.remove('active'); });
  var sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
}

/* ── Posts ── */
async function loadPosts() {
  try {
    var res  = await fetchAuth(API_BASE + '/posts?limit=100&sort=-publishedAt');
    var data = await res.json();
    allPosts = data.posts || [];
    renderTable(allPosts);
    populateAuthorFilter(allPosts);
  } catch(e) { 
    console.error('loadPosts error:', e);
    notify('Impossible de charger les posts.', 'error'); 
  }
}

function populateAuthorFilter(posts) {
  var select = document.getElementById('filter-author');
  if (!select) return;
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
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!posts.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:32px">Aucun texte</td></tr>';
    return;
  }
  
  posts.forEach(function(post) {
    // Chaque admin ne peut modifier/supprimer que ses propres posts
    var isOwn = (post.authorEmail && post.authorEmail === currentAdmin.email) || 
                (post.authorId && post.authorId === currentAdmin.uid);
    
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
  
  tbody.querySelectorAll('.btn-edit').forEach(function(b) { 
    b.addEventListener('click', function() { editPost(b.dataset.id); }); 
  });
  tbody.querySelectorAll('.btn-delete').forEach(function(b) { 
    b.addEventListener('click', function() { promptDelete(b.dataset.id); }); 
  });
}

function bindFilters() {
  var s = document.getElementById('search-posts');
  var c = document.getElementById('filter-cat');
  var a = document.getElementById('filter-author');
  if (s) s.addEventListener('input', filterTable);
  if (c) c.addEventListener('change', filterTable);
  if (a) a.addEventListener('change', filterTable);
}

function filterTable() {
  var q      = document.getElementById('search-posts')?.value.toLowerCase() || '';
  var cat    = document.getElementById('filter-cat')?.value || 'all';
  var author = document.getElementById('filter-author')?.value || 'all';
  renderTable(allPosts.filter(function(p) {
    return (cat === 'all' || p.category === cat) &&
           (author === 'all' || p.author === author) &&
           p.title.toLowerCase().includes(q);
  }));
}

function bindPostForm() {
  var summary = document.getElementById('post-summary');
  if (summary) summary.addEventListener('input', function(e) {
    var el = document.getElementById('summary-count');
    if (el) el.textContent = e.target.value.length + '/300';
  });
  var form = document.getElementById('post-form');
  if (form) form.addEventListener('submit', function(e) { e.preventDefault(); savePost(); });
  var cancel = document.getElementById('btn-cancel-edit');
  if (cancel) cancel.addEventListener('click', function() { resetForm(); switchSection('posts'); });
  var preview = document.getElementById('btn-preview');
  if (preview) preview.addEventListener('click', showPreview);
  document.querySelectorAll('.toolbar-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.execCommand(btn.dataset.cmd, false, null);
      var c = document.getElementById('post-content');
      if (c) c.focus();
    });
  });
}

function resetForm() {
  ['edit-post-id','post-title','post-category','post-summary'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var c = document.getElementById('post-content');
  if (c) c.innerHTML = '';
  var sc = document.getElementById('summary-count');
  if (sc) sc.textContent = '0/300';
  var ft = document.getElementById('form-title');
  if (ft) ft.textContent = 'Nouveau texte';
  var sb = document.getElementById('btn-submit-post');
  if (sb) sb.textContent = 'Publier';
}

async function savePost() {
  var id       = document.getElementById('edit-post-id')?.value || '';
  var title    = document.getElementById('post-title')?.value.trim() || '';
  var category = document.getElementById('post-category')?.value || '';
  var summary  = document.getElementById('post-summary')?.value.trim() || '';
  var content  = document.getElementById('post-content')?.innerHTML.trim() || '';

  // Nom d'affichage selon displayMode
  var author = 'Narvalos';
  if (currentAdmin) {
    var dm = document.getElementById('prof-display-mode')?.value || 'firstName';
    var fn = document.getElementById('prof-firstname')?.value.trim() || '';
    var ps = document.getElementById('prof-pseudo')?.value.trim() || '';
    var showFn = document.getElementById('prof-show-firstname')?.checked !== false;
    if (!showFn && ps) author = ps;
    else if (dm === 'pseudo' && ps) author = ps;
    else if (dm === 'both' && fn && ps) author = fn + ' · @' + ps;
    else if (fn) author = fn;
    else author = (currentAdmin.name || currentAdmin.email.split('@')[0]).split(' ')[0];
  }

  if (!title || !category || !summary || !content) {
    notify('Remplis tous les champs obligatoires.', 'error'); return;
  }

  var payload = { 
    title: title, 
    author: author, 
    authorEmail: currentAdmin.email,   
    authorId: currentAdmin.uid,          
    category: category, 
    summary: summary, 
    content: content, 
    publishedAt: new Date().toISOString() 
  };

  try {
    var res  = await fetchAuth(id ? API_BASE + '/posts/' + id : API_BASE + '/posts',
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message);
    notify(id ? 'Texte modifié !' : 'Texte publié !', 'success');
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
  var els = {
    'form-title': { prop: 'textContent', val: 'Modifier le texte' },
    'btn-submit-post': { prop: 'textContent', val: 'Enregistrer' },
    'edit-post-id': { prop: 'value', val: post._id },
    'post-title': { prop: 'value', val: post.title },
    'post-category': { prop: 'value', val: post.category },
    'post-summary': { prop: 'value', val: post.summary },
    'summary-count': { prop: 'textContent', val: post.summary.length + '/300' },
  };
  Object.entries(els).forEach(function(e) {
    var el = document.getElementById(e[0]);
    if (el) el[e[1].prop] = e[1].val;
  });
  var c = document.getElementById('post-content');
  if (c) c.innerHTML = post.content || '';
  switchSection('new-post');
}

function promptDelete(id) {
  deleteTargetId = id;
  var m = document.getElementById('delete-modal');
  if (m) m.classList.remove('hidden');
}

async function deletePost(id) {
  try {
    var res  = await fetchAuth(API_BASE + '/posts/' + id, { method: 'DELETE' });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message);
    notify('Texte supprimé.', 'success');
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
  var fields = {
    'prof-firstname': p.firstName || '', 'prof-pseudo': p.pseudo || '',
    'prof-avatar': p.avatar || '', 'prof-quote': p.quote || '',
    'prof-bio': p.bio || '', 'prof-nationality': p.nationality || '',
    'prof-origin': p.origin || '', 'prof-dreamcountry': p.dreamCountry || '',
    'prof-passions': (p.passions || []).join(', '),
  };
  Object.entries(fields).forEach(function(e) {
    var el = document.getElementById(e[0]);
    if (el) el.value = e[1];
  });

  var dm = document.getElementById('prof-display-mode');
  if (dm) dm.value = p.displayMode || 'firstName';

  var showFn = document.getElementById('prof-show-firstname');
  if (showFn) {
    var show   = p.showFirstName !== false;
    showFn.checked = show;
    var slider = showFn.nextElementSibling;
    var knob   = slider?.nextElementSibling;
    if (slider) { slider.style.background = show ? 'rgba(155,89,245,.2)' : 'var(--surface)'; slider.style.borderColor = show ? 'var(--accent)' : 'var(--border2)'; }
    if (knob)   { knob.style.transform = show ? 'translateX(18px)' : 'translateX(0)'; knob.style.background = show ? 'var(--accent)' : 'var(--text3)'; }
  }

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
        var av = document.getElementById('prof-avatar');
        if (av) av.value = reader.result;
        updatePreview();
      };
      reader.readAsDataURL(file);
    });
  }
  var form = document.getElementById('profile-form');
  if (form) form.addEventListener('submit', async function(e) { e.preventDefault(); await saveProfile(); });
}

function updatePreview() {
  var name   = document.getElementById('prof-firstname')?.value || 'Ton prénom';
  var pseudo = document.getElementById('prof-pseudo')?.value    || '';
  var quote  = document.getElementById('prof-quote')?.value     || 'Ta citation';
  var avatar = document.getElementById('prof-avatar')?.value    || '';
  var pn = document.getElementById('preview-name-display');
  var pp = document.getElementById('preview-pseudo-display');
  var pq = document.getElementById('preview-quote-display');
  var pa = document.getElementById('preview-avatar-display');
  if (pn) pn.textContent = name;
  if (pp) pp.textContent = pseudo ? '@' + pseudo : '';
  if (pq) pq.textContent = quote;
  if (pa) {
    if (avatar) pa.innerHTML = '<img src="' + avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />';
    else pa.textContent = name.charAt(0).toUpperCase();
  }
}

async function saveProfile() {
  var passions = (document.getElementById('prof-passions')?.value || '')
    .split(',').map(function(s) { return s.trim(); }).filter(Boolean);

  var payload = {
    firstName:     document.getElementById('prof-firstname')?.value.trim() || '',
    pseudo:        document.getElementById('prof-pseudo')?.value.trim() || '',
    avatar:        document.getElementById('prof-avatar')?.value.trim() || '',
    quote:         document.getElementById('prof-quote')?.value.trim() || '',
    bio:           document.getElementById('prof-bio')?.value.trim() || '',
    nationality:   document.getElementById('prof-nationality')?.value.trim() || '',
    origin:        document.getElementById('prof-origin')?.value.trim() || '',
    dreamCountry:  document.getElementById('prof-dreamcountry')?.value.trim() || '',
    displayMode:   document.getElementById('prof-display-mode')?.value || 'firstName',
    showFirstName: document.getElementById('prof-show-firstname')?.checked !== false,
    passions:      passions,
    links: {
      instagram: document.getElementById('link-instagram')?.value.trim() || '',
      spotify:   document.getElementById('link-spotify')?.value.trim() || '',
      twitter:   document.getElementById('link-twitter')?.value.trim() || '',
      youtube:   document.getElementById('link-youtube')?.value.trim() || '',
      tiktok:    document.getElementById('link-tiktok')?.value.trim() || '',
      other:     document.getElementById('link-other')?.value.trim() || '',
    },
  };

  try {
    var res  = await fetchAuth(API_BASE + '/profiles/me', { method: 'PUT', body: JSON.stringify(payload) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message);
    if (window.invalidateProfileCache && currentAdmin) window.invalidateProfileCache(currentAdmin.uid);
    notify('Profil sauvegardé !', 'success');
  } catch(err) { notify(err.message || 'Erreur.', 'error'); }
}

function bindPasswordChange() {
  var btn = document.getElementById('btn-change-password');
  if (!btn) return;
  btn.addEventListener('click', async function() {
    var current = document.getElementById('current-password')?.value || '';
    var newPass = document.getElementById('new-password')?.value || '';
    var errEl   = document.getElementById('password-error');
    var sucEl   = document.getElementById('password-success');
    if (errEl) errEl.classList.add('hidden');
    if (sucEl) sucEl.classList.add('hidden');
    if (!current || !newPass) { if (errEl) { errEl.textContent = 'Remplis les deux champs.'; errEl.classList.remove('hidden'); } return; }
    if (newPass.length < 6)   { if (errEl) { errEl.textContent = '6 caractères minimum.'; errEl.classList.remove('hidden'); } return; }
    var result = await window.changePassword(current, newPass);
    if (result.success) {
      if (sucEl) sucEl.classList.remove('hidden');
      var cp = document.getElementById('current-password');
      var np = document.getElementById('new-password');
      if (cp) cp.value = ''; if (np) np.value = '';
    } else {
      if (errEl) { errEl.textContent = result.message; errEl.classList.remove('hidden'); }
    }
  });
}

/* ── Stats ── */
async function loadStats() {
  try {
    var res   = await fetch(API_BASE + '/posts?limit=1000');
    var data  = await res.json();
    var posts = data.posts || [];
    var c     = function(cat) { return posts.filter(function(p) { return p.category === cat; }).length; };
    var set   = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total', posts.length); set('stat-anecdote', c('anecdote'));
    set('stat-poeme', c('poeme')); set('stat-journee', c('journee')); set('stat-autre', c('autre'));

    try {
      var resC  = await fetch(API_BASE + '/stats');
      var dataC = await resC.json();
      set('stat-comments', dataC.totalComments || 0);
      set('stat-members',  dataC.totalMembers  || '—');
      set('stat-online',   dataC.onlineNow     || 0);
      var r = dataC.reactions || {};
      set('stat-react-fire',  r['🔥'] || 0); set('stat-react-lol',  r['😂'] || 0);
      set('stat-react-heart', r['💜'] || 0); set('stat-react-sad',  r['🥺'] || 0);
      set('stat-react-shock', r['🤯'] || 0);
    } catch(e) {}

    var topContainer = document.getElementById('stat-top-posts');
    if (topContainer) {
      var sorted = posts.slice().sort(function(a,b) { return (b.views||0)-(a.views||0); }).slice(0,5);
      topContainer.innerHTML = sorted.length
        ? sorted.map(function(p,i) {
            return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--surface2);border-radius:8px;margin-bottom:6px">' +
              '<span style="font-size:.75rem;font-weight:800;color:var(--accent);min-width:20px">#'+(i+1)+'</span>' +
              '<span style="flex:1;font-size:.88rem;color:var(--text);font-weight:600">'+escapeHtml(p.title)+'</span>' +
              '<span style="font-size:.78rem;color:var(--text3)">'+(p.views||0)+' vues</span></div>';
          }).join('')
        : '<p style="color:var(--text3);font-size:.85rem">Aucune vue enregistrée.</p>';
    }
  } catch(e) {}
}

/* ── Modals ── */
function bindModals() {
  var cd = document.getElementById('cancel-delete');
  var cfd = document.getElementById('confirm-delete');
  var do_ = document.querySelector('#delete-modal .modal-overlay');
  var cp  = document.getElementById('close-preview');
  var po  = document.querySelector('#preview-modal .modal-overlay');

  if (cd)  cd.addEventListener('click', function() { document.getElementById('delete-modal')?.classList.add('hidden'); });
  if (cfd) cfd.addEventListener('click', async function() {
    document.getElementById('delete-modal')?.classList.add('hidden');
    if (deleteTargetId) { await deletePost(deleteTargetId); deleteTargetId = null; }
  });
  if (do_) do_.addEventListener('click', function() { document.getElementById('delete-modal')?.classList.add('hidden'); });
  if (cp)  cp.addEventListener('click', function()  { document.getElementById('preview-modal')?.classList.add('hidden'); });
  if (po)  po.addEventListener('click', function()  { document.getElementById('preview-modal')?.classList.add('hidden'); });
}

function showPreview() {
  var title   = document.getElementById('post-title')?.value || '(Sans titre)';
  var cat     = document.getElementById('post-category')?.value || '';
  var content = document.getElementById('post-content')?.innerHTML || '';
  var author  = currentAdmin ? (currentAdmin.name || '').split(' ')[0] : '';
  var el = document.getElementById('preview-content');
  if (el) el.innerHTML =
    '<h1 style="font-family:var(--font-display);font-size:1.8rem;margin-bottom:12px">' + escapeHtml(title) + '</h1>' +
    '<p style="color:var(--text3);font-size:.85rem;margin-bottom:20px">— ' + escapeHtml(author) + ' · ' + categoryLabel(cat) + '</p>' +
    '<hr style="border:none;border-top:1px solid var(--border);margin-bottom:20px"/>' +
    '<div style="font-size:1rem;line-height:1.8;color:var(--text2)">' + content + '</div>';
  document.getElementById('preview-modal')?.classList.remove('hidden');
}

/* ── Utils ── */
var notifTimeout;
function notify(msg, type) {
  type = type || 'info';
  var el = document.getElementById('notification');
  if (!el) return;
  el.textContent = msg; el.className = 'notification ' + type;
  el.classList.remove('hidden');
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(function() { el.classList.add('hidden'); }, 3500);
}

async function fetchAuth(url, options) {
  options = options || {};
  try {
    if (window.firebaseAuth?.currentUser) {
      currentToken = await window.firebaseAuth.currentUser.getIdToken(true);
    }
  } catch(e) {}
  return fetch(url, Object.assign({}, options, {
    headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (currentToken || '') }, options.headers || {})
  }));
}

function categoryLabel(cat) {
  return { anecdote:'Anecdote', poeme:'Poème', journee:'Journée', autre:'Autre' }[cat] || cat;
}
function statusClass(p) { return new Date(p.publishedAt) > new Date() ? 'status-scheduled' : 'status-published'; }
function statusLabel(p) { return new Date(p.publishedAt) > new Date() ? 'Planifié' : 'Publié'; }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'; }
function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
