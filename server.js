/**
 * server.js — Narvalos Backend
 */

require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

const authRoutes    = require('./routes/authRoutes');
const postRoutes    = require('./routes/postRoutes');
const profileRoutes = require('./routes/profileRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'] }));
app.use(express.json({ limit: '5mb' }));  // 5mb pour les avatars en base64
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../')));

app.use('/api/auth',     authRoutes);
app.use('/api/posts',    postRoutes);
app.use('/api/profiles', profileRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/narvalos';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connecté :', MONGO_URI);

    const Admin = require('./models/Admin');
    const count = await Admin.countDocuments();
    if (count === 0) {
      await Admin.seedDefaults();
      console.log('✅ Admins par défaut créés');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Narvalos démarré sur http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Erreur MongoDB :', err.message);
    process.exit(1);
  });
