/**
 * post.js — Page de détail + commentaires + réactions
 */

const API_BASE  = 'https://narvalo-blog.onrender.com/api';
const REACTIONS = ['🔥', '😂', '💜', '🥺', '🤯'];

let profiles    = {};
let currentUser = null;
let currentPost = null;
let userToken   = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  await loadProfiles();

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { showError('Aucun post spécifié.'); return; }

  // Auth
  const tryAuth = () => {
    if (!window.onUserAuthChange) { setTimeout(tryAuth, 100); return; }
    window.onUserAuthChange(async user => {
      currentUser = user;
      userToken   = user ? await window.firebaseAuth?.currentUser?.getIdToken() : null;
      updateHeaderUI(user);
      updateCommentForm(user);
      updateAdminVisibility(user);
    });
  };
  tryAuth();

  await fetchPost(id);

  document.getElementById('popup-overlay')?.addEventListener('click', hidePopup);
  setupLoginModal();
});

/* ── Nav ── */
function setupNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.querySelector('.main-nav');
  toggle?.addEventListener('click', () => nav.classList.toggle('open'));
}

/* ── Auth header ── */
function updateHeaderUI(user) {
  const signinBtn = document.getElementById('btn-signin');
  const userChip  = document.getElementById('user-chip');
  if (user) {
    signinBtn.classList.add('hidden');
    userChip.classList.remove('hidden');
    document.getElementById('user-chip-name').textContent = user.name?.split(' ')[0] || 'Toi';
    const avatarEl = document.getElementById('user-chip-avatar');
    if (user.avatar) { avatarEl.src = user.avatar; avatarEl.style.display = 'block'; }
    else avatarEl.style.display = 'none';
  } else {
    signinBtn.classList.remove('hidden');
    userChip.classList.add('hidden');
  }
  document.getElementById('btn-signin').onclick = () => openLoginModal();
  document.getElementById('btn-signout').onclick = async () => {
    await window.signOutGoogle?.();
  };
}

function updateAdminVisibility(user) {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = user?.isAdmin ? '' : 'none';
  });
}

/* ── Profiles ── */
async function loadProfiles() {
  try {
    const res  = await fetch(`${API_BASE}/profiles`);
    const data = await res.json();
    data.forEach(p => { profiles[p.username] = p; });
  } catch { }
}

