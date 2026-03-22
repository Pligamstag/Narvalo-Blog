/**
 * models/Post.js
 * Modèle Mongoose pour les articles du blog.
 *
 * Structure :
 *   title       — Titre du texte
 *   author      — Nom de l'auteur (admin)
 *   category    — anecdote | poeme | journee | autre
 *   summary     — Résumé court (affiché sur l'accueil)
 *   content     — Contenu HTML complet
 *   publishedAt — Date de publication (peut être dans le futur = planifié)
 *   createdAt   — Date de création du document
 *   updatedAt   — Dernière modification
 *
 * Champs prévus pour futures fonctionnalités :
 *   likes       — Tableau d'IP ou user IDs (pour les likes)
 *   comments    — Référence à un modèle Comment séparé
 *   tags        — Mots-clés libres
 */

const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({

  title: {
    type: String,
    required: [true, 'Le titre est obligatoire'],
    trim: true,
    maxlength: [200, 'Le titre ne peut pas dépasser 200 caractères'],
  },

  author: {
    type: String,
    required: [true, "L'auteur est obligatoire"],
    trim: true,
    maxlength: [80, "Le nom de l'auteur ne peut pas dépasser 80 caractères"],
  },

  category: {
    type: String,
    required: [true, 'La catégorie est obligatoire'],
    enum: { values: ['anecdote', 'poeme', 'journee', 'autre'], message: 'Catégorie invalide' },
  },

  summary: {
    type: String,
    required: [true, 'Le résumé est obligatoire'],
    trim: true,
    maxlength: [300, 'Le résumé ne peut pas dépasser 300 caractères'],
  },

  content: {
    type: String,
    required: [true, 'Le contenu est obligatoire'],
  },

  publishedAt: {
    type: Date,
    default: Date.now,
  },

  // ── Futures fonctionnalités ──

  // Likes : tableau d'identifiants anonymes (IP hashée ou sessionId)
  likes: {
    type: [String],
    default: [],
  },

  // Tags libres pour filtrage futur
  tags: {
    type: [String],
    default: [],
  },

  // Commentaires : référence à un futur modèle Comment
  // comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],

}, {
  timestamps: true,   // Ajoute createdAt et updatedAt automatiquement
  versionKey: false,
});

// ── Index pour accélérer les requêtes courantes ──
PostSchema.index({ publishedAt: -1 });
PostSchema.index({ category: 1, publishedAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
