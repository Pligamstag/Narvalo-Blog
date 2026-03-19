/**
 * routes/authRoutes.js
 * Routes d'authentification : login, vérification token, changement de mot de passe.
 */

const express = require('express');
const jwt     = require('jsonwebtoken');
const Admin   = require('../models/Admin');
const { protect } = require('../middleware/authMiddleware'); // ← nom mis à jour

const router = express.Router();
const JWT_SECRET  = process.env.JWT_SECRET  || 'changez_ce_secret_en_prod_!!!';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Retourne un JWT si les identifiants sont valides.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Nom d\'utilisateur et mot de passe requis.' });
  }

  try {
    const admin = await Admin.findOne({ username: username.trim() });

    if (!admin) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }

    const valid = await admin.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({ token, username: admin.username });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', protect, async (req, res) => {
  res.json({ id: req.admin.id, username: req.admin.username });
});

/**
 * PUT /api/auth/password
 */
router.put('/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Les deux mots de passe sont requis.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });
  }

  try {
    const admin = await Admin.findById(req.admin.id);
    const valid = await admin.comparePassword(currentPassword);

    if (!valid) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect.' });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ message: 'Mot de passe modifié avec succès.' });

  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