/* ── Post ── */
async function fetchPost(id) {
  try {
    const res  = await fetch(`${API_BASE}/posts/${id}`);
    if (!res.ok) throw new Error();
    currentPost = await res.json();
    renderPost(currentPost);
    renderReactions(currentPost._id);
    fetchComments(currentPost._id);
    fetchSuggestions(currentPost.category, currentPost._id);
    document.title = `${currentPost.title} — Les Narvalos`;
  } catch { showError('Ce texte est introuvable.'); }
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
        <span class="post-category-badge badge-${post.category}">${categoryLabel(post.category)}</span>
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
      <a href="index.html" class="post-back-link">← Retour à l'accueil</a>
    </div>
  `;

  container.querySelectorAll('[data-username]').forEach(el => {
    el.addEventListener('click', e => {
      const u = el.dataset.username;
      if (u) showProfilePopup(u, e);
    });
  });

  document.getElementById('reactions-section').style.display = 'block';
  document.getElementById('comments-section').style.display  = 'block';
}

/* ── Réactions ── */
function renderReactions(postId) {
  const bar = document.getElementById('reactions-bar');
  bar.innerHTML = '';

  const saved = getSavedReactions(postId);

  REACTIONS.forEach(emoji => {
    const reacted = saved[emoji] || false;
    const btn     = document.createElement('button');
    btn.className = `reaction-bubble ${reacted ? 'reacted' : ''}`;
    btn.dataset.emoji  = emoji;
    btn.dataset.postid = postId;
    btn.innerHTML = `${emoji}${reacted ? ' <span>1</span>' : ''}`;
    btn.addEventListener('click', () => {
      if (!currentUser) { openLoginModal(); return; }
      handleReaction(btn, postId);
    });
    bar.appendChild(btn);
  });
}

function getSavedReactions(postId) {
  if (!currentUser) return {};
  try { return JSON.parse(localStorage.getItem(`reactions_${currentUser.uid}_${postId}`) || '{}'); }
  catch { return {}; }
}

function handleReaction(btn, postId) {
  const emoji  = btn.dataset.emoji;
  const key    = `reactions_${currentUser.uid}_${postId}`;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch { saved = {}; }
  saved[emoji] = !saved[emoji];
  localStorage.setItem(key, JSON.stringify(saved));
  btn.classList.toggle('reacted', saved[emoji]);
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => btn.style.transform = '', 200);
  const countEl = btn.querySelector('span');
  if (saved[emoji]) {
    if (countEl) countEl.textContent = (parseInt(countEl.textContent)||0) + 1;
    else btn.innerHTML = `${emoji} <span>1</span>`;
  } else {
    if (countEl) { const n = parseInt(countEl.textContent)-1; if(n<=0) countEl.remove(); else countEl.textContent=n; }
  }
}

/* ── Commentaires ── */
async function fetchComments(postId) {
  try {
    const res      = await fetch(`${API_BASE}/comments/${postId}`);
    const comments = await res.json();
    renderComments(comments, postId);
  } catch {
    document.getElementById('comments-list').innerHTML = '<p style="color:var(--text3)">Impossible de charger les commentaires.</p>';
  }
}

function renderComments(comments, postId) {
  const list = document.getElementById('comments-list');
  document.getElementById('comments-count').textContent = comments.length ? `(${comments.length})` : '';

  if (!comments.length) {
    list.innerHTML = '<p class="no-comments">Aucun commentaire pour l\'instant. Sois le premier ! 👇</p>';
    return;
  }

  list.innerHTML = '';
  comments.forEach(c => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.id = c._id;

    const isAdmin = currentUser?.isAdmin;
    const isOwn   = currentUser?.uid === c.uid;
    const initial = (c.author || '?').charAt(0).toUpperCase();
    const date    = formatDateShort(c.createdAt);

    div.innerHTML = `
      <div class="comment-avatar">${initial}</div>
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${escapeHtml(c.author)}</span>
          <span class="comment-date">${date}</span>
          ${isAdmin || isOwn ? `<button class="comment-delete" data-id="${c._id}">🗑️</button>` : ''}
        </div>
        <p class="comment-text">${escapeHtml(c.content)}</p>
      </div>
    `;

    list.appendChild(div);
  });

  // Bind delete buttons
  list.querySelectorAll('.comment-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteComment(btn.dataset.id, postId));
  });
}

async function deleteComment(commentId, postId) {
  if (!currentUser?.isAdmin && !confirm('Supprimer ce commentaire ?')) return;
  try {
    const token = await window.firebaseAuth?.currentUser?.getIdToken(true);
    const res   = await fetch(`${API_BASE}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) fetchComments(postId);
  } catch { }
}

