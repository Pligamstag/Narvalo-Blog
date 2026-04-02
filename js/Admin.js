/**
 * admin.js — Les Narvalos
 * CORRIGÉ : Vérif admin avec token frais → onboarding si premier login → dashboard
 */

const API_BASE = 'https://narvalo-blog.onrender.com/api';
let currentToken = null;
let currentAdmin = null;
let allPosts = [];
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
      var checking = document.getElementById('checking-screen');
      var denied = document.getElementById('denied-screen');
      var onboarding = document.getElementById('onboarding-screen');
      var dashboard = document.getElementById('admin-dashboard');
      
      checking.style.display = 'none';
      denied.style.display = 'none';
      onboarding.style.display = 'none';
      dashboard.style.display = 'none';
      
      if (!user) { window.location.href = 'login.html'; return; }
      if (!user.isAdmin) {
        denied.style.display = 'flex'; 
        return;
      }
      
      currentAdmin = user;
      if (window.firebaseAuth?.currentUser) {
        currentToken = await window.firebaseAuth.currentUser.getIdToken(true);
      } else {
        currentToken = user.token;
      }
      
      var username = (user.email || '').split('@')[0].toLowerCase();
      
      try {
        var profileRes = await fetchAuth(API_BASE + '/profiles/' + encodeURIComponent(username));
        if (!profileRes.ok) {
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

function bindOnboarding() {
  var btn = document.getElementById('btn-onboarding-save');
  if (!btn) return;
  
  btn.addEventListener('click', async function() {
    var firstname = document.getElementById('ob-firstname').value.trim();
    var errEl = document.getElementById('onboarding-error');
    errEl.classList.add('hidden');
    
    if (!firstname) {
      errEl.textContent = 'Le prénom est obligatoire.';
      errEl.classList.remove('hidden');
      return;
    }
    
    var passions = (document.getElementById('ob-passions').value || '')
      .split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    
    var payload = {
      firstName: firstname,
      pseudo: document.getElementById('ob-pseudo').value.trim(),
      quote: document.getElementById('ob-quote').value.trim(),
      bio: document.getElementById('ob-bio').value.trim(),
      nationality: document.getElementById('ob-nationality').value.trim(),
      origin: document.getElementById('ob-origin').value.trim(),
      dreamCountry: document.getElementById('ob-dreamcountry').value.trim(),
      passions: passions,
      links: {},
    };
    
    btn.disabled = true; 
    btn.textContent = 'Création...';
    
    try {
      var res = await fetchAuth(API_BASE + '/profiles/me', {
        method: 'PUT', 
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      
      if (window.invalidateProfileCache && currentAdmin) {
        window.invalidateProfileCache(currentAdmin.uid);
      }
      
      document.getElementById('onboarding-screen').style.display = 'none';
      showDashboard(currentAdmin);
    } catch(e) {
      errEl.textContent = 'Erreur lors de la création du profil.';
      errEl.classList.remove('hidden');
    }
    
    btn.disabled = false; 
    btn.textContent = 'Créer mon profil →';
  });
}

function showDashboard(user) {
  document.getElementById('admin-dashboard').style.display = 'flex';
  document.getElementById('sidebar-username').textContent = user.name || 'Admin';
  document.getElementById('sidebar-email').textContent = user.email || '';
  loadPosts();
  loadStats();
  loadMyProfile();
}

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
  
  var shortcut = document.getElementById('btn-new-post-shortcut');
  if (shortcut) {
    shortcut.addEventListener('click', function() {
      switchSection('new-post'); 
      resetForm();
    });
  }
}

function switchSection(name) {
  document.querySelectorAll('.sidebar-link').forEach(function(b) {
    b.classList.toggle('active', b.dataset.section === name);
  });
  document.querySelectorAll('.admin-section').forEach(function(s) { s.classList.remove('active'); });
  var section = document.getElementById('section-' + name);
  if (section) section.classList.add('active');
}

async function loadPosts() {
  try {
    var res = await fetchAuth(API_BASE + '/posts?limit=100&sort=-publishedAt');
    var data = await res.json();
    allPosts = data.posts || [];
    renderTable(allPosts);
    populateAuthorFilter(allPosts);
  } catch(e) { 
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
    opt.value = a; 
    opt.textContent = a;
    select.appendChild(opt);
  });
}

function renderTable(posts) {
  var tbody = document.getElementById('posts-table-body');
  if (!tbody) return;
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
  var search = document.getElementById('search-posts');
  var filterCat = document.getElementById('filter-cat');
  var filterAuthor = document.getElementById('filter-author');
  if (search) search.addEventListener('input', filterTable);
  if (filterCat) filterCat.addEventListener('change', filterTable);
  if (filterAuthor) filterAuthor.addEventListener('change', filterTable);
}

function filterTable() {
  var q = document.getElementById('search-posts')?.value.toLowerCase() || '';
  var cat = document.getElementById('filter-cat')?.value || 'all';
  var author = document.getElementById('filter-author')?.value || 'all';
  
  renderTable(allPosts.filter(function(p) {
    return (cat === 'all' || p.category === cat) &&
           (author === 'all' || p.author === author) &&
           p.title.toLowerCase().includes(q);
  }));
}

function bindPostForm() {
  var summary = document.getElementById('post-summary');
  if (summary) {
    summary.addEventListener('input', function(e) {
      var countEl = document.getElementById('summary-count');
      if (countEl) countEl.textContent = e.target.value.length + '/300';
    });
  }
  
  var form = document.getElementById('post-form');
  if (form) form.addEventListener('submit', function(e) { e.preventDefault(); savePost(); });
  
  var cancelBtn = document.getElementById('btn-cancel-edit');
  if (cancelBtn) cancelBtn.addEventListener('click', function() { resetForm(); switchSection('posts'); });
  
  var previewBtn = document.getElementById('btn-preview');
  if (previewBtn) previewBtn.addEventListener('click', showPreview);
  
  document.querySelectorAll('.toolbar-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.execCommand(btn.dataset.cmd, false, null);
      var contentEditable = document.getElementById('post-content');
      if (contentEditable) contentEditable.focus();
    });
  });
}

