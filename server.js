require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

const postRoutes    = require('./routes/postRoutes');
const profileRoutes = require('./routes/profileRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://narvaloblog.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
  ],
  methods: ['GET','POST','PUT','DELETE'],
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, './')));

app.use('/api/posts',    postRoutes);
app.use('/api/profiles', profileRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/narvalos')
  .then(() => {
    console.log('✅ MongoDB connecté');
    app.listen(PORT, () => console.log(`🚀 Les Narvalos sur http://localhost:${PORT}`));
  })
  .catch(err => { console.error('❌ MongoDB:', err.message); process.exit(1); });
