/**
 * post.js — Page détail
 * Réactions libres (emoji picker) + commentaires TikTok + likes + réponses + WebSocket
 */

const API_BASE = 'https://narvalo-blog.onrender.com/api';
const WS_URL   = 'https://narvalo-blog.onrender.com';

// Catégories d'emojis
const EMOJI_CATEGORIES = {
  '😊 Émotion': ['😂','🥹','😭','🥺','😍','🤩','😎','🤯','😱','🤔','😴','🫡','🥶','🥵','😤','🤬','😈','💀','🫠','🤣','😅','😆','😋','😏','🥰','😘','🫦','😬','🙄','🤮'],
  '👍 Gestes': ['👍','👎','❤️','🔥','💯','✅','❌','⭐','💫','🎉','🎊','🏆','💪','🫶','🙌','👏','🤝','🫂','💋','🤜'],
  '🌈 Symboles': ['💜','💙','❤️','🧡','💛','💚','🖤','🤍','💔','♾️','☮️','✨','🌟','⚡','🌈','🎭','🎨','🎬','🎵','🎶'],
  '🐾 Nature': ['🌸','🌺','🌻','🌹','🍀','🌿','🍃','🦋','🐉','🦊','🐺','🦁','🐧','🦄','🌊','🔥','⭐','🌙','☀️','🌍'],
  '🍕 Nourriture': ['🍕','🍔','🍟','🌮','🍜','🍣','🍩','🍰','🎂','🍫','☕','🧋','🥤','🍺','🥂','🍾','🥞','🧇','🍓','🍇'],
};

let currentUser  = null;
let currentPost  = null;
let profiles     = {};
let socket       = null;
let viewCounted  = false;

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
      updateHeaderUI(user);
      updateCommentForm(user);
      updateAdminVisibility(user);
    });
  };
  tryAuth();

  await fetchPost(id);
  initWebSocket(id);

  document.getElementById('popup-overlay')?.addEventListener('click', hidePopup);
  setupLoginModal();
});

/* ── WebSocket ── */
function initWebSocket(postId) {
  const script = document.createElement('script');
  script.src   = WS_URL + '/socket.io/socket.io.js';
  script.onload = () => {
    socket = io(WS_URL);
    socket.emit('join_post', postId);

    // Nouveau commentaire en temps réel
    socket.on('comment_added', comment => {
      appendComment(comment, postId);
      updateCommentCount(1);
    });

    // Like commentaire en temps réel
    socket.on('comment_liked', data => {
      const btn = document.querySelector('[data-like-id="' + data.commentId + '"]');
      if (btn) {
        btn.querySelector('.like-count').textContent = data.likes;
        if (data.uid !== currentUser?.uid) {
          btn.classList.toggle('liked', false);
        }
      }
    });

    // Réponse en temps réel
    socket.on('reply_added', data => {
      const repliesEl = document.getElementById('replies-' + data.commentId);
      if (repliesEl && repliesEl.style.display !== 'none') {
        appendReply(data.reply, data.commentId);
      }
    });

    // Réactions en temps réel
    socket.on('reaction_update', data => {
      if (data.postId === currentPost?._id) {
        renderReactions(currentPost._id, data.reactions);
      }
    });

    // Vues en temps réel
    socket.on('view_update', data => {
      const el = document.getElementById('post-views');
      if (el) el.textContent = data.views + ' vues';
    });
  };
  document.head.appendChild(script);
}

/* ── Nav ── */
function setupNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.querySelector('.main-nav');
  toggle?.addEventListener('click', () => nav?.classList.toggle('open'));
}

/* ── Auth ── */
function updateHeaderUI(user) {
  const signinBtn = document.getElementById('btn-signin');
  const userChip  = document.getElementById('user-chip');
  if (user) {
    signinBtn?.classList.add('hidden');
    userChip?.classList.remove('hidden');
    document.getElementById('user-chip-name').textContent = user.name?.split(' ')[0] || 'Toi';
    const av = document.getElementById('user-chip-avatar');
    if (user.avatar) { av.src = user.avatar; av.style.display = 'block'; }
    else av.style.display = 'none';
  } else {
    signinBtn?.classList.remove('hidden');
    userChip?.classList.add('hidden');
  }
  document.getElementById('btn-signin')?.addEventListener('click', openLoginModal);
  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await window.signOutGoogle?.();
  });
}