function resetForm() {
  var editId = document.getElementById('edit-post-id');
  var title = document.getElementById('post-title');
  var category = document.getElementById('post-category');
  var summary = document.getElementById('post-summary');
  var content = document.getElementById('post-content');
  var summaryCount = document.getElementById('summary-count');
  var formTitle = document.getElementById('form-title');
  var submitBtn = document.getElementById('btn-submit-post');
  
  if (editId) editId.value = '';
  if (title) title.value = '';
  if (category) category.value = '';
  if (summary) summary.value = '';
  if (content) content.innerHTML = '';
  if (summaryCount) summaryCount.textContent = '0/300';
  if (formTitle) formTitle.textContent = 'Nouveau texte';
  if (submitBtn) submitBtn.textContent = 'Publier';
}

async function savePost() {
  var id = document.getElementById('edit-post-id')?.value;
  var title = document.getElementById('post-title')?.value.trim();
  var category = document.getElementById('post-category')?.value;
  var summary = document.getElementById('post-summary')?.value.trim();
  var content = document.getElementById('post-content')?.innerHTML.trim();
  var author = currentAdmin ? (currentAdmin.name || currentAdmin.email.split('@')[0]).split(' ')[0] : 'Narvalos';
  
  if (!title || !category || !summary || !content) {
    notify('Remplis tous les champs obligatoires.', 'error'); 
    return;
  }
  
  var payload = { title, author, category, summary, content, publishedAt: new Date().toISOString() };
  
  try {
    var res = await fetchAuth(id ? API_BASE + '/posts/' + id : API_BASE + '/posts',
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message);
    
    notify(id ? 'Texte modifie !' : 'Texte publie !', 'success');
    resetForm(); 
    loadPosts(); 
    switchSection('posts');
  } catch(err) { 
    notify(err.message, 'error'); 
  }
}

