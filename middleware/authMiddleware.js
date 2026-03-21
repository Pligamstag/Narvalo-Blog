/**
 * middleware/authMiddleware.js
 * Vérifie les tokens Firebase ID Token sur les routes protégées.
 */

const ADMIN_EMAILS = [
  'samyfoot51@gmail.com',
  'vyrdox@gmail.com',
];

function decodeFirebaseToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    );
    return payload;
  } catch {
    return null;
  }
}

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ message: 'Non autorisé. Token manquant.' });
  }
  try {
    const decoded = decodeFirebaseToken(token);
    if (!decoded || !decoded.email) {
      return res.status(401).json({ message: 'Token invalide.' });
    }
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return res.status(401).json({ message: 'Session expirée. Reconnecte-toi.' });
    }
    const email = decoded.email.toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    req.admin = {
      email:    decoded.email,
      username: decoded.name || email.split('@')[0],
      uid:      decoded.user_id || decoded.sub,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide.' });
  }
};

module.exports = { protect };