function updateAdminVisibility(user) {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = user?.isAdmin ? '' : 'none';
  });
}

/* ── Profiles ── */
async function loadProfiles() {
  try {
    const res  = await fetch(API_BASE + '/profiles');
    const data = await res.json();
    data.forEach(p => { profiles[p.username] = p; });
  } catch {}
}

/* ── Post ── */
async function fetchPost(id) {
  try {
    const res = await fetch(API_BASE + '/posts/' + id);
    if (!res.ok) throw new Error();
    currentPost = await res.json();
    renderPost(currentPost);

    // Incrémenter la vue (une seule fois par session)
    const viewKey = 'viewed_' + id;
    if (!sessionStorage.getItem(viewKey)) {
      sessionStorage.setItem(viewKey, '1');
      fetch(API_BASE + '/posts/' + id + '/view', { method: 'POST' }).catch(() => {});
    }

    // Réactions depuis le serveur
    const reactionsObj = {};
    if (currentPost.reactions) {
      Object.entries(currentPost.reactions).forEach(([k,v]) => { reactionsObj[k] = v; });
    }
    renderReactions(currentPost._id, reactionsObj);
    fetchComments(currentPost._id);
    fetchSuggestions(currentPost.category, currentPost._id);
    document.title = currentPost.title + ' — Les Narvalos';
  } catch { showError('Ce texte est introuvable.'); }
}

function renderPost(post) {
  const container = document.getElementById('post-content');
  const profile   = findProfileByName(post.author);
  const date      = formatDate(post.publishedAt);

  const avatarHTML = profile?.avatar
    ? '<img class="byline-avatar" src="' + profile.avatar + '" alt="' + post.author + '" data-username="' + profile.username + '" />'
    : '<div class="byline-avatar-placeholder" data-username="' + (profile?.username||'') + '">' + post.author.charAt(0).toUpperCase() + '</div>';

  container.innerHTML = `
    <div class="container">
      <div class="post-hero-meta">
        <span class="post-category-badge badge-${post.category}">${categoryLabel(post.category)}</span>
        <h1 class="post-title">${escapeHtml(post.title)}</h1>
        <div class="post-byline">
          ${avatarHTML}
          <div class="byline-info">
            <span class="byline-name" data-username="${profile?.username||''}">${escapeHtml(post.author)}</span>
            <span class="byline-date">${date} · <span id="post-views">${post.views||0} vues</span></span>
          </div>
        </div>
      </div>
      <div class="post-divider"></div>
      <div class="post-body ${post.category === 'poeme' ? 'poeme' : ''}">${post.content}</div>
      <a href="index.html" class="post-back-link">← Retour à l'accueil</a>
    </div>
  `;

  container.querySelectorAll('[data-username]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', e => {
      const u = el.dataset.username;
      if (u) showProfilePopup(u, e);
    });
  });

  document.getElementById('reactions-section').style.display = 'block';
  document.getElementById('comments-section').style.display  = 'block';
}

/* ── Réactions libres ── */
function renderReactions(postId, reactionsData) {
  const bar = document.getElementById('reactions-bar');
  if (!bar) return;

  // Garder le picker s'il existe
  const pickerWrap = bar.querySelector('.emoji-picker-wrap');

  bar.innerHTML = '';

  // Afficher les réactions existantes
  const hasReactions = reactionsData && Object.keys(reactionsData).some(k => reactionsData[k] > 0);

  if (hasReactions) {
    Object.entries(reactionsData).forEach(([emoji, count]) => {
      if (!count || count <= 0) return;
      const uid     = currentUser?.uid;
      const reacted = uid ? (currentPost?.reactors?.[uid + '_' + emoji] || false) : false;

      const btn = document.createElement('button');
      btn.className = 'reaction-bubble' + (reacted ? ' reacted' : '');
      btn.innerHTML = emoji + ' <span>' + count + '</span>';
      btn.addEventListener('click', () => handleReaction(emoji, postId));
      bar.appendChild(btn);
    });
  }

  // Bouton + pour ouvrir le picker
  const addWrap = document.createElement('div');
  addWrap.className = 'emoji-picker-wrap';
  addWrap.innerHTML = '<button class="btn-add-reaction" title="Réagir">+</button>';

  const picker = buildEmojiPicker(postId);
  addWrap.appendChild(picker);

  addWrap.querySelector('.btn-add-reaction').addEventListener('click', e => {
    e.stopPropagation();
    picker.classList.toggle('open');
  });

  document.addEventListener('click', e => {
    if (!addWrap.contains(e.target)) picker.classList.remove('open');
  }, { once: false });

  bar.appendChild(addWrap);
}

