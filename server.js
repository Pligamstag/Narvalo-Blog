require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const postRoutes = require('./routes/postRoutes');
const profileRoutes = require('./routes/profileRoutes');
const commentRoutes = require('./routes/commentRoutes');
const statsRoutes = require('./routes/statsRoutes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'https://narvaloblog.netlify.app',
      'http://localhost:3000',
      'http://127.0.0.1:5500',
    ],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['https://narvaloblog.netlify.app', 'http://localhost:3000', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, './')));

app.set('io', io);

// Routes
app.use('/api/posts', postRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/stats', statsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// WebSocket avec compteur online
let onlineUsers = 0;

io.on('connection', (socket) => {
  onlineUsers++;
  io.emit('online_count', onlineUsers);
  console.log(`✅ Utilisateur connecté (${onlineUsers} en ligne)`);

  socket.on('join_post', (postId) => {
    socket.join(`post_${postId}`);
  });

  socket.on('new_comment', (data) => {
    io.to(`post_${data.postId}`).emit('comment_added', data.comment);
  });

  socket.on('reaction', (data) => {
    io.to(`post_${data.postId}`).emit('reaction_update', data);
  });

  socket.on('disconnect', () => {
    onlineUsers = Math.max(0, onlineUsers - 1);
    io.emit('online_count', onlineUsers);
    console.log(`❌ Utilisateur déconnecté (${onlineUsers} en ligne)`);
  });
});

// Stocker onlineUsers dans app pour statsRoutes
app.set('onlineUsers', onlineUsers);

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/narvalos')
  .then(() => {
    console.log('✅ MongoDB connecté');
    server.listen(PORT, () => console.log(`🚀 Les Narvalos sur http://localhost:${PORT}`));
  })
  .catch(err => { 
    console.error('❌ Erreur MongoDB:', err.message); 
    process.exit(1); 
  });
