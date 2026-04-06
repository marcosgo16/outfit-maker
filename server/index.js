import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { verifyGoogleIdToken, signSessionToken, verifySessionToken } from "./auth.js";

const UserStateSchema = new mongoose.Schema(
  {
    googleSub: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: "" },
    name: { type: String, default: "" },
    picture: { type: String, default: "" },
    wardrobe: { type: Array, default: [] },
    outfits: { type: Array, default: [] },
  },
  { timestamps: true }
);

const UserState =
  mongoose.models.UserState || mongoose.model("UserState", UserStateSchema);

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use(
  cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  })
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({ error: "Falta JWT_SECRET en el servidor" });
  }
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }
  try {
    const token = h.slice(7);
    req.user = verifySessionToken(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o caducada" });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/google", async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !JWT_SECRET) {
    return res.status(500).json({ error: "Falta GOOGLE_CLIENT_ID o JWT_SECRET" });
  }
  const { idToken } = req.body ?? {};
  if (!idToken) return res.status(400).json({ error: "Falta idToken" });
  try {
    const user = await verifyGoogleIdToken(idToken, GOOGLE_CLIENT_ID);
    const token = signSessionToken(
      { sub: user.sub, email: user.email },
      JWT_SECRET
    );
    await UserState.findOneAndUpdate(
      { googleSub: user.sub },
      {
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (e) {
    res.status(401).json({ error: String(e.message) });
  }
});

app.get("/api/state", requireAuth, async (req, res) => {
  try {
    const doc = await UserState.findOne({ googleSub: req.user.sub }).lean();
    if (!doc) return res.json({ wardrobe: [], outfits: [] });
    res.json({
      wardrobe: doc.wardrobe ?? [],
      outfits: doc.outfits ?? [],
      email: doc.email ?? "",
      name: doc.name ?? "",
      picture: doc.picture ?? "",
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.put("/api/state", requireAuth, async (req, res) => {
  try {
    const { wardrobe, outfits } = req.body ?? {};
    await UserState.findOneAndUpdate(
      { googleSub: req.user.sub },
      {
        email: req.user.email,
        wardrobe: Array.isArray(wardrobe) ? wardrobe : [],
        outfits: Array.isArray(outfits) ? outfits : [],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.post("/api/ai", requireAuth, async (req, res) => {
  const { wardrobe, outfits, question } = req.body ?? {};
  if (!question) return res.status(400).json({ error: "Falta question" });

  const context = `
Armario del usuario:
${JSON.stringify(wardrobe ?? [], null, 2)}

Outfits guardados:
${JSON.stringify(outfits ?? [], null, 2)}
  `.trim();

  const prompt = `Eres un asistente de moda personal. Tienes acceso al armario y outfits del usuario.

${context}

Pregunta del usuario: ${question}

Responde en español, de forma concisa y útil.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await r.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Sin respuesta de Gemini");
    res.json({ reply: text });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

const PORT = Number(process.env.PORT) || 5050;
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("Falta MONGODB_URI en el entorno (.env)");
  process.exit(1);
}

mongoose
  .connect(uri)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