function buildEmojiPicker(postId) {
  const picker = document.createElement('div');
  picker.className = 'emoji-picker';

  // Barre de recherche
  const search = document.createElement('input');
  search.className   = 'emoji-picker-search';
  search.placeholder = 'Rechercher un emoji...';
  picker.appendChild(search);

  // Catégories
  const catBar = document.createElement('div');
  catBar.className = 'emoji-categories';
  const grid    = document.createElement('div');
  grid.className = 'emoji-grid';

  const cats = Object.keys(EMOJI_CATEGORIES);
  let activecat = cats[0];

  function showCat(cat) {
    activecat = cat;
    catBar.querySelectorAll('.emoji-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    renderGrid(EMOJI_CATEGORIES[cat]);
  }

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className      = 'emoji-cat-btn' + (cat === activecat ? ' active' : '');
    btn.dataset.cat    = cat;
    btn.textContent    = cat.split(' ')[0];
    btn.title          = cat;
    btn.addEventListener('click', () => showCat(cat));
    catBar.appendChild(btn);
  });

  function renderGrid(emojis) {
    grid.innerHTML = '';
    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className   = 'emoji-btn';
      btn.textContent = emoji;
      btn.title       = emoji;
      btn.addEventListener('click', () => {
        if (!currentUser) { openLoginModal(); return; }
        handleReaction(emoji, postId);
        picker.classList.remove('open');
      });
      grid.appendChild(btn);
    });
  }

  search.addEventListener('input', e => {
    const q = e.target.value.trim();
    if (!q) { renderGrid(EMOJI_CATEGORIES[activecat]); return; }
    const all = Object.values(EMOJI_CATEGORIES).flat();
    renderGrid(all.filter(em => em.includes(q)));
  });

  picker.appendChild(catBar);
  renderGrid(EMOJI_CATEGORIES[activecat]);
  picker.appendChild(grid);

  return picker;
}

async function handleReaction(emoji, postId) {
  if (!currentUser) { openLoginModal(); return; }

  try {
    const res  = await fetch(API_BASE + '/posts/' + postId + '/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji, uid: currentUser.uid }),
    });
    const data = await res.json();
    if (res.ok) {
      // Mettre à jour localement le post
      if (!currentPost.reactions) currentPost.reactions = {};
      currentPost.reactions = data.reactions;
      renderReactions(postId, data.reactions);
    }
  } catch {}
}

/* ── Commentaires ── */
async function fetchComments(postId) {
  try {
    const res      = await fetch(API_BASE + '/comments/' + postId);
    const comments = await res.json();
    const list     = document.getElementById('comments-list');
    list.innerHTML = '';
    if (!comments.length) {
      list.innerHTML = '<p class="no-comments">Aucun commentaire — sois le premier ! 👇</p>';
      updateCommentCount(0);
      return;
    }
    comments.forEach(c => appendComment(c, postId, false));
    updateCommentCount(comments.length);
  } catch {
    document.getElementById('comments-list').innerHTML = '<p class="no-comments">Impossible de charger les commentaires.</p>';
  }
}

function updateCommentCount(delta) {
  const el = document.getElementById('comments-count');
  if (!el) return;
  const current = parseInt(el.textContent.replace(/\D/g,'')) || 0;
  const newCount = delta === 0 ? 0 : current + delta;
  el.textContent = newCount > 0 ? '(' + newCount + ')' : '';
}

