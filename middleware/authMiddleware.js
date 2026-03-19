/**
 * middleware/authMiddleware.js
 * Middleware de protection des routes admin.
 * Vérifie la présence et la validité du JWT dans le header Authorization.
 */

const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'changez_ce_secret_en_prod_!!!';

/**
 * Middleware `protect` :
 * Vérifie le token JWT et attache l'admin au request.
 * Usage : router.post('/route-protégée', protect, handler)
 */
const protect = async (req, res, next) => {
  let token;

  // Le token doit être envoyé dans le header : Authorization: Bearer <token>
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Non autorisé. Token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Vérifier que l'admin existe encore en base
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) {
      return res.status(401).json({ message: 'Admin introuvable. Reconnectez-vous.' });
    }

    req.admin = { id: admin._id, username: admin.username };
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expirée. Veuillez vous reconnecter.' });
    }
    return res.status(401).json({ message: 'Token invalide.' });
  }
};

module.exports = { protect };
