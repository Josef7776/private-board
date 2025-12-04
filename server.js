const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Création dossier uploads si nécessaire
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Storage multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 3 * 1024 * 1024 } });

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

// Données en mémoire (pour commencer simple)
let threads = [];
let nextThreadId = 1;

// Secret path + mot de passe
const SECRET_PATH = "/" + Math.random().toString(36).slice(2, 10);
const BOARD_PASSWORD = "tonmotdepasse"; // change ça pour plus de sécurité

// Middleware mot de passe
app.use((req, res, next) => {
  if (!req.path.startsWith(SECRET_PATH)) return next();
  const pw = req.query.pw || "";
  if (pw !== BOARD_PASSWORD) return res.send(`<h2>Accès interdit. Mot de passe requis.</h2>
  <form method="GET"><input type="password" name="pw" placeholder="Mot de passe"><button>Entrer</button></form>`);
  next();
});

// Page principale - liste des threads
app.get(SECRET_PATH, (req, res) => {
  let html = "<h1>💬 Private Board</h1>";
  html += `
    <form method="POST" action="${SECRET_PATH}?pw=${BOARD_PASSWORD}" enctype="multipart/form-data">
      <input type="text" name="title" placeholder="Titre (optionnel)"><br><br>
      <textarea name="message" rows="4" cols="50" placeholder="Message"></textarea><br><br>
      <input type="file" name="image"><br><br>
      <button>Créer un fil</button>
    </form>
    <hr>
  `;
  threads.slice().reverse().forEach(t => {
    html += `<div style="border:1px solid #ccc;padding:10px;margin:5px;">
      <strong>#${t.id} ${t.title || ""}</strong><br>
      ${t.message}<br>
      ${t.image ? `<img src="/uploads/${t.image}" width="200">` : ""}
      <br><a href="${SECRET_PATH}/thread/${t.id}?pw=${BOARD_PASSWORD}">Voir le fil</a>
    </div>`;
  });
  res.send(html);
});

// Créer un thread
app.post(SECRET_PATH, upload.single("image"), (req, res) => {
  const { title, message } = req.body;
  const image = req.file ? req.file.filename : null;
  threads.push({ id: nextThreadId++, title, message, image, replies: [] });
  res.redirect(`${SECRET_PATH}?pw=${BOARD_PASSWORD}`);
});

// Page fil
app.get(SECRET_PATH + "/thread/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const thread = threads.find(t => t.id === id);
  if (!thread) return res.send("Fil introuvable.");
  let html = `<h1>#${thread.id} ${thread.title || ""}</h1>
    <div>${thread.message}</div>
    ${thread.image ? `<img src="/uploads/${thread.image}" width="400">` : ""}
    <hr>
    <h3>Réponses :</h3>
  `;
  thread.replies.forEach(r => {
    html += `<div style="border:1px solid #ccc;padding:5px;margin:5px;">
      ${r.message}<br>
      ${r.image ? `<img src="/uploads/${r.image}" width="200">` : ""}
    </div>`;
  });
  html += `
    <hr>
    <form method="POST" action="${SECRET_PATH}/thread/${thread.id}?pw=${BOARD_PASSWORD}" enctype="multipart/form-data">
      <textarea name="message" rows="3" cols="50" placeholder="Répondre"></textarea><br>
      <input type="file" name="image"><br>
      <button>Répondre</button>
    </form>
    <br><a href="${SECRET_PATH}?pw=${BOARD_PASSWORD}">Retour</a>
  `;
  res.send(html);
});

// Poster une réponse
app.post(SECRET_PATH + "/thread/:id", upload.single("image"), (req, res) => {
  const id = parseInt(req.params.id);
  const thread = threads.find(t => t.id === id);
  if (!thread) return res.send("Fil introuvable.");
  const message = req.body.message;
  const image = req.file ? req.file.filename : null;
  thread.replies.push({ message, image });
  res.redirect(`${SECRET_PATH}/thread/${id}?pw=${BOARD_PASSWORD}`);
});

app.listen(PORT, () => {
  console.log(`Site lancé sur port ${PORT}`);
  console.log(`URL secrète : ${SECRET_PATH}`);
  console.log(`Mot de passe : ${BOARD_PASSWORD}`);
});
