/**
 * js/displayName.js — Utilitaire nom d'affichage
 * Inclure dans index.html, post.html, auteurs.html
 */
window.getDisplayName = function(p) {
  if (!p) return '?';
  var fn   = p.firstName || '';
  var ps   = p.pseudo    || '';
  var dm   = p.displayMode   || 'firstName';
  var show = p.showFirstName !== false; // true par défaut

  // Si prénom masqué → toujours le pseudo
  if (!show && ps) return ps;
  if (!show)       return p.username || '?';

  if (dm === 'pseudo' && ps)     return ps;
  if (dm === 'both' && fn && ps) return fn + ' · @' + ps;
  if (fn)                        return fn;
  if (ps)                        return ps;
  return p.username || '?';
};

window.findProfileByAuthor = function(profiles, name) {
  if (!profiles || !name) return null;
  var list = Array.isArray(profiles) ? profiles : Object.values(profiles);
  return list.find(function(p) {
    return p.firstName === name || p.pseudo === name ||
           p.username === name  || window.getDisplayName(p) === name;
  }) || null;
};