function appendComment(c, postId, animate = true) {
  const list = document.getElementById('comments-list');
  const noEl = list.querySelector('.no-comments');
  if (noEl) noEl.remove();

  const div     = document.createElement('div');
  div.className = 'comment-item' + (animate ? '' : '');
  div.dataset.id = c._id;

  const isAdmin = currentUser?.isAdmin;
  const isOwn   = currentUser?.uid === c.uid;
  const initial = (c.author || '?').charAt(0).toUpperCase();
  const date    = formatDateShort(c.createdAt);
  const liked   = currentUser ? (c.likedBy || []).includes(currentUser.uid) : false;

  div.innerHTML = `
    <div class="comment-avatar">${initial}</div>
    <div class="comment-body">
      <div class="comment-header">
        <span class="comment-author">${escapeHtml(c.author)}</span>
        <span class="comment-date">${date}</span>
        ${isAdmin || isOwn ? '<button class="comment-delete-btn" data-id="' + c._id + '">🗑️</button>' : ''}
      </div>
      <p class="comment-text">${escapeHtml(c.content)}</p>
      <div class="comment-actions">
        <button class="comment-action-btn ${liked ? 'liked' : ''}" data-like-id="${c._id}">
          <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span class="like-count">${c.likes || 0}</span>
        </button>
        <button class="comment-action-btn btn-reply-toggle" data-comment-id="${c._id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          ${(c.replies || []).length > 0 ? '<span>' + c.replies.length + '</span>' : 'Répondre'}
        </button>
      </div>

      <!-- Réponses -->
      <div class="comment-replies" id="replies-${c._id}" style="display:none">
        ${(c.replies || []).map(r => buildReplyHTML(r)).join('')}
        <div class="reply-form" id="reply-form-${c._id}">
          <input type="text" placeholder="Ta réponse..." maxlength="500" id="reply-input-${c._id}" />
          <button class="btn-reply-submit" data-comment-id="${c._id}">↩</button>
        </div>
      </div>
    </div>
  `;

  list.appendChild(div);

  // Bind like
  div.querySelector('[data-like-id]')?.addEventListener('click', () => handleLike(c._id, postId));

  // Bind reply toggle
  div.querySelector('.btn-reply-toggle')?.addEventListener('click', () => {
    const repliesEl  = document.getElementById('replies-' + c._id);
    const replyForm  = document.getElementById('reply-form-' + c._id);
    const isOpen     = repliesEl.style.display !== 'none';
    repliesEl.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      replyForm.classList.add('open');
      document.getElementById('reply-input-' + c._id)?.focus();
    }
  });

  // Bind reply submit
  div.querySelector('.btn-reply-submit')?.addEventListener('click', () => submitReply(c._id, postId));
  div.querySelector('#reply-input-' + c._id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitReply(c._id, postId);
  });

  // Bind delete
  div.querySelector('.comment-delete-btn')?.addEventListener('click', () => deleteComment(c._id, postId));
}

function buildReplyHTML(r) {
  const initial = (r.author || '?').charAt(0).toUpperCase();
  const date    = formatDateShort(r.createdAt);
  return `
    <div class="reply-item">
      <div class="reply-avatar">${initial}</div>
      <div class="reply-body">
        <div class="reply-author">${escapeHtml(r.author)} <span style="font-size:.68rem;color:var(--text3);font-weight:400">${date}</span></div>
        <div class="reply-text">${escapeHtml(r.content)}</div>
      </div>
    </div>
  `;
}

function appendReply(reply, commentId) {
  const repliesEl = document.getElementById('replies-' + commentId);
  if (!repliesEl) return;
  const form = document.getElementById('reply-form-' + commentId);
  const div  = document.createElement('div');
  div.innerHTML = buildReplyHTML(reply);
  repliesEl.insertBefore(div.firstElementChild, form);
}

