# ✦ Encre & Mémoire — Blog d'écriture

Blog d'écriture moderne avec 4 admins, catégories, planification et interface d'administration.

---

## 📁 Structure du projet

```
blog/
├── index.html          ← Page d'accueil
├── post.html           ← Détail d'un post
├── admin.html          ← Interface admin
├── css/
│   ├── style.css       ← Styles du blog
│   └── admin.css       ← Styles de l'admin
├── js/
│   ├── main.js         ← JS page d'accueil
│   ├── post.js         ← JS page de détail
│   └── admin.js        ← JS interface admin
└── backend/
    ├── server.js           ← Serveur Express
    ├── package.json
    ├── .env                ← Variables d'environnement
    ├── models/
    │   ├── Admin.js        ← Modèle administrateur
    │   └── Post.js         ← Modèle article
    ├── routes/
    │   ├── auth.js         ← Routes login/auth
    │   └── posts.js        ← Routes CRUD posts
    └── middleware/
        └── auth.js         ← Middleware JWT
```

---

## 🚀 Démarrage rapide

### 1. Prérequis
- Node.js ≥ 18
- MongoDB installé et démarré (`mongod`)

### 2. Installer les dépendances
```bash
cd blog/backend
npm install
```

### 3. Configurer l'environnement
Ouvrez `backend/.env` et modifiez :
```env
JWT_SECRET=un_secret_long_et_unique
MONGO_URI=mongodb://localhost:27017/encre_memoire
```

### 4. Démarrer le serveur
```bash
# Production
npm start

# Développement (rechargement automatique)
npm run dev
```

Le serveur démarre sur **http://localhost:3000**

### 5. Ouvrir le blog
Ouvrez `index.html` dans votre navigateur, ou servez les fichiers statiques via un serveur local :
```bash
# Depuis le dossier blog/
npx serve .
# ou
python3 -m http.server 8080
```

---

## 🔐 Admins par défaut

| Utilisateur | Mot de passe  |
|-------------|---------------|
| admin1      | motdepasse1   |
| admin2      | motdepasse2   |
| admin3      | motdepasse3   |
| admin4      | motdepasse4   |

> ⚠️ **Changez ces mots de passe** dans `backend/models/Admin.js` avant le premier démarrage !

Pour modifier un mot de passe après démarrage, utilisez l'API :
```bash
# Après connexion, PUT /api/auth/password avec le token JWT
curl -X PUT http://localhost:3000/api/auth/password \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"motdepasse1","newPassword":"nouveauMotDePasse!"}'
```

---

## 🌐 API REST

### Endpoints publics
| Méthode | Route                      | Description              |
|---------|----------------------------|--------------------------|
| GET     | `/api/posts`               | Liste des posts publiés  |
| GET     | `/api/posts/:id`           | Détail d'un post         |
| POST    | `/api/posts/:id/like`      | Liker un post (toggle)   |
| GET     | `/api/health`              | Vérification serveur     |

### Endpoints protégés (JWT requis)
| Méthode | Route                      | Description              |
|---------|----------------------------|--------------------------|
| POST    | `/api/auth/login`          | Connexion admin          |
| GET     | `/api/auth/me`             | Profil admin courant     |
| PUT     | `/api/auth/password`       | Changer son mot de passe |
| POST    | `/api/posts`               | Créer un post            |
| PUT     | `/api/posts/:id`           | Modifier un post         |
| DELETE  | `/api/posts/:id`           | Supprimer un post        |

### Paramètres de la liste des posts
```
GET /api/posts?page=1&limit=9&sort=-publishedAt&category=poeme&search=mot
```

---

## 🛠️ Fonctionnalités

### Blog public
- ✅ Page d'accueil avec cards, filtres par catégorie, tri
- ✅ Page de détail avec contenu complet et suggestions
- ✅ Design éditorial noir & or, typographie Lora + Montserrat
- ✅ Animations fade-in au chargement
- ✅ Responsive mobile/desktop

### Interface admin
- ✅ Login sécurisé avec JWT (8h de session)
- ✅ Tableau de bord avec liste de tous les posts
- ✅ Création avec éditeur rich text
- ✅ Modification de posts existants
- ✅ Suppression avec confirmation
- ✅ Planification (date future)
- ✅ Aperçu avant publication
- ✅ Recherche et filtre dans la liste
- ✅ Statistiques par catégorie

### Backend
- ✅ Express + MongoDB/Mongoose
- ✅ Mots de passe hashés (bcrypt)
- ✅ JWT sécurisé
- ✅ Validation des données
- ✅ Pagination
- ✅ Structure prévue pour likes et commentaires

---

## 🔮 Extensions futures prévues

Le modèle `Post` inclut déjà :
- `likes[]` — Tableau pour les likes anonymes
- `tags[]` — Mots-clés pour un futur système de tags
- `comments` — Référence prête pour un modèle Comment

---

## 🔒 Sécurité en production

1. Changez `JWT_SECRET` dans `.env` avec une valeur aléatoire longue
2. Changez les mots de passe admins par défaut
3. Restreignez `CORS origin` dans `server.js` à votre domaine
4. Utilisez HTTPS
5. Mettez `NODE_ENV=production`