async function editPost(id) {
  var post = allPosts.find(function(p) { return p._id === id; });
  if (!post) return;
  
  try {
    var res = await fetchAuth(API_BASE + '/posts/' + id);
    var full = await res.json();
    post = full;
  } catch(e) {}
  
  var formTitle = document.getElementById('form-title');
  var submitBtn = document.getElementById('btn-submit-post');
  var editId = document.getElementById('edit-post-id');
  var title = document.getElementById('post-title');
  var category = document.getElementById('post-category');
  var summary = document.getElementById('post-summary');
  var summaryCount = document.getElementById('summary-count');
  var content = document.getElementById('post-content');
  
  if (formTitle) formTitle.textContent = 'Modifier le texte';
  if (submitBtn) submitBtn.textContent = 'Enregistrer';
  if (editId) editId.value = post._id;
  if (title) title.value = post.title;
  if (category) category.value = post.category;
  if (summary) summary.value = post.summary;
  if (summaryCount) summaryCount.textContent = post.summary.length + '/300';
  if (content) content.innerHTML = post.content || '';
  switchSection('new-post');
}

function promptDelete(id) {
  deleteTargetId = id;
  var modal = document.getElementById('delete-modal');
  if (modal) modal.classList.remove('hidden');
}

async function deletePost(id) {
  try {
    var res = await fetchAuth(API_BASE + '/posts/' + id, { method: 'DELETE' });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message);
    notify('Texte supprime.', 'success');
    loadPosts(); 
    loadStats();
  } catch(err) { 
    notify(err.message, 'error'); 
  }
}

async function loadMyProfile() {
  try {
    var username = currentAdmin ? (currentAdmin.email || '').split('@')[0].toLowerCase() : '';
    var res = await fetch(API_BASE + '/profiles/' + encodeURIComponent(username));
    if (!res.ok) return;
    fillProfileForm(await res.json());
  } catch(e) {}
}

function fillProfileForm(p) {
  var firstName = document.getElementById('prof-firstname');
  var pseudo = document.getElementById('prof-pseudo');
  var avatar = document.getElementById('prof-avatar');
  var quote = document.getElementById('prof-quote');
  var bio = document.getElementById('prof-bio');
  var nationality = document.getElementById('prof-nationality');
  var origin = document.getElementById('prof-origin');
  var dreamCountry = document.getElementById('prof-dreamcountry');
  var passions = document.getElementById('prof-passions');
  
  if (firstName) firstName.value = p.firstName || '';
  if (pseudo) pseudo.value = p.pseudo || '';
  if (avatar) avatar.value = p.avatar || '';
  if (quote) quote.value = p.quote || '';
  if (bio) bio.value = p.bio || '';
  if (nationality) nationality.value = p.nationality || '';
  if (origin) origin.value = p.origin || '';
  if (dreamCountry) dreamCountry.value = p.dreamCountry || '';
  if (passions) passions.value = (p.passions || []).join(', ');
  
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
        var avatarInput = document.getElementById('prof-avatar');
        if (avatarInput) avatarInput.value = reader.result;
        updatePreview();
      };
      reader.readAsDataURL(file);
    });
  }
  
  var profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async function(e) {
      e.preventDefault(); 
      await saveProfile();
    });
  }
}

function updatePreview() {
  var firstName = document.getElementById('prof-firstname')?.value || 'Ton prenom';
  var pseudo = document.getElementById('prof-pseudo')?.value || '';
  var quote = document.getElementById('prof-quote')?.value || 'Ta citation';
  var avatar = document.getElementById('prof-avatar')?.value || '';
  
  var previewName = document.getElementById('preview-name-display');
  var previewPseudo = document.getElementById('preview-pseudo-display');
  var previewQuote = document.getElementById('preview-quote-display');
  var previewAvatar = document.getElementById('preview-avatar-display');
  
  if (previewName) previewName.textContent = firstName;
  if (previewPseudo) previewPseudo.textContent = pseudo ? '@' + pseudo : '';
  if (previewQuote) previewQuote.textContent = quote;
  
  if (previewAvatar) {
    if (avatar) {
      previewAvatar.innerHTML = '<img src="' + avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />';
    } else {
      previewAvatar.textContent = firstName.charAt(0).toUpperCase();
    }
  }
}