async function handleLike(commentId, postId) {
  if (!currentUser) { openLoginModal(); return; }
  try {
    const token = await window.firebaseAuth?.currentUser?.getIdToken();
    const res   = await fetch(API_BASE + '/comments/' + commentId + '/like', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    const data = await res.json();
    if (res.ok) {
      const btn = document.querySelector('[data-like-id="' + commentId + '"]');
      if (btn) {
        btn.querySelector('.like-count').textContent = data.likes;
        btn.classList.toggle('liked', data.liked);
        const path = btn.querySelector('path');
        if (path) path.setAttribute('fill', data.liked ? 'currentColor' : 'none');
      }
    }
  } catch {}
}

async function submitReply(commentId, postId) {
  if (!currentUser) { openLoginModal(); return; }
  const input = document.getElementById('reply-input-' + commentId);
  const content = input?.value.trim();
  if (!content) return;

  try {
    const token = await window.firebaseAuth?.currentUser?.getIdToken();
    const res   = await fetch(API_BASE + '/comments/' + commentId + '/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const reply     = await res.json();
      const repliesEl = document.getElementById('replies-' + commentId);
      repliesEl.style.display = 'block';
      appendReply(reply, commentId);
      input.value = '';
    }
  } catch {}
}

async function deleteComment(commentId, postId) {
  if (!confirm('Supprimer ce commentaire ?')) return;
  try {
    const token = await window.firebaseAuth?.currentUser?.getIdToken(true);
    const res   = await fetch(API_BASE + '/comments/' + commentId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (res.ok) {
      document.querySelector('[data-id="' + commentId + '"]')?.remove();
      updateCommentCount(-1);
    }
  } catch {}
}

function updateCommentForm(user) {
  const connected = document.getElementById('comment-form-connected');
  const prompt    = document.getElementById('comment-login-prompt');

  if (user) {
    connected?.classList.remove('hidden');
    if (prompt) prompt.style.display = 'none';

    const avatarEl = document.getElementById('comment-form-avatar');
    if (avatarEl) {
      if (user.avatar) avatarEl.innerHTML = '<img src="' + user.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />';
      else avatarEl.textContent = (user.name || '?').charAt(0).toUpperCase();
    }

    const input    = document.getElementById('comment-input');
    const countEl  = document.getElementById('comment-char-count');
    const submitBtn = document.getElementById('btn-comment-submit');

    if (input) {
      input.addEventListener('input', () => {
        if (countEl) countEl.textContent = input.value.length + '/1000';
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
    }

    if (submitBtn) {
      submitBtn.onclick = async () => {
        const content = input?.value.trim();
        if (!content || !currentPost) return;
        submitBtn.disabled = true; submitBtn.textContent = '...';
        try {
          const token = await window.firebaseAuth?.currentUser?.getIdToken(true);
          const res   = await fetch(API_BASE + '/comments/' + currentPost._id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ content }),
          });
          if (res.ok) {
            if (input) { input.value = ''; input.style.height = 'auto'; }
            if (countEl) countEl.textContent = '0/1000';
          } else {
            const d = await res.json();
            alert(d.message || 'Erreur.');
          }
        } catch { alert('Erreur réseau.'); }
        submitBtn.disabled = false; submitBtn.textContent = 'Envoyer';
      };
    }
  } else {
    connected?.classList.add('hidden');
    if (prompt) prompt.style.display = 'block';
    document.getElementById('comment-login-link')?.addEventListener('click', e => {
      e.preventDefault(); openLoginModal();
    });
  }
}

/* ── Login Modal ── */
function setupLoginModal() {
  document.getElementById('login-modal-overlay')?.addEventListener('click', closeLoginModal);
  document.getElementById('close-login-modal')?.addEventListener('click', closeLoginModal);

  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const lTab = document.getElementById('modal-tab-login');
      const sTab = document.getElementById('modal-tab-signup');
      if (lTab) lTab.style.display = tab.dataset.tab === 'login' ? 'block' : 'none';
      if (sTab) sTab.style.display = tab.dataset.tab === 'signup' ? 'block' : 'none';
    });
  });

  document.getElementById('modal-btn-login')?.addEventListener('click', async () => {
    const email = document.getElementById('modal-email')?.value.trim();
    const pass  = document.getElementById('modal-password')?.value;
    if (!email || !pass) { showModalError('Remplis tous les champs.'); return; }
    const result = await window.signInWithEmail?.(email, pass);
    if (result?.success) closeLoginModal();
    else showModalError(result?.message || 'Erreur.');
  });

  document.getElementById('modal-btn-signup')?.addEventListener('click', async () => {
    const name  = document.getElementById('modal-signup-name')?.value.trim();
    const email = document.getElementById('modal-signup-email')?.value.trim();
    const pass  = document.getElementById('modal-signup-password')?.value;
    if (!name || !email || !pass) { showModalError('Remplis tous les champs.'); return; }
    const result = await window.signUpWithEmail?.(email, pass, name);
    if (result?.success) closeLoginModal();
    else showModalError(result?.message || 'Erreur.');
  });
}