function updateCommentForm(user) {
  const connected = document.getElementById('comment-form-connected');
  const prompt    = document.getElementById('comment-login-prompt');

  if (user) {
    connected.classList.remove('hidden');
    prompt.style.display = 'none';

    // Avatar
    const avatarEl = document.getElementById('comment-form-avatar');
    if (user.avatar) {
      avatarEl.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
    } else {
      avatarEl.textContent = (user.name || '?').charAt(0).toUpperCase();
    }

    // Bind submit
    const input    = document.getElementById('comment-input');
    const countEl  = document.getElementById('comment-char-count');
    const submitBtn = document.getElementById('btn-comment-submit');

    input.addEventListener('input', () => {
      countEl.textContent = `${input.value.length}/1000`;
    });

    submitBtn.onclick = async () => {
      const content = input.value.trim();
      if (!content) return;

      submitBtn.disabled = true;
      submitBtn.textContent = '⏳...';

      try {
        const token = await window.firebaseAuth?.currentUser?.getIdToken(true);
        const res   = await fetch(`${API_BASE}/comments/${currentPost._id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        });

        if (res.ok) {
          input.value = '';
          countEl.textContent = '0/1000';
          fetchComments(currentPost._id);
        } else {
          const data = await res.json();
          alert(data.message || 'Erreur.');
        }
      } catch { alert('Erreur lors de l\'envoi.'); }

      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer 💬';
    };
  } else {
    connected.classList.add('hidden');
    prompt.style.display = 'block';
    document.getElementById('comment-login-link').onclick = e => {
      e.preventDefault();
      openLoginModal();
    };
  }
}

/* ── Login Modal ── */
function setupLoginModal() {
  document.getElementById('login-modal-overlay').addEventListener('click', closeLoginModal);
  document.getElementById('close-login-modal').addEventListener('click', closeLoginModal);

  // Tabs
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('modal-tab-login').style.display  = tab.dataset.tab === 'login'  ? 'block' : 'none';
      document.getElementById('modal-tab-signup').style.display = tab.dataset.tab === 'signup' ? 'block' : 'none';
    });
  });

  // Google
  document.getElementById('modal-btn-google').addEventListener('click', async () => {
    const result = await window.signInWithGoogle?.();
    if (result?.success) closeLoginModal();
    else showModalError(result?.message || 'Erreur.');
  });

  // Login email
  document.getElementById('modal-btn-login').addEventListener('click', async () => {
    const email    = document.getElementById('modal-email').value.trim();
    const password = document.getElementById('modal-password').value;
    if (!email || !password) { showModalError('Remplis tous les champs.'); return; }
    const result = await window.signInWithEmail?.(email, password);
    if (result?.success) closeLoginModal();
    else showModalError(result?.message || 'Erreur.');
  });

  // Signup email
  document.getElementById('modal-btn-signup').addEventListener('click', async () => {
    const name     = document.getElementById('modal-signup-name').value.trim();
    const email    = document.getElementById('modal-signup-email').value.trim();
    const password = document.getElementById('modal-signup-password').value;
    if (!name || !email || !password) { showModalError('Remplis tous les champs.'); return; }
    const result = await window.signUpWithEmail?.(email, password);
    if (result?.success) {
      // Mettre à jour le displayName Firebase (simplifié)
      closeLoginModal();
    } else showModalError(result?.message || 'Erreur.');
  });
}

function openLoginModal() {
  document.getElementById('login-modal').classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('login-modal').classList.add('hidden');
  document.getElementById('modal-login-error').classList.add('hidden');
}

function showModalError(msg) {
  const el = document.getElementById('modal-login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* ── Suggestions ── */
async function fetchSuggestions(category, excludeId) {
  try {
    const res    = await fetch(`${API_BASE}/posts?category=${category}&limit=4&sort=-publishedAt`);
    const data   = await res.json();
    const others = (data.posts||[]).filter(p => p._id !== excludeId).slice(0,3);
    if (!others.length) { document.getElementById('suggestions').style.display='none'; return; }
    const grid = document.getElementById('suggestions-grid');
    others.forEach((post,i) => grid.appendChild(buildMiniCard(post,i)));
  } catch { document.getElementById('suggestions').style.display='none'; }
}

function buildMiniCard(post, index) {
  const article = document.createElement('article');
  article.className = 'post-card';
  article.style.animationDelay = `${index*0.1}s`;
  const profile = findProfileByName(post.author);
  const avatarHTML = profile?.avatar
    ? `<img class="card-author-avatar" src="${profile.avatar}" alt="${post.author}" />`
    : `<div class="card-author-placeholder">${post.author.charAt(0).toUpperCase()}</div>`;
  article.innerHTML = `
    <div class="card-top">
      <div class="card-meta">
        <span class="category-badge badge-${post.category}">${categoryLabel(post.category)}</span>
        <span class="card-date">${formatDate(post.publishedAt)}</span>
      </div>
      <h3 class="card-title">${escapeHtml(post.title)}</h3>
      <p class="card-summary">${escapeHtml(post.summary)}</p>
    </div>
    <div class="card-footer">
      <div class="card-author-row">${avatarHTML}<span class="card-author-name">${escapeHtml(post.author)}</span></div>
      <a href="post.html?id=${post._id}" class="btn-read">Lire →</a>
    </div>
  `;
  return article;
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
  if (profile.nationality)  tags.push(`🌍 ${profile.nationality}`);
  if (profile.dreamCountry) tags.push(`✈️ ${profile.dreamCountry}`);
  (profile.passions||[]).slice(0,3).forEach(p => tags.push(p));
  tags.forEach(t => {
    const span = document.createElement('span');
    span.className = 'popup-tag'; span.textContent = t;
    tagsEl.appendChild(span);
  });
  document.getElementById('popup-profile-link').href = `auteurs.html?user=${username}`;
  const el   = event.target.closest('[data-username]') || event.target;
  const rect = el.getBoundingClientRect();
  let left = rect.left + rect.width/2 - 145;
  let top  = rect.bottom + 8 + window.scrollY;
  left = Math.max(8, Math.min(left, window.innerWidth - 298));
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
function showError(msg) {
  document.getElementById('post-content').innerHTML = `
    <div class="container" style="padding:80px 24px;text-align:center;color:var(--text2)">
      <p style="font-size:1.1rem">${msg}</p>
      <a href="index.html" class="post-back-link" style="display:inline-block;margin-top:20px">← Retour</a>
    </div>`;
}

function findProfileByName(name) {
  return Object.values(profiles).find(p => p.firstName === name || p.username === name) || null;
}
function categoryLabel(cat) {
  return { anecdote:'😂 Anecdote', poeme:'🌙 Poème', journee:'☀️ Journée', autre:'✨ Autre' }[cat] || cat;
}
function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '';
}
function formatDateShort(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}
function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
