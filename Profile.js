/**
 * models/Profile.js
 * Profil public de chaque admin/auteur.
 * Lié au compte Admin par le champ `username`.
 */

const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true },  // Lié à Admin.username
  firstName:    { type: String, trim: true, default: '' },       // Prénom réel affiché
  pseudo:       { type: String, trim: true, default: '' },       // Pseudo optionnel
  bio:          { type: String, trim: true, maxlength: 500, default: '' },
  quote:        { type: String, trim: true, maxlength: 200, default: '' },  // Citation perso
  avatar:       { type: String, default: '' },                   // URL image (base64 ou lien)
  nationality:  { type: String, trim: true, default: '' },
  dreamCountry: { type: String, trim: true, default: '' },
  passions:     { type: [String], default: [] },                 // ["Musique", "Voyage", ...]
  links: {
    instagram: { type: String, default: '' },
    spotify:   { type: String, default: '' },
    twitter:   { type: String, default: '' },
    youtube:   { type: String, default: '' },
    tiktok:    { type: String, default: '' },
    other:     { type: String, default: '' },
  },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Profile', ProfileSchema);
