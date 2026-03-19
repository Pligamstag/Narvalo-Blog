/**
 * models/Admin.js
 * Modèle Mongoose pour les administrateurs.
 * Les mots de passe sont hashés avec bcrypt.
 *
 * ⚠️  CHANGER LES MOTS DE PASSE PAR DÉFAUT avant de déployer !
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  username:  { type: String, required: true, unique: true, trim: true },
  password:  { type: String, required: true },              // Hashé
  createdAt: { type: Date,   default: Date.now },
}, { versionKey: false });

// ── Hash automatique avant sauvegarde ──
AdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Méthode de comparaison de mot de passe ──
AdminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Seed : 4 admins par défaut ──
AdminSchema.statics.seedDefaults = async function () {
  const defaults = [
    { username: 'Samy', password: 'SamSamELPligamstag455108' },  // ← CHANGER
    { username: 'Lucie', password: '1234' },  // ← CHANGER
    { username: 'Killian', password: '1234' },  // ← CHANGER
    { username: 'Zayneb', password: '1234' },  // ← CHANGER
  ];

  for (const d of defaults) {
    const exists = await this.findOne({ username: d.username });
    if (!exists) {
      await new this(d).save();
      console.log(`   → Admin créé : ${d.username}`);
    }
  }
};

module.exports = mongoose.model('Admin', AdminSchema);