async function saveProfile() {
  var passionsInput = document.getElementById('prof-passions');
  var passions = passionsInput ? passionsInput.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
  
  var payload = {
    firstName: document.getElementById('prof-firstname')?.value.trim() || '',
    pseudo: document.getElementById('prof-pseudo')?.value.trim() || '',
    avatar: document.getElementById('prof-avatar')?.value.trim() || '',
    quote: document.getElementById('prof-quote')?.value.trim() || '',
    bio: document.getElementById('prof-bio')?.value.trim() || '',
    nationality: document.getElementById('prof-nationality')?.value.trim() || '',
    origin: document.getElementById('prof-origin')?.value.trim() || '',
    dreamCountry: document.getElementById('prof-dreamcountry')?.value.trim() || '',
    passions: passions,
    links: {
      instagram: document.getElementById('link-instagram')?.value.trim() || '',
      spotify: document.getElementById('link-spotify')?.value.trim() || '',
      twitter: document.getElementById('link-twitter')?.value.trim() || '',
      youtube: document.getElementById('link-youtube')?.value.trim() || '',
      tiktok: document.getElementById('link-tiktok')?.value.trim() || '',
      other: document.getElementById('link-other')?.value.trim() || '',
    },
  };
  
  try {
    var res = await fetchAuth(API_BASE + '/profiles/me', { method: 'PUT', body: JSON.stringify(payload) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message);
    if (window.invalidateProfileCache && currentAdmin) window.invalidateProfileCache(currentAdmin.uid);
    notify('Profil sauvegarde !', 'success');
  } catch(err) { 
    notify(err.message, 'error'); 
  }
}

function bindPasswordChange() {
  var btn = document.getElementById('btn-change-password');
  if (!btn) return;
  
  btn.addEventListener('click', async function() {
    var current = document.getElementById('current-password')?.value || '';
    var newPass = document.getElementById('new-password')?.value || '';
    var errEl = document.getElementById('password-error');
    var sucEl = document.getElementById('password-success');
    
    if (errEl) errEl.classList.add('hidden'); 
    if (sucEl) sucEl.classList.add('hidden');
    
    if (!current || !newPass) { 
      if (errEl) {
        errEl.textContent = 'Remplis les deux champs.'; 
        errEl.classList.remove('hidden');
      }
      return; 
    }
    
    if (newPass.length < 6) { 
      if (errEl) {
        errEl.textContent = '6 caracteres minimum.'; 
        errEl.classList.remove('hidden');
      }
      return; 
    }
    
    var result = await window.changePassword(current, newPass);
    
    if (result.success) {
      if (sucEl) sucEl.classList.remove('hidden');
      var currentInput = document.getElementById('current-password');
      var newInput = document.getElementById('new-password');
      if (currentInput) currentInput.value = '';
      if (newInput) newInput.value = '';
    } else {
      if (errEl) {
        errEl.textContent = result.message;
        errEl.classList.remove('hidden');
      }
    }
  });
}

async function loadStats() {
  try {
    var res = await fetch(API_BASE + '/posts?limit=1000');
    var data = await res.json();
    var posts = data.posts || [];
    
    var c = function(cat) { return posts.filter(function(p) { return p.category === cat; }).length; };
    
    var statTotal = document.getElementById('stat-total');
    var statAnecdote = document.getElementById('stat-anecdote');
    var statPoeme = document.getElementById('stat-poeme');
    var statJournee = document.getElementById('stat-journee');
    var statAutre = document.getElementById('stat-autre');
    
    if (statTotal) statTotal.textContent = posts.length;
    if (statAnecdote) statAnecdote.textContent = c('anecdote');
    if (statPoeme) statPoeme.textContent = c('poeme');
    if (statJournee) statJournee.textContent = c('journee');
    if (statAutre) statAutre.textContent = c('autre');
    
    try {
      var resC = await fetch(API_BASE + '/stats');
      var dataC = await resC.json();
      
      var statComments = document.getElementById('stat-comments');
      var statMembers = document.getElementById('stat-members');
      var statOnline = document.getElementById('stat-online');
      
      if (statComments) statComments.textContent = dataC.totalComments || 0;
      if (statMembers) statMembers.textContent = dataC.totalMembers || '---';
      if (statOnline) statOnline.textContent = dataC.onlineNow || 0;
      
      var statReactFire = document.getElementById('stat-react-fire');
      var statReactLol = document.getElementById('stat-react-lol');
      var statReactHeart = document.getElementById('stat-react-heart');
      var statReactSad = document.getElementById('stat-react-sad');
      var statReactShock = document.getElementById('stat-react-shock');
      
      if (statReactFire) statReactFire.textContent = dataC.reactions ? dataC.reactions['🔥'] || 0 : '---';
      if (statReactLol) statReactLol.textContent = dataC.reactions ? dataC.reactions['😂'] || 0 : '---';
      if (statReactHeart) statReactHeart.textContent = dataC.reactions ? dataC.reactions['💜'] || 0 : '---';
      if (statReactSad) statReactSad.textContent = dataC.reactions ? dataC.reactions['🥺'] || 0 : '---';
      if (statReactShock) statReactShock.textContent = dataC.reactions ? dataC.reactions['🤯'] || 0 : '---';
    } catch(e) {}
    
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

function bindModals() {
  var cancelDelete = document.getElementById('cancel-delete');
  var confirmDelete = document.getElementById('confirm-delete');
  var modalOverlay = document.querySelector('#delete-modal .modal-overlay');
  var closePreview = document.getElementById('close-preview');
  var previewOverlay = document.querySelector('#preview-modal .modal-overlay');
  
  if (cancelDelete) {
    cancelDelete.addEventListener('click', function() {
      var modal = document.getElementById('delete-modal');
      if (modal) modal.classList.add('hidden');
    });
  }
  
  if (confirmDelete) {
    confirmDelete.addEventListener('click', async function() {
      var modal = document.getElementById('delete-modal');
      if (modal) modal.classList.add('hidden');
      if (deleteTargetId) { await deletePost(deleteTargetId); deleteTargetId = null; }
    });
  }
  
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function() {
      var modal = document.getElementById('delete-modal');
      if (modal) modal.classList.add('hidden');
    });
  }
  
  if (closePreview) {
    closePreview.addEventListener('click', function() {
      var modal = document.getElementById('preview-modal');
      if (modal) modal.classList.add('hidden');
    });
  }
  
  if (previewOverlay) {
    previewOverlay.addEventListener('click', function() {
      var modal = document.getElementById('preview-modal');
      if (modal) modal.classList.add('hidden');
    });
  }
}

function showPreview() {
  var title = document.getElementById('post-title')?.value || '(Sans titre)';
  var cat = document.getElementById('post-category')?.value || 'autre';
  var content = document.getElementById('post-content')?.innerHTML || '';
  var author = currentAdmin ? (currentAdmin.name || '').split(' ')[0] : '';
  
  var previewContent = document.getElementById('preview-content');
  if (previewContent) {
    previewContent.innerHTML =
      '<h1 style="font-family:var(--font-display);font-size:1.8rem;margin-bottom:12px">' + escapeHtml(title) + '</h1>' +
      '<p style="color:var(--text3);font-size:.85rem;margin-bottom:20px">--- ' + escapeHtml(author) + ' · ' + categoryLabel(cat) + '</p>' +
      '<hr style="border:none;border-top:1px solid var(--border);margin-bottom:20px"/>' +
      '<div style="font-size:1rem;line-height:1.8;color:var(--text2)">' + content + '</div>';
  }
  
  var modal = document.getElementById('preview-modal');
  if (modal) modal.classList.remove('hidden');
}

var notifTimeout;

function notify(msg, type) {
  type = type || 'info';
  var el = document.getElementById('notification');
  if (!el) return;
  el.textContent = msg;
  el.className = 'notification ' + type;
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
  var labels = { anecdote: 'Anecdote', poeme: 'Poeme', journee: 'Journee', autre: 'Autre' };
  return labels[cat] || cat;
}

function statusClass(p) { 
  return new Date(p.publishedAt) > new Date() ? 'status-scheduled' : 'status-published'; 
}

function statusLabel(p) { 
  return new Date(p.publishedAt) > new Date() ? 'Planifie' : 'Publie'; 
}

function formatDate(d) { 
  return d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '---'; 
}

function escapeHtml(s) { 
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); 
}
