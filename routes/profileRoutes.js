/**
 * routes/profileRoutes.js
 * Gestion des profils publics des auteurs.
 *
 * Public :
 *   GET  /api/profiles          — liste tous les profils
 *   GET  /api/profiles/:username — profil d'un auteur
 *
 * Protégé (admin) :
 *   PUT  /api/profiles/me       — modifier son propre profil
 */

const express  = require('express');
const Profile  = require('../models/Profile');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/* GET /api/profiles */
router.get('/', async (req, res) => {
  try {
    const profiles = await Profile.find().select('-__v');
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

/* GET /api/profiles/:username */
router.get('/:username', async (req, res) => {
  try {
    const profile = await Profile.findOne({ username: req.params.username });
    if (!profile) return res.status(404).json({ message: 'Profil introuvable.' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

/* PUT /api/profiles/me — Modifier son propre profil */
router.put('/me', protect, async (req, res) => {
  const { firstName, pseudo, bio, quote, avatar, nationality, dreamCountry, passions, links } = req.body;

  try {
    const profile = await Profile.findOneAndUpdate(
      { username: req.admin.username },
      { firstName, pseudo, bio, quote, avatar, nationality, dreamCountry, passions, links },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(profile);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