function openLoginModal()  { document.getElementById('login-modal')?.classList.remove('hidden'); }
function closeLoginModal() {
  document.getElementById('login-modal')?.classList.add('hidden');
  document.getElementById('modal-login-error')?.classList.add('hidden');
}
function showModalError(msg) {
  const el = document.getElementById('modal-login-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

/* ── Suggestions ── */
async function fetchSuggestions(category, excludeId) {
  try {
    const res    = await fetch(API_BASE + '/posts?category=' + category + '&limit=4&sort=-publishedAt');
    const data   = await res.json();
    const others = (data.posts||[]).filter(p => p._id !== excludeId).slice(0,3);
    if (!others.length) { document.getElementById('suggestions').style.display = 'none'; return; }
    const grid = document.getElementById('suggestions-grid');
    others.forEach((p,i) => grid.appendChild(buildMiniCard(p,i)));
  } catch { document.getElementById('suggestions').style.display = 'none'; }
}

function buildMiniCard(post, index) {
  const article = document.createElement('article');
  article.className = 'post-card';
  article.style.animationDelay = (index*0.1) + 's';
  const profile    = findProfileByName(post.author);
  const avatarHTML = profile?.avatar
    ? '<img class="card-author-avatar" src="' + profile.avatar + '" alt="' + post.author + '" />'
    : '<div class="card-author-placeholder">' + post.author.charAt(0).toUpperCase() + '</div>';
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
  if (!popup) return;
  const name    = profile.firstName || profile.username;
  const avatarEl = document.getElementById('popup-avatar');
  if (profile.avatar) { avatarEl.src = profile.avatar; avatarEl.style.display = 'block'; }
  else avatarEl.style.display = 'none';
  document.getElementById('popup-name').textContent   = name;
  document.getElementById('popup-pseudo').textContent = profile.pseudo ? '@' + profile.pseudo : '';
  document.getElementById('popup-quote').textContent  = profile.quote || '';
  const tagsEl = document.getElementById('popup-tags');
  if (tagsEl) {
    tagsEl.innerHTML = '';
    const tags = [];
    if (profile.nationality)  tags.push('🌍 ' + profile.nationality);
    if (profile.origin)       tags.push('🏠 ' + profile.origin);
    if (profile.dreamCountry) tags.push('✈️ ' + profile.dreamCountry);
    (profile.passions||[]).slice(0,2).forEach(p => tags.push(p));
    tags.forEach(t => {
      const span = document.createElement('span');
      span.className = 'popup-tag'; span.textContent = t;
      tagsEl.appendChild(span);
    });
  }
  const linkEl = document.getElementById('popup-profile-link');
  if (linkEl) linkEl.href = 'auteurs.html?user=' + username;
  const el   = event.target.closest('[data-username]') || event.target;
  const rect = el.getBoundingClientRect?.() || { left: event.clientX, bottom: event.clientY, width: 0 };
  let left   = rect.left + rect.width/2 - 145;
  let top    = rect.bottom + 8 + window.scrollY;
  left = Math.max(8, Math.min(left, window.innerWidth - 298));
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
  popup.classList.remove('hidden');
  overlay?.classList.remove('hidden');
}

function hidePopup() {
  document.getElementById('profile-popup')?.classList.add('hidden');
  document.getElementById('popup-overlay')?.classList.add('hidden');
}

/* ── Utils ── */
function showError(msg) {
  document.getElementById('post-content').innerHTML =
    '<div class="container" style="padding:80px 24px;text-align:center;color:var(--text2)">' +
    '<p style="font-size:1.1rem">' + msg + '</p>' +
    '<a href="index.html" class="post-back-link" style="display:inline-block;margin-top:20px">← Retour</a></div>';
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
