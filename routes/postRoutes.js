/**
 * routes/postRoutes.js
 * CRUD complet pour les posts du blog.
 */

const express  = require('express');
const Post     = require('../models/Post');
const { protect } = require('../middleware/authMiddleware'); // ← nom mis à jour

const router = express.Router();

/* GET /api/posts */
router.get('/', async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 9,
      sort     = '-publishedAt',
      category,
      search,
    } = req.query;

    const filter = {};

    const isAdmin = req.headers.authorization?.startsWith('Bearer');
    if (!isAdmin) {
      filter.publishedAt = { $lte: new Date() };
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { title:   { $regex: search, $options: 'i' } },
        { author:  { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort(sort)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .select('-content');

    res.json({ posts, total, page: Number(page), limit: Number(limit) });

  } catch (err) {
    console.error('GET /posts error:', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

/* GET /api/posts/:id */
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post introuvable.' });
    }

    const isAdmin = req.headers.authorization?.startsWith('Bearer');
    if (!isAdmin && post.publishedAt > new Date()) {
      return res.status(404).json({ message: 'Post introuvable.' });
    }

    res.json(post);

  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Post introuvable.' });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

/* POST /api/posts */
router.post('/', protect, async (req, res) => {
  try {
    const { title, author, category, summary, content, publishedAt } = req.body;

    const post = new Post({
      title, author, category, summary, content,
      publishedAt: publishedAt || new Date(),
    });

    await post.save();
    res.status(201).json(post);

  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

/* PUT /api/posts/:id */
router.put('/:id', protect, async (req, res) => {
  try {
    const { title, author, category, summary, content, publishedAt } = req.body;

    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { title, author, category, summary, content, publishedAt },
      { new: true, runValidators: true }
    );

    if (!post) {
      return res.status(404).json({ message: 'Post introuvable.' });
    }

    res.json(post);

  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: messages });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

/* DELETE /api/posts/:id */
router.delete('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post introuvable.' });
    }

    res.json({ message: 'Post supprimé avec succès.', id: req.params.id });

  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

/* POST /api/posts/:id/like */
router.post('/:id/like', async (req, res) => {
  try {
    const ip      = req.ip || 'unknown';
    const likerId = Buffer.from(ip).toString('base64');

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post introuvable.' });

    if (post.likes.includes(likerId)) {
      post.likes = post.likes.filter(l => l !== likerId);
    } else {
      post.likes.push(likerId);
    }

    await post.save();
    res.json({ likes: post.likes.length, liked: post.likes.includes(likerId) });

  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
