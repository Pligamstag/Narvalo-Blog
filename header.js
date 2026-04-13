/**
 * js/header.js
 * Header commun à toutes les pages
 * - Chip utilisateur avec dropdown
 * - Popup profil utilisateur basique
 * - Bouton admin visible pour les admins
 * - Initialisation notifications
 */

const API_BASE_HEADER = 'https://narvalo-blog.onrender.com/api';

function initHeader() {
  const tryAuth = () => {
    if (!window.onUserAuthChange) { setTimeout(tryAuth, 100); return; }
    window.onUserAuthChange(async user => {
      renderHeader(user);
      if (user) window.initNotifications?.(user);
    });
  };
  tryAuth();
}

function renderHeader(user) {
  const signinBtn = document.getElementById('btn-signin');
  const userChip  = document.getElementById('user-chip');
  const adminBtn  = document.querySelector('.nav-admin-btn, .admin-only');

  // Bouton admin visible uniquement pour les admins
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = user?.isAdmin ? '' : 'none';
  });

  if (!user) {
    signinBtn?.classList.remove('hidden');
    userChip?.classList.add('hidden');
    return;
  }

  signinBtn?.classList.add('hidden');
  userChip?.classList.remove('hidden');

  // Nom
  const nameEl = document.getElementById('user-chip-name');
  if (nameEl) nameEl.textContent = user.name?.split(' ')[0] || 'Toi';

  // Avatar ou initiale
  const avatarEl  = document.getElementById('user-chip-avatar');
  const initialEl = document.getElementById('user-chip-initial');
  if (avatarEl) {
    if (user.avatar) { avatarEl.src = user.avatar; avatarEl.style.display = 'block'; if(initialEl) initialEl.style.display='none'; }
    else { avatarEl.style.display = 'none'; if(initialEl){ initialEl.textContent=(user.name||'?').charAt(0).toUpperCase(); initialEl.style.display='flex'; } }
  }

  // Dropdown au clic sur le chip
  userChip?.addEventListener('click', e => {
    e.stopPropagation();
    showUserDropdown(user);
  });
}

function showUserDropdown(user) {
  // Supprimer ancien dropdown
  document.getElementById('user-dropdown-menu')?.remove();

  const chip    = document.getElementById('user-chip');
  const dropdown = document.createElement('div');
  dropdown.id        = 'user-dropdown-menu';
  dropdown.className = 'user-dropdown open';

  dropdown.innerHTML = `
    <a href="parametres.html" class="dropdown-item">⚙️ Paramètres</a>
    ${user.isAdmin ? '<a href="admin.html" class="dropdown-item">🛠️ Dashboard admin</a>' : ''}
    <div class="dropdown-divider"></div>
    <button class="dropdown-item danger" id="dropdown-logout">🚪 Se déconnecter</button>
  `;

  chip.appendChild(dropdown);

  dropdown.querySelector('#dropdown-logout').addEventListener('click', async () => {
    await window.signOutGoogle?.();
    window.location.href = 'login.html';
  });

  // Fermer en cliquant ailleurs
  setTimeout(() => {
    document.addEventListener('click', () => dropdown.remove(), { once: true });
  }, 10);
}

// Lancer l'init du header au chargement
document.addEventListener('DOMContentLoaded', initHeader);
