// server/app.ts
import express from "express";
import cookieParser from "cookie-parser";

// server/auth.ts
import crypto from "node:crypto";

// server/firebase.ts
import fs2 from "node:fs";
import path2 from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0088409992",
  appId: "1:463425881782:web:a58dae9ed76bc341b80817",
  apiKey: "AIzaSyD3n38epLSIgcPHhsnkPb57w388Ju2-sUg",
  authDomain: "gen-lang-client-0088409992.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-64b4d4c0-2a89-4984-92cd-0aa06cf48b9f",
  storageBucket: "gen-lang-client-0088409992.firebasestorage.app",
  messagingSenderId: "463425881782",
  measurementId: "",
  oAuthClientId: "463425881782-1ri4ma442s5lf6mmjmp6k67d26ikmcsq.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// server/localDb.ts
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
function cloneData(val) {
  if (val === void 0) return val;
  return JSON.parse(JSON.stringify(val));
}
function getFieldValue(obj, fieldPath) {
  const parts = fieldPath.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return void 0;
    cur = cur[p];
  }
  return cur;
}
function matchesFilter(doc, f) {
  const actual = getFieldValue(doc, f.field);
  switch (f.op) {
    case "==":
      return actual === f.value;
    case "!=":
      return actual !== f.value;
    case "in":
      return Array.isArray(f.value) && f.value.includes(actual);
    case "<":
      return actual < f.value;
    case "<=":
      return actual <= f.value;
    case ">":
      return actual > f.value;
    case ">=":
      return actual >= f.value;
    default:
      return false;
  }
}
var SqliteBackend = class {
  constructor(DatabaseSyncCtor, dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSyncCtor(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS documents (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      );
      CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents (collection);
    `);
  }
  getRaw(collectionName, id) {
    const stmt = this.db.prepare("SELECT data FROM documents WHERE collection = ? AND id = ?");
    const row = stmt.get(collectionName, id);
    if (!row) return null;
    return JSON.parse(row.data);
  }
  listRaw(collectionName) {
    const stmt = this.db.prepare("SELECT id, data FROM documents WHERE collection = ?");
    const rows = stmt.all(collectionName);
    return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) }));
  }
  setRaw(collectionName, id, data, merge) {
    let finalData = cloneData(data);
    if (merge) {
      const existing = this.getRaw(collectionName, id);
      if (existing) {
        finalData = { ...existing, ...finalData };
      }
    }
    const stmt = this.db.prepare(
      "INSERT INTO documents (collection, id, data) VALUES (?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data"
    );
    stmt.run(collectionName, id, JSON.stringify(finalData));
  }
  updateRaw(collectionName, id, data) {
    const existing = this.getRaw(collectionName, id);
    if (!existing) {
      throw new Error(`NOT_FOUND: Document ${collectionName}/${id} does not exist.`);
    }
    const merged = { ...existing, ...cloneData(data) };
    const stmt = this.db.prepare("UPDATE documents SET data = ? WHERE collection = ? AND id = ?");
    stmt.run(JSON.stringify(merged), collectionName, id);
  }
  deleteRaw(collectionName, id) {
    const stmt = this.db.prepare("DELETE FROM documents WHERE collection = ? AND id = ?");
    stmt.run(collectionName, id);
  }
  beginImmediate() {
    this.db.exec("BEGIN IMMEDIATE");
  }
  commit() {
    this.db.exec("COMMIT");
  }
  rollback() {
    try {
      this.db.exec("ROLLBACK");
    } catch {
    }
  }
};
var JsonFileBackend = class {
  constructor(filePath) {
    this.store = {};
    this.snapshot = null;
    this.inTx = false;
    this.filePath = filePath;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (fs.existsSync(filePath)) {
        this.store = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch {
      this.store = {};
    }
  }
  persist() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.store), "utf-8");
    } catch {
    }
  }
  getRaw(collectionName, id) {
    const col = this.store[collectionName];
    return col && col[id] ? cloneData(col[id]) : null;
  }
  listRaw(collectionName) {
    const col = this.store[collectionName] || {};
    return Object.entries(col).map(([id, data]) => ({ id, data: cloneData(data) }));
  }
  setRaw(collectionName, id, data, merge) {
    if (!this.store[collectionName]) this.store[collectionName] = {};
    let finalData = cloneData(data);
    if (merge && this.store[collectionName][id]) {
      finalData = { ...this.store[collectionName][id], ...finalData };
    }
    this.store[collectionName][id] = finalData;
    if (!this.inTx) this.persist();
  }
  updateRaw(collectionName, id, data) {
    const existing = this.store[collectionName]?.[id];
    if (!existing) {
      throw new Error(`NOT_FOUND: Document ${collectionName}/${id} does not exist.`);
    }
    this.store[collectionName][id] = { ...existing, ...cloneData(data) };
    if (!this.inTx) this.persist();
  }
  deleteRaw(collectionName, id) {
    if (this.store[collectionName]) {
      delete this.store[collectionName][id];
      if (!this.inTx) this.persist();
    }
  }
  beginImmediate() {
    this.inTx = true;
    this.snapshot = cloneData(this.store);
  }
  commit() {
    this.inTx = false;
    this.snapshot = null;
    this.persist();
  }
  rollback() {
    if (this.snapshot) {
      this.store = this.snapshot;
    }
    this.inTx = false;
    this.snapshot = null;
  }
};
var LocalDocRef = class {
  constructor(store, collectionName, id) {
    this.store = store;
    this.collectionName = collectionName;
    this.id = id;
  }
  async get() {
    const raw = this.store._getRaw(this.collectionName, this.id);
    if (!raw) {
      return { id: this.id, exists: false, ref: this, data: () => void 0 };
    }
    return {
      id: this.id,
      exists: true,
      ref: this,
      data: () => cloneData(raw)
    };
  }
  async set(data, options) {
    this.store._setRaw(this.collectionName, this.id, data, Boolean(options?.merge));
  }
  async update(data) {
    this.store._updateRaw(this.collectionName, this.id, data);
  }
  async delete() {
    this.store._deleteRaw(this.collectionName, this.id);
  }
};
var LocalQuery = class _LocalQuery {
  constructor(store, collectionName, filters = [], limitCount = null) {
    this.store = store;
    this.collectionName = collectionName;
    this.filters = filters;
    this.limitCount = limitCount;
  }
  where(field, op, value) {
    return new _LocalQuery(
      this.store,
      this.collectionName,
      [...this.filters, { field, op, value }],
      this.limitCount
    );
  }
  limit(n) {
    return new _LocalQuery(this.store, this.collectionName, this.filters, n);
  }
  async get() {
    const rows = this.store._listRaw(this.collectionName);
    const matched = [];
    for (const row of rows) {
      if (this.filters.every((f) => matchesFilter(row.data, f))) {
        const ref = new LocalDocRef(this.store, this.collectionName, row.id);
        const copied = cloneData(row.data);
        matched.push({
          id: row.id,
          exists: true,
          ref,
          data: () => cloneData(copied)
        });
        if (this.limitCount !== null && matched.length >= this.limitCount) {
          break;
        }
      }
    }
    return {
      docs: matched,
      empty: matched.length === 0,
      size: matched.length
    };
  }
};
var LocalCollectionRef = class extends LocalQuery {
  constructor(store, name) {
    super(store, name);
    this._store = store;
    this._name = name;
  }
  doc(id) {
    return new LocalDocRef(this._store, this._name, id);
  }
};
var LocalTransaction = class {
  constructor(store) {
    this.ops = [];
    this.store = store;
  }
  async get(ref) {
    return ref.get();
  }
  set(ref, data, options) {
    const snapshot = cloneData(data);
    this.ops.push(() => {
      this.store._setRaw(ref.collectionName, ref.id, snapshot, Boolean(options?.merge));
    });
    return this;
  }
  update(ref, data) {
    const snapshot = cloneData(data);
    this.ops.push(() => {
      this.store._updateRaw(ref.collectionName, ref.id, snapshot);
    });
    return this;
  }
  delete(ref) {
    this.ops.push(() => {
      this.store._deleteRaw(ref.collectionName, ref.id);
    });
    return this;
  }
  _applyAll() {
    for (const op of this.ops) op();
  }
};
var LocalWriteBatch = class {
  constructor(store) {
    this.ops = [];
    this.store = store;
  }
  set(ref, data, options) {
    const snapshot = cloneData(data);
    this.ops.push(() => {
      this.store._setRaw(ref.collectionName, ref.id, snapshot, Boolean(options?.merge));
    });
    return this;
  }
  update(ref, data) {
    const snapshot = cloneData(data);
    this.ops.push(() => {
      this.store._updateRaw(ref.collectionName, ref.id, snapshot);
    });
    return this;
  }
  delete(ref) {
    this.ops.push(() => {
      this.store._deleteRaw(ref.collectionName, ref.id);
    });
    return this;
  }
  async commit() {
    await this.store.runTransaction(async () => {
      for (const op of this.ops) op();
    });
  }
};
var LocalFirestoreDb = class {
  constructor(dbPath) {
    this.txMutex = Promise.resolve();
    const baseDir = process.env.VERCEL ? "/tmp/quiztopia-data" : path.resolve(process.cwd(), "data");
    const sqlitePath = dbPath || path.join(baseDir, "quiztopia.db");
    const jsonPath = path.join(baseDir, "quiztopia.json");
    let selected = null;
    try {
      const require2 = createRequire(import.meta.url);
      const sqliteMod = require2("node:sqlite");
      if (sqliteMod?.DatabaseSync) {
        selected = new SqliteBackend(sqliteMod.DatabaseSync, sqlitePath);
      }
    } catch {
      selected = null;
    }
    this.backend = selected || new JsonFileBackend(jsonPath);
  }
  collection(name) {
    return new LocalCollectionRef(this, name);
  }
  batch() {
    return new LocalWriteBatch(this);
  }
  async runTransaction(fn) {
    const run = async () => {
      const tx = new LocalTransaction(this);
      this.backend.beginImmediate();
      try {
        const result = await fn(tx);
        tx._applyAll();
        this.backend.commit();
        return result;
      } catch (err) {
        this.backend.rollback();
        throw err;
      }
    };
    const next = this.txMutex.then(run, run);
    this.txMutex = next.then(
      () => void 0,
      () => void 0
    );
    return next;
  }
  _getRaw(collectionName, id) {
    return this.backend.getRaw(collectionName, id);
  }
  _listRaw(collectionName) {
    return this.backend.listRaw(collectionName);
  }
  _setRaw(collectionName, id, data, merge) {
    this.backend.setRaw(collectionName, id, data, merge);
  }
  _updateRaw(collectionName, id, data) {
    this.backend.updateRaw(collectionName, id, data);
  }
  _deleteRaw(collectionName, id) {
    this.backend.deleteRaw(collectionName, id);
  }
};

// server/firebase.ts
function loadFirebaseConfig() {
  const candidates = [
    path2.resolve(process.cwd(), "firebase-applet-config.json"),
    path2.resolve(import.meta.dirname ?? process.cwd(), "..", "firebase-applet-config.json")
  ];
  for (const p of candidates) {
    try {
      if (fs2.existsSync(p)) {
        return JSON.parse(fs2.readFileSync(p, "utf-8"));
      }
    } catch {
    }
  }
  return firebase_applet_config_default;
}
var firebaseConfig = loadFirebaseConfig();
function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return { account: null, error: null };
  try {
    let parsed = JSON.parse(raw);
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    if (!parsed || typeof parsed !== "object") {
      return { account: null, error: "FIREBASE_SERVICE_ACCOUNT_JSON must be a JSON object." };
    }
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    if (typeof parsed.private_key !== "string" || typeof parsed.client_email !== "string") {
      return {
        account: null,
        error: "FIREBASE_SERVICE_ACCOUNT_JSON is missing required client_email or private_key fields."
      };
    }
    return { account: parsed, error: null };
  } catch (err) {
    return {
      account: null,
      error: `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${err?.message || "JSON parse error"}`
    };
  }
}
var { account: serviceAccount, error: serviceAccountParseError } = parseServiceAccount();
var firebaseInitError = serviceAccountParseError;
var app;
var hasCredential = false;
try {
  if (getApps().length > 0) {
    app = getApps()[0];
    hasCredential = Boolean(serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  } else if (serviceAccount) {
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: firebaseConfig.projectId
    });
    hasCredential = true;
  } else {
    app = initializeApp({
      projectId: firebaseConfig.projectId
    });
    hasCredential = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
} catch (err) {
  firebaseInitError = err?.message || "Firebase Admin initialization failed.";
  console.error("Firebase Admin initialization error:", firebaseInitError);
  app = getApps().length ? getApps()[0] : initializeApp({ projectId: firebaseConfig.projectId }, "quiztopia-fallback");
  hasCredential = false;
}
var adminAuth = getAuth(app);
var remoteDb = null;
if (hasCredential) {
  try {
    remoteDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    firebaseInitError = err?.message || "Cloud Firestore client initialization failed.";
    console.error("Cloud Firestore initialization error:", firebaseInitError);
    remoteDb = null;
  }
}
var useRemoteFirestore = Boolean(remoteDb);
var adminDb = remoteDb ?? new LocalFirestoreDb();

// server/auth.ts
var SESSION_COOKIE_NAME = "quiztopia_session";
var DETERMINISTIC_DEV_SECRET = crypto.createHash("sha256").update(`quiztopia:${firebaseConfig.projectId}:${firebaseConfig.firestoreDatabaseId}`).digest("hex");
function getSessionSecret() {
  return process.env.SESSION_SECRET || DETERMINISTIC_DEV_SECRET;
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}
function signSessionToken(user, ttlMs = 1e3 * 60 * 60 * 24 * 7) {
  const payload = {
    ...user,
    exp: Date.now() + ttlMs
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}
function verifySessionToken(token) {
  if (!token) return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    const { exp: _exp, ...user } = parsed;
    return user;
  } catch {
    return null;
  }
}
function setSessionCookie(res, user) {
  const token = signSessionToken(user);
  const req = res.req;
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "");
  const isHttps = Boolean(req?.secure) || forwardedProto.includes("https") || process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    maxAge: 1e3 * 60 * 60 * 24 * 7,
    path: "/"
  });
  return token;
}
function clearSessionCookie(res) {
  const req = res.req;
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "");
  const isHttps = Boolean(req?.secure) || forwardedProto.includes("https") || process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: "/",
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps
  });
}
function attachSession(req, _res, next) {
  const authHeader = req.headers?.authorization;
  const bearerToken = typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : void 0;
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  req.sessionUser = verifySessionToken(bearerToken) ?? verifySessionToken(cookieToken) ?? void 0;
  next();
}
function requireTeacher(req, res, next) {
  if (!req.sessionUser) {
    res.status(401).json({ error: "Teacher authentication required." });
    return;
  }
  if (req.sessionUser.role !== "teacher") {
    res.status(403).json({ error: "Forbidden: Teacher access only." });
    return;
  }
  next();
}
function requireTeam(req, res, next) {
  if (!req.sessionUser) {
    res.status(401).json({ error: "Team authentication required." });
    return;
  }
  if (req.sessionUser.role !== "team" || !req.sessionUser.teamId) {
    res.status(403).json({ error: "Forbidden: Team access only." });
    return;
  }
  next();
}

// server/routes/authRoutes.ts
import crypto2 from "node:crypto";
import { Router } from "express";

// shared/gameLogic.ts
var DEFAULT_AVATAR = {
  characterType: "wizard",
  hairStyle: "braids",
  faceStyle: "happy",
  clothingStyle: "robe",
  accessory: "wizard_hat",
  primaryColor: "#6D28D9",
  accentColor: "#F59E0B"
};
var DEFAULT_GAME_RULES = {
  creaturePowerMultiplier: 1,
  buildingPowerMultiplier: 1,
  achievementPowerMultiplier: 1,
  participationCoins: 50,
  firstPlaceBonusCoins: 100,
  secondPlaceBonusCoins: 70,
  thirdPlaceBonusCoins: 50,
  coinsPerCorrectAnswer: 25
};
function validateTeamMembers(nicknames) {
  const cleaned = nicknames.map((n) => n.trim().replace(/\s+/g, " ")).filter((n) => n.length > 0);
  if (cleaned.length < 2) {
    return { valid: false, cleaned, error: "Each team must have between 2 and 4 members." };
  }
  if (cleaned.length > 4) {
    return { valid: false, cleaned, error: "Each team can have at most 4 members." };
  }
  for (const name of cleaned) {
    if (name.length > 30) {
      return { valid: false, cleaned, error: "Member first names or nicknames must be 30 characters or fewer." };
    }
  }
  return { valid: true, cleaned };
}
function calculateIslandPower(params) {
  const creaturePower = Math.round(params.creaturePowerSum * params.rules.creaturePowerMultiplier);
  const buildingPower = Math.round(params.buildingPowerSum * params.rules.buildingPowerMultiplier);
  const achievementPower = Math.round(params.achievementPowerSum * params.rules.achievementPowerMultiplier);
  const teacherBonusPower = Math.max(0, Math.round(params.teacherBonusPower));
  return {
    creaturePower,
    buildingPower,
    achievementPower,
    teacherBonusPower,
    totalPower: creaturePower + buildingPower + achievementPower + teacherBonusPower
  };
}
function calculateQuestionScore(params) {
  if (!params.isCorrect) return 0;
  const base = Math.max(10, params.basePoints);
  if (!params.speedBonusEnabled) return base;
  const duration = Math.max(1e3, params.questionEndsAt - params.questionStartedAt);
  const remaining = Math.max(0, params.questionEndsAt - params.submittedAt);
  const ratio = Math.min(1, remaining / duration);
  const speedBonus = Math.round(base * 0.25 * ratio);
  return base + speedBonus;
}
function calculateQuizCoins(params) {
  let rankBonus = 0;
  if (params.rank === 1) rankBonus = params.rules.firstPlaceBonusCoins;
  else if (params.rank === 2) rankBonus = params.rules.secondPlaceBonusCoins;
  else if (params.rank === 3) rankBonus = params.rules.thirdPlaceBonusCoins;
  const answerCoins = Math.max(0, params.correctCount) * params.rules.coinsPerCorrectAnswer;
  return params.rules.participationCoins + rankBonus + answerCoins;
}

// server/seed.ts
var seedPromise = null;
var SEED_CREATURES = [
  {
    name: "Lumibun",
    element: "Light",
    rarity: "Common",
    description: "A glowing cloud-eared bunny spirit that lights up study lanterns on misty islands.",
    artKey: "lumibun",
    price: 250,
    powerValue: 120,
    isActive: true
  },
  {
    name: "Sproutling",
    element: "Earth",
    rarity: "Common",
    description: "A playful leaf-crowned guardian that helps magical gardens bloom across floating terraces.",
    artKey: "sproutling",
    price: 300,
    powerValue: 150,
    isActive: true
  },
  {
    name: "Crystal Wisp",
    element: "Cosmic",
    rarity: "Uncommon",
    description: "A floating prism sprite humming with stardust energy from ancient sky observatories.",
    artKey: "crystal_wisp",
    price: 450,
    powerValue: 220,
    isActive: true
  },
  {
    name: "Emberling",
    element: "Fire",
    rarity: "Uncommon",
    description: "A cheerful flame-tail drakelet whose warm sparks inspire bold team brainstorming.",
    artKey: "emberling",
    price: 550,
    powerValue: 270,
    isActive: true
  },
  {
    name: "Moonfox",
    element: "Darkness",
    rarity: "Rare",
    description: "A velvet-indigo twilight fox wearing crescent chimes that shimmer under starry skies.",
    artKey: "moonfox",
    price: 700,
    powerValue: 360,
    isActive: true
  },
  {
    name: "Cloud Drake",
    element: "Wind",
    rarity: "Rare",
    description: "A friendly sky-winged dragonet that glides beside airships carrying quiz scrolls.",
    artKey: "cloud_drake",
    price: 800,
    powerValue: 420,
    isActive: true
  },
  {
    name: "Star Unicorn",
    element: "Light",
    rarity: "Epic",
    description: "A radiant pastel-maned unicorn whose crystal horn weaves rainbow bridges between islands.",
    artKey: "star_unicorn",
    price: 1e3,
    powerValue: 550,
    isActive: true
  },
  {
    name: "Celestial Phoenix",
    element: "Fire",
    rarity: "Legendary",
    description: "A golden sun-feather phoenix that turns every classroom challenge into a soaring triumph.",
    artKey: "celestial_phoenix",
    price: 1200,
    powerValue: 700,
    isActive: true
  },
  {
    name: "Astral Dragon",
    element: "Cosmic",
    rarity: "Mythical",
    description: "The royal amethyst guardian of Quiztopia, shimmering with constellation wings.",
    artKey: "astral_dragon",
    price: 1500,
    powerValue: 920,
    isActive: true
  }
];
var SEED_ITEMS = [
  {
    slug: "central_castle",
    category: "building",
    name: "Starlight Keep",
    description: "A royal lavender turret castle at the heart of your team island.",
    artKey: "central_castle",
    price: 0,
    powerValue: 300,
    isActive: true
  },
  {
    slug: "crystal_tower",
    category: "building",
    name: "Crystal Observatory",
    description: "A glowing amethyst spire that amplifies cosmic island energy.",
    artKey: "crystal_tower",
    price: 350,
    powerValue: 200,
    isActive: true
  },
  {
    slug: "wisdom_library",
    category: "building",
    name: "Hall of Wisdom",
    description: "An enchanted domed library overflowing with floating storybooks.",
    artKey: "wisdom_library",
    price: 450,
    powerValue: 260,
    isActive: true
  },
  {
    slug: "airship_dock",
    category: "building",
    name: "Sky Airship Dock",
    description: "A wooden cloud-pier welcoming magical explorers and supply balloons.",
    artKey: "airship_dock",
    price: 500,
    powerValue: 300,
    isActive: true
  },
  {
    slug: "emerald_grove",
    category: "decoration",
    name: "Whispering Grove",
    description: "Luminous emerald trees that shelter Earth and Wind creatures.",
    artKey: "emerald_grove",
    price: 150,
    powerValue: 90,
    isActive: true
  },
  {
    slug: "star_fountain",
    category: "decoration",
    name: "Starlight Fountain",
    description: "A shimmering turquoise cascade fed by sky-springs.",
    artKey: "star_fountain",
    price: 220,
    powerValue: 130,
    isActive: true
  },
  {
    slug: "lantern_arch",
    category: "decoration",
    name: "Golden Lantern Arch",
    description: "Warm floating festival lanterns celebrating great teamwork.",
    artKey: "lantern_arch",
    price: 180,
    powerValue: 110,
    isActive: true
  },
  {
    slug: "rainbow_bridge",
    category: "decoration",
    name: "Rainbow Crystal Bridge",
    description: "A prism arch connecting outer floating islets to your castle.",
    artKey: "rainbow_bridge",
    price: 320,
    powerValue: 190,
    isActive: true
  }
];
var SEED_ACHIEVEMENTS = [
  {
    slug: "quiz_explorer",
    code: "QUIZ_EXPLORER",
    title: "Quiz Explorer",
    description: "Complete your first live classroom quiz together as a team.",
    powerValue: 100,
    coinReward: 50,
    ruleType: "quizzes_completed",
    threshold: 1
  },
  {
    slug: "first_victory",
    code: "FIRST_VICTORY",
    title: "First Victory",
    description: "Earn Rank #1 in a live classroom quiz competition.",
    powerValue: 200,
    coinReward: 100,
    ruleType: "first_place_wins",
    threshold: 1
  },
  {
    slug: "perfect_score",
    code: "PERFECT_SCORE",
    title: "Perfect Score",
    description: "Answer every single question right in a classroom quiz!",
    powerValue: 250,
    coinReward: 150,
    ruleType: "perfect_quiz",
    threshold: 1
  },
  {
    slug: "teamwork_champion",
    code: "TEAMWORK_CHAMPION",
    title: "Teamwork Champion",
    description: "Complete 3 classroom quizzes with your teammates.",
    powerValue: 180,
    coinReward: 100,
    ruleType: "quizzes_completed",
    threshold: 3
  },
  {
    slug: "consistent_learners",
    code: "CONSISTENT_LEARNERS",
    title: "Consistent Learners",
    description: "Complete 5 classroom quizzes across the academic year.",
    powerValue: 300,
    coinReward: 150,
    ruleType: "quizzes_completed",
    threshold: 5
  },
  {
    slug: "creature_collector",
    code: "CREATURE_COLLECTOR",
    title: "Creature Collector",
    description: "Adopt 3 original fantasy creatures into your team collection.",
    powerValue: 200,
    coinReward: 100,
    ruleType: "creatures_owned",
    threshold: 3
  },
  {
    slug: "island_builder",
    code: "ISLAND_BUILDER",
    title: "Island Builder",
    description: "Acquire 3 buildings or decorations for your floating island.",
    powerValue: 160,
    coinReward: 80,
    ruleType: "items_owned",
    threshold: 3
  },
  {
    slug: "challenge_conquerors",
    code: "CHALLENGE_CONQUERORS",
    title: "Challenge Conquerors",
    description: "Grow your island to 1,500 lifetime Island Power.",
    powerValue: 250,
    coinReward: 120,
    ruleType: "island_power",
    threshold: 1500
  }
];
async function runSeed() {
  const markerRef = adminDb.collection("config").doc("seed_v1");
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const batch = adminDb.batch();
  batch.set(adminDb.collection("test").doc("connection"), { ok: true, updatedAt: nowIso }, { merge: true });
  batch.set(adminDb.collection("config").doc("game_rules"), DEFAULT_GAME_RULES, { merge: true });
  const creatureIds = [];
  for (const c of SEED_CREATURES) {
    const id = `creature_${c.artKey}`;
    creatureIds.push(id);
    batch.set(adminDb.collection("creatures").doc(id), { id, ...c }, { merge: true });
  }
  for (const item of SEED_ITEMS) {
    const id = `item_${item.slug}`;
    batch.set(
      adminDb.collection("catalog_items").doc(id),
      {
        id,
        category: item.category,
        name: item.name,
        description: item.description,
        artKey: item.artKey,
        price: item.price,
        powerValue: item.powerValue,
        isActive: item.isActive
      },
      { merge: true }
    );
  }
  for (const ach of SEED_ACHIEVEMENTS) {
    const id = `ach_${ach.slug}`;
    batch.set(
      adminDb.collection("achievements").doc(id),
      {
        id,
        code: ach.code,
        title: ach.title,
        description: ach.description,
        powerValue: ach.powerValue,
        coinReward: ach.coinReward,
        ruleType: ach.ruleType,
        threshold: ach.threshold
      },
      { merge: true }
    );
  }
  const teacherId = "teacher_rivera";
  batch.set(
    adminDb.collection("teachers").doc(teacherId),
    {
      uid: teacherId,
      email: "teacher@quiztopia.edu",
      displayName: "Ms. Rivera",
      role: "teacher",
      passwordHash: hashPassword("Quiztopia2026!"),
      createdAt: nowIso
    },
    { merge: true }
  );
  const classId = "class_grade4_explorers";
  batch.set(
    adminDb.collection("classes").doc(classId),
    {
      id: classId,
      teacherId,
      name: "Grade 4 Explorers",
      gradeLevel: "Grade 4",
      academicYearLabel: "2026-2027",
      activeTermNumber: 1,
      createdAt: nowIso
    },
    { merge: true }
  );
  for (const termNum of [1, 2, 3]) {
    const termId = `${classId}_term_${termNum}`;
    batch.set(
      adminDb.collection("academic_terms").doc(termId),
      {
        id: termId,
        classId,
        academicYearLabel: "2026-2027",
        termNumber: termNum,
        name: `Term ${termNum}`,
        status: termNum === 1 ? "active" : "upcoming"
      },
      { merge: true }
    );
  }
  const sampleTeams = [
    {
      id: "team_star_guardians",
      name: "Star Guardians",
      username: "star",
      password: "star123",
      members: ["Alex", "Mia", "Kai"],
      coins: 650,
      avatar: { ...DEFAULT_AVATAR, primaryColor: "#6D28D9", accentColor: "#F59E0B", accessory: "wizard_hat" },
      starterCreatures: ["creature_lumibun", "creature_crystal_wisp"]
    },
    {
      id: "team_moonlight_crew",
      name: "Moonlight Crew",
      username: "moon",
      password: "moon123",
      members: ["Luna", "Noah", "Zoe", "Leo"],
      coins: 520,
      avatar: {
        characterType: "explorer",
        hairStyle: "curly",
        faceStyle: "curious",
        clothingStyle: "cape",
        accessory: "crown",
        primaryColor: "#2563EB",
        accentColor: "#38BDF8"
      },
      starterCreatures: ["creature_moonfox"]
    },
    {
      id: "team_crystal_keepers",
      name: "Crystal Keepers",
      username: "crystal",
      password: "crystal123",
      members: ["Maya", "Owen", "Aria"],
      coins: 480,
      avatar: {
        characterType: "scholar",
        hairStyle: "short",
        faceStyle: "sparkle",
        clothingStyle: "vest",
        accessory: "glasses",
        primaryColor: "#059669",
        accentColor: "#FBBF24"
      },
      starterCreatures: ["creature_sproutling"]
    },
    {
      id: "team_sky_explorers",
      name: "Sky Explorers",
      username: "sky",
      password: "sky123",
      members: ["Eli", "Nora"],
      coins: 440,
      avatar: {
        characterType: "knight",
        hairStyle: "spiky",
        faceStyle: "determined",
        clothingStyle: "tunic",
        accessory: "star_pin",
        primaryColor: "#EA580C",
        accentColor: "#FACC15"
      },
      starterCreatures: ["creature_emberling"]
    }
  ];
  for (const t of sampleTeams) {
    const memberObjects = t.members.map((nickname, idx) => ({
      id: `${t.id}_m${idx + 1}`,
      nickname
    }));
    const captain = memberObjects[0];
    batch.set(
      adminDb.collection("teams").doc(t.id),
      {
        id: t.id,
        classId,
        teacherId,
        name: t.name,
        username: t.username,
        passwordHash: hashPassword(t.password),
        members: memberObjects,
        captainMemberId: captain.id,
        captainName: captain.nickname,
        createdAt: nowIso
      },
      { merge: true }
    );
    batch.set(adminDb.collection("team_avatars").doc(t.id), t.avatar, { merge: true });
    batch.set(
      adminDb.collection("team_wallets").doc(t.id),
      {
        teamId: t.id,
        balance: t.coins,
        updatedAt: nowIso
      },
      { merge: true }
    );
    batch.set(
      adminDb.collection("coin_transactions").doc(`seed_tx_${t.id}`),
      {
        id: `seed_tx_${t.id}`,
        teamId: t.id,
        amount: t.coins,
        txType: "teacher_bonus",
        reason: "Welcome Adventure Grant",
        referenceId: classId,
        createdAt: nowIso
      },
      { merge: true }
    );
    const starterInvId = `seed_inv_${t.id}_castle`;
    batch.set(
      adminDb.collection("team_inventory_items").doc(starterInvId),
      {
        id: starterInvId,
        teamId: t.id,
        itemId: "item_central_castle",
        purchasedAt: nowIso
      },
      { merge: true }
    );
    let creaturePower = 0;
    for (const cid of t.starterCreatures) {
      const tcId = `seed_tc_${t.id}_${cid}`;
      batch.set(
        adminDb.collection("team_creatures").doc(tcId),
        {
          id: tcId,
          teamId: t.id,
          creatureId: cid,
          acquiredAt: nowIso
        },
        { merge: true }
      );
      const found = SEED_CREATURES.find((c) => `creature_${c.artKey}` === cid);
      creaturePower += found?.powerValue ?? 0;
    }
    const totalPower = 300 + creaturePower;
    batch.set(
      adminDb.collection("team_islands").doc(t.id),
      {
        teamId: t.id,
        theme: "emerald_isle",
        termPower: totalPower,
        lifetimePower: totalPower,
        teacherBonusPower: 0,
        seasonBaselinePower: 0,
        placements: [
          {
            id: `place_${t.id}_castle`,
            inventoryItemId: starterInvId,
            itemId: "item_central_castle",
            name: "Starlight Keep",
            category: "building",
            artKey: "central_castle",
            slotIndex: 2
          }
        ],
        updatedAt: nowIso
      },
      { merge: true }
    );
  }
  batch.set(
    adminDb.collection("quizzes").doc("quiz_solar_system"),
    {
      id: "quiz_solar_system",
      teacherId,
      classId,
      termNumber: 1,
      title: "Solar System Expedition",
      subject: "Science",
      description: "Journey across the planets with your team and unlock cosmic rewards!",
      status: "published",
      speedBonusEnabled: true,
      questions: [
        {
          id: "q_ss_1",
          orderIndex: 0,
          questionType: "multiple_choice",
          prompt: "Which planet is known as the Red Planet?",
          points: 100,
          timeLimitSec: 25,
          options: [
            { id: "q_ss_1_a", label: "Earth", isCorrect: false },
            { id: "q_ss_1_b", label: "Mars", isCorrect: true },
            { id: "q_ss_1_c", label: "Jupiter", isCorrect: false },
            { id: "q_ss_1_d", label: "Venus", isCorrect: false }
          ]
        },
        {
          id: "q_ss_2",
          orderIndex: 1,
          questionType: "multiple_choice",
          prompt: "Which is the largest planet in our Solar System?",
          points: 100,
          timeLimitSec: 25,
          options: [
            { id: "q_ss_2_a", label: "Saturn", isCorrect: false },
            { id: "q_ss_2_b", label: "Neptune", isCorrect: false },
            { id: "q_ss_2_c", label: "Jupiter", isCorrect: true },
            { id: "q_ss_2_d", label: "Mercury", isCorrect: false }
          ]
        },
        {
          id: "q_ss_3",
          orderIndex: 2,
          questionType: "multiple_choice",
          prompt: "What star sits at the center of our Solar System?",
          points: 100,
          timeLimitSec: 20,
          options: [
            { id: "q_ss_3_a", label: "The Sun", isCorrect: true },
            { id: "q_ss_3_b", label: "Polaris", isCorrect: false },
            { id: "q_ss_3_c", label: "Sirius", isCorrect: false },
            { id: "q_ss_3_d", label: "The Moon", isCorrect: false }
          ]
        },
        {
          id: "q_ss_4",
          orderIndex: 3,
          questionType: "multiple_choice",
          prompt: "Which planet is famous for its bright icy rings?",
          points: 120,
          timeLimitSec: 25,
          options: [
            { id: "q_ss_4_a", label: "Mars", isCorrect: false },
            { id: "q_ss_4_b", label: "Venus", isCorrect: false },
            { id: "q_ss_4_c", label: "Saturn", isCorrect: true },
            { id: "q_ss_4_d", label: "Mercury", isCorrect: false }
          ]
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    },
    { merge: true }
  );
  batch.set(
    adminDb.collection("quizzes").doc("quiz_fractions_quest"),
    {
      id: "quiz_fractions_quest",
      teacherId,
      classId,
      termNumber: 1,
      title: "Fraction Island Quest",
      subject: "Mathematics",
      description: "Work together to solve enchanted fraction puzzles!",
      status: "published",
      speedBonusEnabled: false,
      questions: [
        {
          id: "q_fq_1",
          orderIndex: 0,
          questionType: "multiple_choice",
          prompt: "If you cut a magical pie into 4 equal slices and eat 1 slice, what fraction is left?",
          points: 100,
          timeLimitSec: 30,
          options: [
            { id: "q_fq_1_a", label: "1/4", isCorrect: false },
            { id: "q_fq_1_b", label: "3/4", isCorrect: true },
            { id: "q_fq_1_c", label: "2/4", isCorrect: false },
            { id: "q_fq_1_d", label: "4/3", isCorrect: false }
          ]
        },
        {
          id: "q_fq_2",
          orderIndex: 1,
          questionType: "multiple_choice",
          prompt: "Which fraction is equivalent to 1/2?",
          points: 100,
          timeLimitSec: 30,
          options: [
            { id: "q_fq_2_a", label: "2/6", isCorrect: false },
            { id: "q_fq_2_b", label: "3/5", isCorrect: false },
            { id: "q_fq_2_c", label: "4/8", isCorrect: true },
            { id: "q_fq_2_d", label: "1/3", isCorrect: false }
          ]
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    },
    { merge: true }
  );
  batch.set(markerRef, { seededAt: nowIso, version: 1 });
  await batch.commit();
}
async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

// server/routes/authRoutes.ts
var authRouter = Router();
authRouter.get("/me", async (req, res) => {
  try {
    await ensureSeeded();
    if (!req.sessionUser) {
      res.json({ user: null });
      return;
    }
    res.json({ user: req.sessionUser });
  } catch (err) {
    console.error("GET /api/auth/me failed:", err);
    res.status(500).json({ error: "Unable to check authentication status." });
  }
});
authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
authRouter.post("/team/login", async (req, res) => {
  try {
    await ensureSeeded();
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      res.status(400).json({ error: "Please enter both Team Username and Password." });
      return;
    }
    const snap = await adminDb.collection("teams").where("username", "==", username).limit(1).get();
    if (snap.empty) {
      res.status(401).json({ error: "Invalid team username or password." });
      return;
    }
    const teamDoc = snap.docs[0];
    const team = teamDoc.data();
    if (!team.passwordHash || !verifyPassword(password, String(team.passwordHash))) {
      res.status(401).json({ error: "Invalid team username or password." });
      return;
    }
    const sessionUser = {
      role: "team",
      uid: team.id,
      teamId: team.id,
      classId: team.classId,
      teacherId: team.teacherId,
      displayName: team.name
    };
    const token = setSessionCookie(res, sessionUser);
    res.json({ user: sessionUser, token });
  } catch (err) {
    console.error("Team login error:", err);
    res.status(500).json({ error: "Team login failed. Please try again." });
  }
});
authRouter.post("/teacher/login", async (req, res) => {
  try {
    await ensureSeeded();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      res.status(400).json({ error: "Please enter both email and password." });
      return;
    }
    const snap = await adminDb.collection("teachers").where("email", "==", email).limit(1).get();
    if (snap.empty) {
      res.status(401).json({ error: "Invalid teacher email or password." });
      return;
    }
    const teacher = snap.docs[0].data();
    if (!teacher.passwordHash || !verifyPassword(password, String(teacher.passwordHash))) {
      res.status(401).json({ error: "Invalid teacher email or password." });
      return;
    }
    const sessionUser = {
      role: "teacher",
      uid: teacher.uid,
      displayName: teacher.displayName,
      email: teacher.email
    };
    const token = setSessionCookie(res, sessionUser);
    res.json({ user: sessionUser, token });
  } catch (err) {
    console.error("Teacher login error:", err);
    res.status(500).json({ error: "Teacher login failed. Please try again." });
  }
});
authRouter.post("/teacher/register", async (req, res) => {
  try {
    await ensureSeeded();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const displayName = String(req.body?.displayName || "").trim();
    const password = String(req.body?.password || "");
    if (!email || !displayName || password.length < 6) {
      res.status(400).json({ error: "Provide a valid name, email, and a password of at least 6 characters." });
      return;
    }
    const existing = await adminDb.collection("teachers").where("email", "==", email).limit(1).get();
    if (!existing.empty) {
      res.status(409).json({ error: "A teacher account with that email already exists." });
      return;
    }
    const uid = `teacher_${crypto2.randomUUID().slice(0, 12)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await adminDb.collection("teachers").doc(uid).set({
      uid,
      email,
      displayName,
      role: "teacher",
      passwordHash: hashPassword(password),
      createdAt: nowIso
    });
    const sessionUser = {
      role: "teacher",
      uid,
      displayName,
      email
    };
    const token = setSessionCookie(res, sessionUser);
    res.status(201).json({ user: sessionUser, token });
  } catch (err) {
    console.error("Teacher register error:", err);
    res.status(500).json({ error: "Could not register teacher account." });
  }
});
authRouter.post("/teacher/firebase", async (req, res) => {
  try {
    await ensureSeeded();
    const idToken = String(req.body?.idToken || "");
    if (!idToken) {
      res.status(400).json({ error: "Missing Firebase ID token." });
      return;
    }
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = (decoded.email || "").toLowerCase();
    const displayName = decoded.name || email.split("@")[0] || "Teacher";
    await adminDb.collection("teachers").doc(uid).set(
      {
        uid,
        email,
        displayName,
        role: "teacher",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      { merge: true }
    );
    const sessionUser = {
      role: "teacher",
      uid,
      displayName,
      email
    };
    const token = setSessionCookie(res, sessionUser);
    res.json({ user: sessionUser, token });
  } catch (err) {
    console.error("Firebase teacher auth failed:", err);
    res.status(401).json({ error: "Invalid or expired Google Sign-In token." });
  }
});

// server/routes/teacherRoutes.ts
import crypto5 from "node:crypto";
import { Router as Router2 } from "express";

// server/services/economy.ts
import crypto3 from "node:crypto";
async function getGameRules() {
  const snap = await adminDb.collection("config").doc("game_rules").get();
  if (!snap.exists) return DEFAULT_GAME_RULES;
  return { ...DEFAULT_GAME_RULES, ...snap.data() };
}
async function recalculateTeamIslandPower(teamId) {
  const rules = await getGameRules();
  const [islandSnap, teamCreaturesSnap, teamItemsSnap, teamAchSnap, creaturesSnap, itemsSnap, achSnap] = await Promise.all([
    adminDb.collection("team_islands").doc(teamId).get(),
    adminDb.collection("team_creatures").where("teamId", "==", teamId).get(),
    adminDb.collection("team_inventory_items").where("teamId", "==", teamId).get(),
    adminDb.collection("team_achievements").where("teamId", "==", teamId).get(),
    adminDb.collection("creatures").get(),
    adminDb.collection("catalog_items").get(),
    adminDb.collection("achievements").get()
  ]);
  const creaturePowerMap = /* @__PURE__ */ new Map();
  for (const doc of creaturesSnap.docs) {
    creaturePowerMap.set(doc.id, Number(doc.data().powerValue || 0));
  }
  const itemPowerMap = /* @__PURE__ */ new Map();
  for (const doc of itemsSnap.docs) {
    itemPowerMap.set(doc.id, Number(doc.data().powerValue || 0));
  }
  const achPowerMap = /* @__PURE__ */ new Map();
  for (const doc of achSnap.docs) {
    achPowerMap.set(doc.id, Number(doc.data().powerValue || 0));
  }
  let creaturePowerSum = 0;
  for (const doc of teamCreaturesSnap.docs) {
    const cid = doc.data().creatureId;
    creaturePowerSum += creaturePowerMap.get(cid) ?? 0;
  }
  let buildingPowerSum = 0;
  for (const doc of teamItemsSnap.docs) {
    const iid = doc.data().itemId;
    buildingPowerSum += itemPowerMap.get(iid) ?? 0;
  }
  let achievementPowerSum = 0;
  for (const doc of teamAchSnap.docs) {
    const aid = doc.data().achievementId;
    achievementPowerSum += achPowerMap.get(aid) ?? 0;
  }
  const islandData = islandSnap.exists ? islandSnap.data() : {};
  const teacherBonusPower = Number(islandData?.teacherBonusPower ?? 0);
  const seasonBaselinePower = Number(islandData?.seasonBaselinePower ?? 0);
  const breakdown = calculateIslandPower({
    creaturePowerSum,
    buildingPowerSum,
    achievementPowerSum,
    teacherBonusPower,
    rules
  });
  const termPower = Math.max(0, breakdown.totalPower - seasonBaselinePower);
  await adminDb.collection("team_islands").doc(teamId).set(
    {
      teamId,
      theme: islandData?.theme || "emerald_isle",
      termPower,
      lifetimePower: breakdown.totalPower,
      teacherBonusPower,
      seasonBaselinePower,
      placements: Array.isArray(islandData?.placements) ? islandData.placements : [],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    { merge: true }
  );
  return {
    ...breakdown,
    totalPower: termPower
  };
}
async function awardCoins(params) {
  const amount = Math.round(params.amount);
  if (amount <= 0) {
    throw new Error("Coin award amount must be positive.");
  }
  const txId = params.idempotencyKey || crypto3.randomUUID();
  const txRef = adminDb.collection("coin_transactions").doc(txId);
  const walletRef = adminDb.collection("team_wallets").doc(params.teamId);
  const result = await adminDb.runTransaction(async (tx) => {
    const existingTx = await tx.get(txRef);
    const walletSnap = await tx.get(walletRef);
    const currentBalance = walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0;
    if (existingTx.exists) {
      return { newBalance: currentBalance, duplicate: true };
    }
    const nextBalance = currentBalance + amount;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    tx.set(
      walletRef,
      {
        teamId: params.teamId,
        balance: nextBalance,
        updatedAt: nowIso
      },
      { merge: true }
    );
    tx.set(txRef, {
      id: txId,
      teamId: params.teamId,
      amount,
      txType: params.txType,
      reason: params.reason,
      referenceId: params.referenceId || null,
      createdAt: nowIso
    });
    return { newBalance: nextBalance, duplicate: false };
  });
  return result;
}
async function evaluateTeamAchievements(teamId) {
  const [achSnap, unlockedSnap, resultsSnap, creaturesSnap, itemsSnap, islandSnap] = await Promise.all([
    adminDb.collection("achievements").get(),
    adminDb.collection("team_achievements").where("teamId", "==", teamId).get(),
    adminDb.collection("quiz_results").where("teamId", "==", teamId).get(),
    adminDb.collection("team_creatures").where("teamId", "==", teamId).get(),
    adminDb.collection("team_inventory_items").where("teamId", "==", teamId).get(),
    adminDb.collection("team_islands").doc(teamId).get()
  ]);
  const alreadyUnlocked = /* @__PURE__ */ new Set();
  for (const doc of unlockedSnap.docs) {
    alreadyUnlocked.add(doc.data().achievementId);
  }
  const quizzesCompleted = resultsSnap.size;
  let firstPlaceWins = 0;
  let perfectQuizCount = 0;
  for (const doc of resultsSnap.docs) {
    const r = doc.data();
    if (Number(r.rank) === 1) firstPlaceWins += 1;
    if (Number(r.totalQuestions) > 0 && Number(r.correctCount) >= Number(r.totalQuestions)) {
      perfectQuizCount += 1;
    }
  }
  const creaturesOwned = creaturesSnap.size;
  const itemsOwned = itemsSnap.size;
  const lifetimePower = islandSnap.exists ? Number(islandSnap.data()?.lifetimePower ?? 0) : 0;
  const newlyUnlocked = [];
  for (const doc of achSnap.docs) {
    const ach = { id: doc.id, ...doc.data() };
    if (alreadyUnlocked.has(ach.id)) continue;
    let met = false;
    switch (ach.ruleType) {
      case "quizzes_completed":
        met = quizzesCompleted >= ach.threshold;
        break;
      case "first_place_wins":
        met = firstPlaceWins >= ach.threshold;
        break;
      case "perfect_quiz":
        met = perfectQuizCount >= ach.threshold;
        break;
      case "creatures_owned":
        met = creaturesOwned >= ach.threshold;
        break;
      case "items_owned":
        met = itemsOwned >= ach.threshold;
        break;
      case "island_power":
        met = lifetimePower >= ach.threshold;
        break;
    }
    if (met) {
      const unlockDocId = `${teamId}_${ach.id}`;
      const unlockRef = adminDb.collection("team_achievements").doc(unlockDocId);
      const inserted = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(unlockRef);
        if (snap.exists) return false;
        tx.set(unlockRef, {
          id: unlockDocId,
          teamId,
          achievementId: ach.id,
          unlockedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        return true;
      });
      if (inserted) {
        newlyUnlocked.push(ach);
        if (ach.coinReward > 0) {
          await awardCoins({
            teamId,
            amount: ach.coinReward,
            txType: "achievement_reward",
            reason: `Achievement Unlocked: ${ach.title}`,
            referenceId: ach.id,
            idempotencyKey: `ach_reward_${teamId}_${ach.id}`
          });
        }
      }
    }
  }
  if (newlyUnlocked.length > 0) {
    await recalculateTeamIslandPower(teamId);
  }
  return newlyUnlocked;
}
async function purchaseCreature(params) {
  const creatureSnap = await adminDb.collection("creatures").doc(params.creatureId).get();
  if (!creatureSnap.exists) {
    throw new Error("NOT_FOUND: Fantasy creature not found.");
  }
  const creature = { id: creatureSnap.id, ...creatureSnap.data() };
  if (!creature.isActive) {
    throw new Error("BAD_REQUEST: This creature is currently unavailable.");
  }
  const txRef = adminDb.collection("coin_transactions").doc(params.idempotencyKey);
  const walletRef = adminDb.collection("team_wallets").doc(params.teamId);
  const teamCreatureId = crypto3.randomUUID();
  const tcRef = adminDb.collection("team_creatures").doc(teamCreatureId);
  const txResult = await adminDb.runTransaction(async (tx) => {
    const existingTx = await tx.get(txRef);
    if (existingTx.exists) {
      throw new Error("CONFLICT: Duplicate purchase transaction detected.");
    }
    const walletSnap = await tx.get(walletRef);
    const currentBalance = walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0;
    if (currentBalance < creature.price) {
      throw new Error("BAD_REQUEST: Insufficient team coins for this creature.");
    }
    const nextBalance = currentBalance - creature.price;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    tx.set(
      walletRef,
      {
        teamId: params.teamId,
        balance: nextBalance,
        updatedAt: nowIso
      },
      { merge: true }
    );
    tx.set(txRef, {
      id: params.idempotencyKey,
      teamId: params.teamId,
      amount: -creature.price,
      txType: "creature_purchase",
      reason: `Adopted ${creature.name}`,
      referenceId: creature.id,
      createdAt: nowIso
    });
    tx.set(tcRef, {
      id: teamCreatureId,
      teamId: params.teamId,
      creatureId: creature.id,
      acquiredAt: nowIso
    });
    return { newBalance: nextBalance };
  });
  const power = await recalculateTeamIslandPower(params.teamId);
  await evaluateTeamAchievements(params.teamId);
  const latestIsland = await adminDb.collection("team_islands").doc(params.teamId).get();
  return {
    newBalance: txResult.newBalance,
    teamCreatureId,
    creature,
    islandPower: latestIsland.exists ? Number(latestIsland.data()?.termPower ?? power.totalPower) : power.totalPower
  };
}
async function purchaseCatalogItem(params) {
  const itemSnap = await adminDb.collection("catalog_items").doc(params.itemId).get();
  if (!itemSnap.exists) {
    throw new Error("NOT_FOUND: Island item not found.");
  }
  const item = { id: itemSnap.id, ...itemSnap.data() };
  if (!item.isActive) {
    throw new Error("BAD_REQUEST: This island item is currently unavailable.");
  }
  const txRef = adminDb.collection("coin_transactions").doc(params.idempotencyKey);
  const walletRef = adminDb.collection("team_wallets").doc(params.teamId);
  const inventoryItemId = crypto3.randomUUID();
  const invRef = adminDb.collection("team_inventory_items").doc(inventoryItemId);
  const txResult = await adminDb.runTransaction(async (tx) => {
    const existingTx = await tx.get(txRef);
    if (existingTx.exists) {
      throw new Error("CONFLICT: Duplicate purchase transaction detected.");
    }
    const walletSnap = await tx.get(walletRef);
    const currentBalance = walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0;
    if (currentBalance < item.price) {
      throw new Error("BAD_REQUEST: Insufficient team coins for this island item.");
    }
    const nextBalance = currentBalance - item.price;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    tx.set(
      walletRef,
      {
        teamId: params.teamId,
        balance: nextBalance,
        updatedAt: nowIso
      },
      { merge: true }
    );
    tx.set(txRef, {
      id: params.idempotencyKey,
      teamId: params.teamId,
      amount: -item.price,
      txType: "item_purchase",
      reason: `Built ${item.name}`,
      referenceId: item.id,
      createdAt: nowIso
    });
    tx.set(invRef, {
      id: inventoryItemId,
      teamId: params.teamId,
      itemId: item.id,
      purchasedAt: nowIso
    });
    return { newBalance: nextBalance };
  });
  const power = await recalculateTeamIslandPower(params.teamId);
  await evaluateTeamAchievements(params.teamId);
  const latestIsland = await adminDb.collection("team_islands").doc(params.teamId).get();
  return {
    newBalance: txResult.newBalance,
    inventoryItemId,
    item,
    islandPower: latestIsland.exists ? Number(latestIsland.data()?.termPower ?? power.totalPower) : power.totalPower
  };
}

// server/services/quizEngine.ts
import crypto4 from "node:crypto";
var roomClients = /* @__PURE__ */ new Map();
var questionTimers = /* @__PURE__ */ new Map();
async function broadcastSessionState(sessionId) {
  const clients = roomClients.get(sessionId);
  if (!clients || clients.size === 0) return;
  for (const client of clients) {
    if (client.ws.readyState !== client.ws.OPEN) continue;
    try {
      const state = await buildSessionStateForUser(sessionId, client.user);
      if (state) {
        client.ws.send(JSON.stringify({ type: "quiz:state", payload: state }));
      }
    } catch (err) {
      console.error("Failed to broadcast quiz state:", err);
    }
  }
}
function scheduleQuestionTimer(sessionId, endsAt) {
  const existing = questionTimers.get(sessionId);
  if (existing) clearTimeout(existing);
  const delay = Math.max(0, endsAt - Date.now() + 250);
  const timer = setTimeout(async () => {
    questionTimers.delete(sessionId);
    try {
      const snap = await adminDb.collection("quiz_sessions").doc(sessionId).get();
      if (!snap.exists) return;
      const data = snap.data();
      if (data.status === "active" && !data.questionRevealed && data.questionEndsAt <= Date.now()) {
        await adminDb.collection("quiz_sessions").doc(sessionId).update({
          questionRevealed: true
        });
        await broadcastSessionState(sessionId);
      }
    } catch (err) {
      console.error("Auto-reveal timer error:", err);
    }
  }, delay);
  questionTimers.set(sessionId, timer);
}
async function createQuizSession(params) {
  const quizSnap = await adminDb.collection("quizzes").doc(params.quizId).get();
  if (!quizSnap.exists) {
    throw new Error("NOT_FOUND: Quiz not found.");
  }
  const quiz = quizSnap.data();
  if (quiz.teacherId !== params.teacherId) {
    throw new Error("FORBIDDEN: You do not own this quiz.");
  }
  if (quiz.status !== "published") {
    throw new Error("BAD_REQUEST: Publish the quiz before hosting a live competition.");
  }
  if (!quiz.questions || quiz.questions.length === 0) {
    throw new Error("BAD_REQUEST: Add at least one question before hosting.");
  }
  let pinCode = "";
  for (let i = 0; i < 6; i++) {
    const candidate = String(Math.floor(1e5 + Math.random() * 9e5));
    const existingPin = await adminDb.collection("quiz_sessions").where("pinCode", "==", candidate).where("status", "in", ["lobby", "active"]).get();
    if (existingPin.empty) {
      pinCode = candidate;
      break;
    }
  }
  if (!pinCode) pinCode = String(Math.floor(1e5 + Math.random() * 9e5));
  const sessionId = `sess_${crypto4.randomUUID().slice(0, 12)}`;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  await adminDb.collection("quiz_sessions").doc(sessionId).set({
    id: sessionId,
    quizId: quiz.id,
    quizTitle: quiz.title,
    subject: quiz.subject,
    classId: quiz.classId,
    teacherId: params.teacherId,
    termNumber: quiz.termNumber,
    speedBonusEnabled: Boolean(quiz.speedBonusEnabled),
    pinCode,
    status: "lobby",
    currentQuestionIndex: -1,
    totalQuestions: quiz.questions.length,
    questionStartedAt: null,
    questionEndsAt: null,
    questionRevealed: false,
    createdAt: nowIso
  });
  return { sessionId, pinCode };
}
async function joinSessionByPin(params) {
  const cleanPin = params.pinCode.trim();
  const snap = await adminDb.collection("quiz_sessions").where("pinCode", "==", cleanPin).where("status", "in", ["lobby", "active"]).limit(1).get();
  if (snap.empty) {
    throw new Error("NOT_FOUND: No active quiz lobby found with that PIN.");
  }
  const sessionDoc = snap.docs[0];
  const session = sessionDoc.data();
  if (session.classId !== params.classId) {
    throw new Error("FORBIDDEN: This quiz belongs to a different classroom.");
  }
  return joinSessionById({ sessionId: sessionDoc.id, teamId: params.teamId, classId: params.classId });
}
async function joinSessionById(params) {
  const sessionRef = adminDb.collection("quiz_sessions").doc(params.sessionId);
  const participantId = `${params.sessionId}_${params.teamId}`;
  const participantRef = adminDb.collection("quiz_participants").doc(participantId);
  const teamRef = adminDb.collection("teams").doc(params.teamId);
  const avatarRef = adminDb.collection("team_avatars").doc(params.teamId);
  const outcome = await adminDb.runTransaction(async (tx) => {
    const [sessionSnap, partSnap, teamSnap, avatarSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(participantRef),
      tx.get(teamRef),
      tx.get(avatarRef)
    ]);
    if (!sessionSnap.exists) {
      throw new Error("NOT_FOUND: Quiz session not found.");
    }
    const session = sessionSnap.data();
    if (session.status === "finished") {
      throw new Error("BAD_REQUEST: This quiz has already ended.");
    }
    if (session.classId !== params.classId) {
      throw new Error("FORBIDDEN: This quiz belongs to a different classroom.");
    }
    if (!teamSnap.exists) {
      throw new Error("NOT_FOUND: Team not found.");
    }
    if (partSnap.exists) {
      return { alreadyJoined: true };
    }
    const teamData = teamSnap.data();
    const avatarData = avatarSnap.exists ? avatarSnap.data() : {};
    tx.set(participantRef, {
      id: participantId,
      sessionId: params.sessionId,
      teamId: params.teamId,
      teamName: teamData.name,
      avatar: avatarData,
      score: 0,
      correctCount: 0,
      joinedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { alreadyJoined: false };
  });
  await broadcastSessionState(params.sessionId);
  return { sessionId: params.sessionId, alreadyJoined: outcome.alreadyJoined };
}
async function startOrAdvanceSession(params) {
  const sessionRef = adminDb.collection("quiz_sessions").doc(params.sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new Error("NOT_FOUND: Session not found.");
  const session = sessionSnap.data();
  if (session.teacherId !== params.teacherId) throw new Error("FORBIDDEN: Not session host.");
  const quizSnap = await adminDb.collection("quizzes").doc(session.quizId).get();
  if (!quizSnap.exists) throw new Error("NOT_FOUND: Quiz not found.");
  const quiz = quizSnap.data();
  const sortedQuestions = [...quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex);
  if (params.action === "start") {
    if (session.status !== "lobby") {
      throw new Error("BAD_REQUEST: Quiz has already started.");
    }
    const q0 = sortedQuestions[0];
    const startedAt = Date.now();
    const endsAt = startedAt + q0.timeLimitSec * 1e3;
    await sessionRef.update({
      status: "active",
      currentQuestionIndex: 0,
      questionStartedAt: startedAt,
      questionEndsAt: endsAt,
      questionRevealed: false
    });
    scheduleQuestionTimer(params.sessionId, endsAt);
  } else if (params.action === "reveal") {
    if (session.status !== "active") throw new Error("BAD_REQUEST: Quiz is not active.");
    const timer = questionTimers.get(params.sessionId);
    if (timer) {
      clearTimeout(timer);
      questionTimers.delete(params.sessionId);
    }
    await sessionRef.update({ questionRevealed: true });
  } else if (params.action === "next") {
    if (session.status !== "active") throw new Error("BAD_REQUEST: Quiz is not active.");
    const nextIdx = Number(session.currentQuestionIndex) + 1;
    if (nextIdx >= sortedQuestions.length) {
      return finishQuizSession(params.sessionId);
    }
    const nextQ = sortedQuestions[nextIdx];
    const startedAt = Date.now();
    const endsAt = startedAt + nextQ.timeLimitSec * 1e3;
    await sessionRef.update({
      currentQuestionIndex: nextIdx,
      questionStartedAt: startedAt,
      questionEndsAt: endsAt,
      questionRevealed: false
    });
    scheduleQuestionTimer(params.sessionId, endsAt);
  } else if (params.action === "end") {
    return finishQuizSession(params.sessionId);
  }
  await broadcastSessionState(params.sessionId);
  return buildSessionStateForUser(params.sessionId, {
    role: "teacher",
    uid: params.teacherId,
    displayName: "Teacher"
  });
}
async function finishQuizSession(sessionId) {
  const timer = questionTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    questionTimers.delete(sessionId);
  }
  const sessionRef = adminDb.collection("quiz_sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new Error("NOT_FOUND: Session not found.");
  const session = sessionSnap.data();
  const participantsSnap = await adminDb.collection("quiz_participants").where("sessionId", "==", sessionId).get();
  const rules = await getGameRules();
  const participants = participantsSnap.docs.map((d) => d.data());
  participants.sort((a, b) => b.score - a.score || b.correctCount - a.correctCount);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const totalQuestions = Number(session.totalQuestions || 0);
  let currentRank = 1;
  for (let i = 0; i < participants.length; i++) {
    if (i > 0 && participants[i].score < participants[i - 1].score) {
      currentRank = i + 1;
    }
    const p = participants[i];
    const coinsAwarded = calculateQuizCoins({
      rank: currentRank,
      correctCount: p.correctCount,
      rules
    });
    const resultId = `${sessionId}_${p.teamId}`;
    await adminDb.collection("quiz_results").doc(resultId).set(
      {
        id: resultId,
        sessionId,
        quizId: session.quizId,
        quizTitle: session.quizTitle,
        subject: session.subject,
        classId: session.classId,
        termNumber: session.termNumber,
        teamId: p.teamId,
        teamName: p.teamName,
        avatar: p.avatar,
        rank: currentRank,
        correctCount: p.correctCount,
        totalQuestions,
        totalScore: p.score,
        coinsAwarded,
        finishedAt: nowIso
      },
      { merge: true }
    );
    if (coinsAwarded > 0) {
      await awardCoins({
        teamId: p.teamId,
        amount: coinsAwarded,
        txType: "quiz_reward",
        reason: `Quiz Reward: ${session.quizTitle} (Rank #${currentRank})`,
        referenceId: sessionId,
        idempotencyKey: `quiz_reward_${sessionId}_${p.teamId}`
      });
    }
    await evaluateTeamAchievements(p.teamId);
  }
  await sessionRef.update({
    status: "finished",
    questionRevealed: true,
    finishedAt: nowIso
  });
  await broadcastSessionState(sessionId);
  return buildSessionStateForUser(sessionId, {
    role: "teacher",
    uid: session.teacherId,
    displayName: "Teacher"
  });
}
async function submitTeamAnswer(params) {
  const submittedAt = Date.now();
  const sessionRef = adminDb.collection("quiz_sessions").doc(params.sessionId);
  const participantRef = adminDb.collection("quiz_participants").doc(`${params.sessionId}_${params.teamId}`);
  const answerDocId = `${params.sessionId}_${params.questionId}_${params.teamId}`;
  const answerRef = adminDb.collection("team_answers").doc(answerDocId);
  const sessionPreSnap = await sessionRef.get();
  if (!sessionPreSnap.exists) {
    throw new Error("NOT_FOUND: Quiz session not found.");
  }
  const quizSnap = await adminDb.collection("quizzes").doc(sessionPreSnap.data().quizId).get();
  if (!quizSnap.exists) {
    throw new Error("NOT_FOUND: Quiz definition missing.");
  }
  const quiz = quizSnap.data();
  const sortedQuestions = [...quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex);
  await adminDb.runTransaction(async (tx) => {
    const [sessionSnap, partSnap, existingAnswerSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(participantRef),
      tx.get(answerRef)
    ]);
    if (!sessionSnap.exists) {
      throw new Error("NOT_FOUND: Quiz session not found.");
    }
    if (!partSnap.exists) {
      throw new Error("FORBIDDEN: Your team has not joined this quiz session.");
    }
    const session = sessionSnap.data();
    if (session.status !== "active") {
      throw new Error("BAD_REQUEST: Quiz is not currently active.");
    }
    if (session.questionRevealed) {
      throw new Error("BAD_REQUEST: Submissions are closed for this question.");
    }
    const activeQ = sortedQuestions[Number(session.currentQuestionIndex)];
    if (!activeQ || activeQ.id !== params.questionId) {
      throw new Error("BAD_REQUEST: That question is not currently active.");
    }
    if (!session.questionEndsAt || submittedAt > Number(session.questionEndsAt)) {
      throw new Error("BAD_REQUEST: Time has expired for this question.");
    }
    if (existingAnswerSnap.exists) {
      throw new Error("CONFLICT: Your team has already locked in an answer for this question.");
    }
    const chosenOption = activeQ.options.find((o) => o.id === params.optionId);
    if (!chosenOption) {
      throw new Error("BAD_REQUEST: Selected option does not belong to this question.");
    }
    const isCorrect = Boolean(chosenOption.isCorrect);
    const pointsAwarded = calculateQuestionScore({
      isCorrect,
      basePoints: activeQ.points,
      speedBonusEnabled: Boolean(session.speedBonusEnabled),
      questionStartedAt: Number(session.questionStartedAt),
      questionEndsAt: Number(session.questionEndsAt),
      submittedAt
    });
    tx.set(answerRef, {
      id: answerDocId,
      sessionId: params.sessionId,
      questionId: params.questionId,
      teamId: params.teamId,
      optionId: params.optionId,
      isCorrect,
      pointsAwarded,
      submittedAt
    });
    const pData = partSnap.data();
    tx.update(participantRef, {
      score: Number(pData.score || 0) + pointsAwarded,
      correctCount: Number(pData.correctCount || 0) + (isCorrect ? 1 : 0)
    });
  });
  await broadcastSessionState(params.sessionId);
  return {
    accepted: true,
    submittedAt,
    message: "Answer locked in!"
  };
}
async function buildSessionStateForUser(sessionId, user) {
  const sessionSnap = await adminDb.collection("quiz_sessions").doc(sessionId).get();
  if (!sessionSnap.exists) return null;
  const session = sessionSnap.data();
  const [quizSnap, partsSnap] = await Promise.all([
    adminDb.collection("quizzes").doc(session.quizId).get(),
    adminDb.collection("quiz_participants").where("sessionId", "==", sessionId).get()
  ]);
  if (!quizSnap.exists) return null;
  const quiz = quizSnap.data();
  const sortedQuestions = [...quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentQ = session.status === "active" && Number(session.currentQuestionIndex) >= 0 ? sortedQuestions[Number(session.currentQuestionIndex)] ?? null : null;
  const isRevealed = Boolean(session.questionRevealed) || session.questionEndsAt && Date.now() > Number(session.questionEndsAt);
  let answeredTeams = /* @__PURE__ */ new Set();
  let mySubmission = null;
  if (currentQ) {
    const answersSnap = await adminDb.collection("team_answers").where("sessionId", "==", sessionId).where("questionId", "==", currentQ.id).get();
    for (const doc of answersSnap.docs) {
      const ans = doc.data();
      answeredTeams.add(ans.teamId);
      if (user.role === "team" && ans.teamId === user.teamId) {
        mySubmission = {
          questionId: currentQ.id,
          optionId: ans.optionId,
          submittedAt: Number(ans.submittedAt),
          ...isRevealed ? {
            isCorrect: Boolean(ans.isCorrect),
            pointsAwarded: Number(ans.pointsAwarded)
          } : {}
        };
      }
    }
  }
  const participants = partsSnap.docs.map((d) => {
    const p = d.data();
    return {
      ...p,
      hasAnsweredCurrent: answeredTeams.has(p.teamId)
    };
  }).sort((a, b) => b.score - a.score);
  let results;
  if (session.status === "finished") {
    const resSnap = await adminDb.collection("quiz_results").where("sessionId", "==", sessionId).get();
    results = resSnap.docs.map((d) => d.data()).sort((a, b) => a.rank - b.rank);
  }
  const showCorrectToUser = user.role === "teacher" || isRevealed;
  return {
    id: session.id,
    quizId: session.quizId,
    quizTitle: session.quizTitle,
    subject: session.subject,
    classId: session.classId,
    termNumber: session.termNumber,
    pinCode: session.pinCode,
    status: session.status,
    currentQuestionIndex: Number(session.currentQuestionIndex),
    totalQuestions: sortedQuestions.length,
    questionStartedAt: session.questionStartedAt ? Number(session.questionStartedAt) : null,
    questionEndsAt: session.questionEndsAt ? Number(session.questionEndsAt) : null,
    questionRevealed: Boolean(isRevealed),
    speedBonusEnabled: Boolean(session.speedBonusEnabled),
    serverNow: Date.now(),
    currentQuestion: currentQ ? {
      id: currentQ.id,
      prompt: currentQ.prompt,
      points: currentQ.points,
      timeLimitSec: currentQ.timeLimitSec,
      options: currentQ.options.map((o) => ({
        id: o.id,
        label: o.label,
        ...showCorrectToUser ? { isCorrect: Boolean(o.isCorrect) } : {}
      }))
    } : null,
    participants,
    mySubmission,
    results
  };
}

// server/routes/teacherRoutes.ts
var teacherRouter = Router2();
teacherRouter.use(requireTeacher);
teacherRouter.get("/overview", async (req, res) => {
  try {
    await ensureSeeded();
    const teacherId = req.sessionUser.uid;
    const [classesSnap, teamsSnap, quizzesSnap, sessionsSnap] = await Promise.all([
      adminDb.collection("classes").where("teacherId", "==", teacherId).get(),
      adminDb.collection("teams").where("teacherId", "==", teacherId).get(),
      adminDb.collection("quizzes").where("teacherId", "==", teacherId).get(),
      adminDb.collection("quiz_sessions").where("teacherId", "==", teacherId).get()
    ]);
    const classes = classesSnap.docs.map((d) => d.data());
    const activeClass = classes[0] || null;
    const quizzes = quizzesSnap.docs.map((d) => d.data());
    const quizzesThisTerm = activeClass ? quizzes.filter((q) => q.classId === activeClass.id && q.termNumber === activeClass.activeTermNumber).length : quizzes.length;
    const recentSessions = sessionsSnap.docs.map((d) => d.data()).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 6);
    res.json({
      stats: {
        totalClasses: classes.length,
        totalTeams: teamsSnap.size,
        totalQuizzes: quizzes.length,
        quizzesThisTerm,
        activeTermNumber: activeClass?.activeTermNumber ?? 1,
        academicYearLabel: activeClass?.academicYearLabel ?? "2026-2027"
      },
      classes,
      recentSessions
    });
  } catch (err) {
    console.error("Teacher overview failed:", err);
    res.status(500).json({ error: "Unable to load teacher overview." });
  }
});
teacherRouter.get("/classes", async (req, res) => {
  try {
    await ensureSeeded();
    const teacherId = req.sessionUser.uid;
    const [classesSnap, teamsSnap, termsSnap] = await Promise.all([
      adminDb.collection("classes").where("teacherId", "==", teacherId).get(),
      adminDb.collection("teams").where("teacherId", "==", teacherId).get(),
      adminDb.collection("academic_terms").get()
    ]);
    const teamCounts = {};
    for (const d of teamsSnap.docs) {
      const cid = d.data().classId;
      teamCounts[cid] = (teamCounts[cid] || 0) + 1;
    }
    const termsByClass = /* @__PURE__ */ new Map();
    for (const d of termsSnap.docs) {
      const term = d.data();
      if (!termsByClass.has(term.classId)) termsByClass.set(term.classId, []);
      termsByClass.get(term.classId).push(term);
    }
    const classes = classesSnap.docs.map((d) => {
      const c = d.data();
      const terms = (termsByClass.get(c.id) || []).sort((a, b) => a.termNumber - b.termNumber);
      return {
        ...c,
        teamCount: teamCounts[c.id] || 0,
        terms
      };
    });
    res.json({ classes });
  } catch (err) {
    console.error("Get classes failed:", err);
    res.status(500).json({ error: "Unable to load classes." });
  }
});
teacherRouter.post("/classes", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const name = String(req.body?.name || "").trim();
    const gradeLevel = String(req.body?.gradeLevel || "").trim();
    const academicYearLabel = String(req.body?.academicYearLabel || "2026-2027").trim();
    if (!name || !gradeLevel || !academicYearLabel) {
      res.status(400).json({ error: "Class name, grade level, and academic year are required." });
      return;
    }
    const classId = `class_${crypto5.randomUUID().slice(0, 10)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await adminDb.collection("classes").doc(classId).set({
      id: classId,
      teacherId,
      name,
      gradeLevel,
      academicYearLabel,
      activeTermNumber: 1,
      createdAt: nowIso
    });
    for (const termNum of [1, 2, 3]) {
      const termId = `${classId}_term_${termNum}`;
      await adminDb.collection("academic_terms").doc(termId).set({
        id: termId,
        classId,
        academicYearLabel,
        termNumber: termNum,
        name: `Term ${termNum}`,
        status: termNum === 1 ? "active" : "upcoming"
      });
    }
    res.status(201).json({ id: classId });
  } catch (err) {
    console.error("Create class failed:", err);
    res.status(500).json({ error: "Unable to create class." });
  }
});
teacherRouter.put("/classes/:id", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const classId = String(req.params.id);
    const ref = adminDb.collection("classes").doc(classId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().teacherId !== teacherId) {
      res.status(404).json({ error: "Class not found." });
      return;
    }
    const name = String(req.body?.name || snap.data().name).trim();
    const gradeLevel = String(req.body?.gradeLevel || snap.data().gradeLevel).trim();
    const academicYearLabel = String(req.body?.academicYearLabel || snap.data().academicYearLabel).trim();
    await ref.update({ name, gradeLevel, academicYearLabel });
    res.json({ ok: true });
  } catch (err) {
    console.error("Update class failed:", err);
    res.status(500).json({ error: "Unable to update class." });
  }
});
teacherRouter.post("/classes/:id/terms/activate", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const classId = String(req.params.id);
    const termNumber = Number(req.body?.termNumber);
    if (![1, 2, 3].includes(termNumber)) {
      res.status(400).json({ error: "Term number must be 1, 2, or 3." });
      return;
    }
    const classRef = adminDb.collection("classes").doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists || classSnap.data().teacherId !== teacherId) {
      res.status(404).json({ error: "Class not found." });
      return;
    }
    await classRef.update({ activeTermNumber: termNumber });
    for (const n of [1, 2, 3]) {
      const termId = `${classId}_term_${n}`;
      const termRef = adminDb.collection("academic_terms").doc(termId);
      const tSnap = await termRef.get();
      const prevStatus = tSnap.exists ? tSnap.data().status : "upcoming";
      const nextStatus = n === termNumber ? "active" : prevStatus === "closed" ? "closed" : "upcoming";
      await termRef.set(
        {
          id: termId,
          classId,
          academicYearLabel: classSnap.data().academicYearLabel,
          termNumber: n,
          name: `Term ${n}`,
          status: nextStatus
        },
        { merge: true }
      );
    }
    res.json({ activeTermNumber: termNumber });
  } catch (err) {
    console.error("Activate term failed:", err);
    res.status(500).json({ error: "Unable to activate term." });
  }
});
teacherRouter.post("/classes/:id/terms/close-and-advance", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const classId = String(req.params.id);
    const classRef = adminDb.collection("classes").doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists || classSnap.data().teacherId !== teacherId) {
      res.status(404).json({ error: "Class not found." });
      return;
    }
    const cls = classSnap.data();
    const currentTermNum = Number(cls.activeTermNumber);
    const currentTermId = `${classId}_term_${currentTermNum}`;
    const teamsSnap = await adminDb.collection("teams").where("classId", "==", classId).get();
    const standings = await Promise.all(
      teamsSnap.docs.map(async (d) => {
        const [islandSnap, avatarSnap] = await Promise.all([
          adminDb.collection("team_islands").doc(d.id).get(),
          adminDb.collection("team_avatars").doc(d.id).get()
        ]);
        const island = islandSnap.exists ? islandSnap.data() : {};
        return {
          teamId: d.id,
          teamName: d.data().name,
          avatar: avatarSnap.exists ? avatarSnap.data() : DEFAULT_AVATAR,
          termPower: Number(island.termPower ?? 0),
          lifetimePower: Number(island.lifetimePower ?? 0)
        };
      })
    );
    standings.sort((a, b) => b.termPower - a.termPower);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let rank = 1;
    const archivedEntries = [];
    for (let i = 0; i < standings.length; i++) {
      if (i > 0 && standings[i].termPower < standings[i - 1].termPower) {
        rank = i + 1;
      }
      const s = standings[i];
      const rankDocId = `${currentTermId}_${s.teamId}`;
      const entry = {
        id: rankDocId,
        termId: currentTermId,
        classId,
        academicYearLabel: cls.academicYearLabel,
        termNumber: currentTermNum,
        teamId: s.teamId,
        teamName: s.teamName,
        avatar: s.avatar,
        finalIslandPower: s.termPower,
        finalRank: rank,
        isChampion: rank === 1,
        archivedAt: nowIso
      };
      archivedEntries.push(entry);
      await adminDb.collection("term_rankings").doc(rankDocId).set(entry, { merge: true });
      await adminDb.collection("team_islands").doc(s.teamId).set(
        {
          termPower: 0,
          seasonBaselinePower: s.lifetimePower,
          updatedAt: nowIso
        },
        { merge: true }
      );
    }
    await adminDb.collection("academic_terms").doc(currentTermId).set(
      {
        id: currentTermId,
        classId,
        academicYearLabel: cls.academicYearLabel,
        termNumber: currentTermNum,
        name: `Term ${currentTermNum}`,
        status: "closed",
        closedAt: nowIso
      },
      { merge: true }
    );
    const nextTermNum = currentTermNum < 3 ? currentTermNum + 1 : 3;
    if (currentTermNum < 3) {
      const nextTermId = `${classId}_term_${nextTermNum}`;
      await adminDb.collection("academic_terms").doc(nextTermId).set(
        {
          id: nextTermId,
          classId,
          academicYearLabel: cls.academicYearLabel,
          termNumber: nextTermNum,
          name: `Term ${nextTermNum}`,
          status: "active"
        },
        { merge: true }
      );
      await classRef.update({ activeTermNumber: nextTermNum });
    }
    res.json({
      closedTermNumber: currentTermNum,
      nextTermNumber: currentTermNum < 3 ? nextTermNum : null,
      archivedEntries
    });
  } catch (err) {
    console.error("Close & advance term failed:", err);
    res.status(500).json({ error: "Unable to finalize and close term." });
  }
});
teacherRouter.get("/teams", async (req, res) => {
  try {
    await ensureSeeded();
    const teacherId = req.sessionUser.uid;
    const teamsSnap = await adminDb.collection("teams").where("teacherId", "==", teacherId).get();
    const teams = await Promise.all(
      teamsSnap.docs.map(async (d) => {
        const t = d.data();
        const [avatarSnap, walletSnap, islandSnap, creaturesSnap, achSnap] = await Promise.all([
          adminDb.collection("team_avatars").doc(d.id).get(),
          adminDb.collection("team_wallets").doc(d.id).get(),
          adminDb.collection("team_islands").doc(d.id).get(),
          adminDb.collection("team_creatures").where("teamId", "==", d.id).get(),
          adminDb.collection("team_achievements").where("teamId", "==", d.id).get()
        ]);
        return {
          id: t.id,
          classId: t.classId,
          name: t.name,
          username: t.username,
          members: t.members || [],
          captainMemberId: t.captainMemberId,
          captainName: t.captainName,
          avatar: avatarSnap.exists ? avatarSnap.data() : DEFAULT_AVATAR,
          coins: walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0,
          termPower: islandSnap.exists ? Number(islandSnap.data()?.termPower ?? 0) : 0,
          lifetimePower: islandSnap.exists ? Number(islandSnap.data()?.lifetimePower ?? 0) : 0,
          creatureCount: creaturesSnap.size,
          achievementCount: achSnap.size,
          createdAt: t.createdAt
        };
      })
    );
    res.json({ teams });
  } catch (err) {
    console.error("Get teams failed:", err);
    res.status(500).json({ error: "Unable to load teams." });
  }
});
teacherRouter.post("/teams", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const classId = String(req.body?.classId || "");
    const name = String(req.body?.name || "").trim();
    const rawMembers = Array.isArray(req.body?.members) ? req.body.members.map(String) : [];
    const captainIndex = Number(req.body?.captainIndex ?? 0);
    const usernameInput = String(req.body?.username || "").trim().toLowerCase();
    const passwordInput = String(req.body?.password || "").trim();
    if (!classId || !name) {
      res.status(400).json({ error: "Classroom and team name are required." });
      return;
    }
    const classSnap = await adminDb.collection("classes").doc(classId).get();
    if (!classSnap.exists || classSnap.data().teacherId !== teacherId) {
      res.status(404).json({ error: "Classroom not found." });
      return;
    }
    const memberValidation = validateTeamMembers(rawMembers);
    if (!memberValidation.valid) {
      res.status(400).json({ error: memberValidation.error });
      return;
    }
    const cleanUsername = usernameInput || `${name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12)}${Math.floor(10 + Math.random() * 89)}`;
    const dupUser = await adminDb.collection("teams").where("username", "==", cleanUsername).limit(1).get();
    if (!dupUser.empty) {
      res.status(409).json({ error: `Username "${cleanUsername}" is already in use.` });
      return;
    }
    const generatedPassword = passwordInput || `quiz${Math.floor(1e3 + Math.random() * 9e3)}`;
    if (generatedPassword.length < 4) {
      res.status(400).json({ error: "Password must be at least 4 characters." });
      return;
    }
    const teamId = `team_${crypto5.randomUUID().slice(0, 10)}`;
    const memberObjects = memberValidation.cleaned.map((nickname, idx) => ({
      id: `${teamId}_m${idx + 1}`,
      nickname
    }));
    const safeCaptainIdx = Number.isInteger(captainIndex) && captainIndex >= 0 && captainIndex < memberObjects.length ? captainIndex : 0;
    const captain = memberObjects[safeCaptainIdx];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await adminDb.collection("teams").doc(teamId).set({
      id: teamId,
      classId,
      teacherId,
      name,
      username: cleanUsername,
      passwordHash: hashPassword(generatedPassword),
      members: memberObjects,
      captainMemberId: captain.id,
      captainName: captain.nickname,
      createdAt: nowIso
    });
    await adminDb.collection("team_avatars").doc(teamId).set(DEFAULT_AVATAR);
    await adminDb.collection("team_wallets").doc(teamId).set({
      teamId,
      balance: 200,
      updatedAt: nowIso
    });
    await adminDb.collection("coin_transactions").doc(`welcome_${teamId}`).set({
      id: `welcome_${teamId}`,
      teamId,
      amount: 200,
      txType: "teacher_bonus",
      reason: "Welcome Island Starter Grant",
      referenceId: classId,
      createdAt: nowIso
    });
    const starterInvId = `starter_inv_${teamId}`;
    await adminDb.collection("team_inventory_items").doc(starterInvId).set({
      id: starterInvId,
      teamId,
      itemId: "item_central_castle",
      purchasedAt: nowIso
    });
    await adminDb.collection("team_islands").doc(teamId).set({
      teamId,
      theme: "emerald_isle",
      termPower: 300,
      lifetimePower: 300,
      teacherBonusPower: 0,
      seasonBaselinePower: 0,
      placements: [
        {
          id: `place_${teamId}_castle`,
          inventoryItemId: starterInvId,
          itemId: "item_central_castle",
          name: "Starlight Keep",
          category: "building",
          artKey: "central_castle",
          slotIndex: 2
        }
      ],
      updatedAt: nowIso
    });
    res.status(201).json({
      team: {
        id: teamId,
        classId,
        name,
        username: cleanUsername,
        generatedPassword,
        members: memberObjects,
        captainName: captain.nickname
      }
    });
  } catch (err) {
    console.error("Create team failed:", err);
    res.status(500).json({ error: "Unable to create team." });
  }
});
teacherRouter.put("/teams/:id", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const teamId = String(req.params.id);
    const ref = adminDb.collection("teams").doc(teamId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().teacherId !== teacherId) {
      res.status(404).json({ error: "Team not found." });
      return;
    }
    const name = String(req.body?.name || snap.data().name).trim();
    const rawMembers = Array.isArray(req.body?.members) ? req.body.members.map(String) : (snap.data().members || []).map((m) => m.nickname);
    const validation = validateTeamMembers(rawMembers);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const captainIndex = Number(req.body?.captainIndex ?? 0);
    const memberObjects = validation.cleaned.map((nickname, idx) => ({
      id: `${teamId}_m${idx + 1}`,
      nickname
    }));
    const safeIdx = Number.isInteger(captainIndex) && captainIndex >= 0 && captainIndex < memberObjects.length ? captainIndex : 0;
    const captain = memberObjects[safeIdx];
    await ref.update({
      name,
      members: memberObjects,
      captainMemberId: captain.id,
      captainName: captain.nickname
    });
    res.json({ ok: true, members: memberObjects, captainName: captain.nickname });
  } catch (err) {
    console.error("Update team failed:", err);
    res.status(500).json({ error: "Unable to update team." });
  }
});
teacherRouter.post("/teams/:id/reset-password", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const teamId = String(req.params.id);
    const ref = adminDb.collection("teams").doc(teamId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().teacherId !== teacherId) {
      res.status(404).json({ error: "Team not found." });
      return;
    }
    const nextPassword = String(req.body?.password || "").trim() || `quiz${Math.floor(1e3 + Math.random() * 9e3)}`;
    if (nextPassword.length < 4) {
      res.status(400).json({ error: "Password must be at least 4 characters." });
      return;
    }
    await ref.update({ passwordHash: hashPassword(nextPassword) });
    res.json({ username: snap.data().username, newPassword: nextPassword });
  } catch (err) {
    console.error("Reset team password failed:", err);
    res.status(500).json({ error: "Unable to reset team password." });
  }
});
teacherRouter.post("/teams/:id/award-coins", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const teamId = String(req.params.id);
    const teamSnap = await adminDb.collection("teams").doc(teamId).get();
    if (!teamSnap.exists || teamSnap.data().teacherId !== teacherId) {
      res.status(404).json({ error: "Team not found." });
      return;
    }
    const amount = Number(req.body?.amount);
    const reason = String(req.body?.reason || "Classroom Teamwork Reward").trim();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5e3) {
      res.status(400).json({ error: "Coin reward must be between 1 and 5,000." });
      return;
    }
    const result = await awardCoins({
      teamId,
      amount,
      txType: "teacher_bonus",
      reason,
      referenceId: teacherId
    });
    res.json(result);
  } catch (err) {
    console.error("Award coins failed:", err);
    res.status(500).json({ error: "Unable to award coins." });
  }
});
teacherRouter.post("/teams/:id/award-power", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const teamId = String(req.params.id);
    const teamSnap = await adminDb.collection("teams").doc(teamId).get();
    if (!teamSnap.exists || teamSnap.data().teacherId !== teacherId) {
      res.status(404).json({ error: "Team not found." });
      return;
    }
    const bonusPower = Number(req.body?.amount);
    if (!Number.isFinite(bonusPower) || bonusPower <= 0 || bonusPower > 5e3) {
      res.status(400).json({ error: "Bonus power must be between 1 and 5,000." });
      return;
    }
    const islandRef = adminDb.collection("team_islands").doc(teamId);
    const islandSnap = await islandRef.get();
    const prevBonus = islandSnap.exists ? Number(islandSnap.data()?.teacherBonusPower ?? 0) : 0;
    await islandRef.set({ teacherBonusPower: prevBonus + Math.round(bonusPower) }, { merge: true });
    const recalculated = await recalculateTeamIslandPower(teamId);
    await evaluateTeamAchievements(teamId);
    res.json(recalculated);
  } catch (err) {
    console.error("Award power failed:", err);
    res.status(500).json({ error: "Unable to award bonus island power." });
  }
});
function sanitizeQuestions(rawQuestions) {
  return rawQuestions.map((q, idx) => {
    const optionsRaw = Array.isArray(q?.options) ? q.options : [];
    const options = optionsRaw.slice(0, 4).map((o, oIdx) => ({
      id: String(o?.id || `opt_${crypto5.randomUUID().slice(0, 8)}_${oIdx}`),
      label: String(o?.label || `Option ${oIdx + 1}`).trim(),
      isCorrect: Boolean(o?.isCorrect)
    }));
    if (options.length >= 2 && !options.some((o) => o.isCorrect)) {
      options[0].isCorrect = true;
    }
    return {
      id: String(q?.id || `q_${crypto5.randomUUID().slice(0, 8)}_${idx}`),
      orderIndex: idx,
      questionType: "multiple_choice",
      prompt: String(q?.prompt || "Untitled Question").trim(),
      points: Math.max(10, Math.min(1e3, Number(q?.points || 100))),
      timeLimitSec: Math.max(10, Math.min(180, Number(q?.timeLimitSec || 25))),
      options
    };
  });
}
teacherRouter.get("/quizzes", async (req, res) => {
  try {
    await ensureSeeded();
    const teacherId = req.sessionUser.uid;
    const snap = await adminDb.collection("quizzes").where("teacherId", "==", teacherId).get();
    const quizzes = snap.docs.map((d) => d.data()).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    res.json({ quizzes });
  } catch (err) {
    console.error("Get quizzes failed:", err);
    res.status(500).json({ error: "Unable to load quizzes." });
  }
});
teacherRouter.post("/quizzes", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const title = String(req.body?.title || "").trim();
    const subject = String(req.body?.subject || "General").trim();
    const description = String(req.body?.description || "").trim();
    const classId = String(req.body?.classId || "");
    const termNumber = Number(req.body?.termNumber || 1);
    const speedBonusEnabled = Boolean(req.body?.speedBonusEnabled);
    const status = req.body?.status === "published" ? "published" : "draft";
    const rawQuestions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!title || !classId) {
      res.status(400).json({ error: "Quiz title and class are required." });
      return;
    }
    const questions = sanitizeQuestions(rawQuestions);
    if (status === "published" && questions.length === 0) {
      res.status(400).json({ error: "Add at least one question before publishing." });
      return;
    }
    const quizId = `quiz_${crypto5.randomUUID().slice(0, 10)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const quiz = {
      id: quizId,
      teacherId,
      classId,
      termNumber: [1, 2, 3].includes(termNumber) ? termNumber : 1,
      title,
      subject,
      description,
      status,
      speedBonusEnabled,
      questions,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await adminDb.collection("quizzes").doc(quizId).set(quiz);
    res.status(201).json({ quiz });
  } catch (err) {
    console.error("Create quiz failed:", err);
    res.status(500).json({ error: "Unable to save quiz." });
  }
});
teacherRouter.put("/quizzes/:id", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const quizId = String(req.params.id);
    const ref = adminDb.collection("quizzes").doc(quizId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().teacherId !== teacherId) {
      res.status(404).json({ error: "Quiz not found." });
      return;
    }
    const prev = snap.data();
    const title = String(req.body?.title ?? prev.title).trim();
    const subject = String(req.body?.subject ?? prev.subject).trim();
    const description = String(req.body?.description ?? prev.description).trim();
    const termNumber = Number(req.body?.termNumber ?? prev.termNumber);
    const speedBonusEnabled = req.body?.speedBonusEnabled !== void 0 ? Boolean(req.body.speedBonusEnabled) : prev.speedBonusEnabled;
    const status = req.body?.status === "published" ? "published" : req.body?.status === "draft" ? "draft" : prev.status;
    const questions = Array.isArray(req.body?.questions) ? sanitizeQuestions(req.body.questions) : prev.questions;
    if (status === "published" && questions.length === 0) {
      res.status(400).json({ error: "A published quiz must have at least one question." });
      return;
    }
    const updated = {
      ...prev,
      title,
      subject,
      description,
      termNumber,
      speedBonusEnabled,
      status,
      questions,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await ref.set(updated);
    res.json({ quiz: updated });
  } catch (err) {
    console.error("Update quiz failed:", err);
    res.status(500).json({ error: "Unable to update quiz." });
  }
});
teacherRouter.delete("/quizzes/:id", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const quizId = String(req.params.id);
    const ref = adminDb.collection("quizzes").doc(quizId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().teacherId !== teacherId) {
      res.status(404).json({ error: "Quiz not found." });
      return;
    }
    await ref.delete();
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete quiz failed:", err);
    res.status(500).json({ error: "Unable to delete quiz." });
  }
});
teacherRouter.post("/sessions", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const quizId = String(req.body?.quizId || "");
    const created = await createQuizSession({ quizId, teacherId });
    const state = await buildSessionStateForUser(created.sessionId, req.sessionUser);
    res.status(201).json({ ...created, state });
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.startsWith("NOT_FOUND:")) res.status(404).json({ error: msg.replace("NOT_FOUND: ", "") });
    else if (msg.startsWith("FORBIDDEN:")) res.status(403).json({ error: msg.replace("FORBIDDEN: ", "") });
    else if (msg.startsWith("BAD_REQUEST:")) res.status(400).json({ error: msg.replace("BAD_REQUEST: ", "") });
    else {
      console.error("Create live session failed:", err);
      res.status(500).json({ error: "Unable to host quiz session." });
    }
  }
});
teacherRouter.get("/sessions/active", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const snap = await adminDb.collection("quiz_sessions").where("teacherId", "==", teacherId).where("status", "in", ["lobby", "active"]).get();
    const sessions = snap.docs.map((d) => d.data()).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    res.json({ sessions });
  } catch (err) {
    console.error("Get active sessions failed:", err);
    res.status(500).json({ error: "Unable to load active sessions." });
  }
});
teacherRouter.get("/sessions/:id", async (req, res) => {
  try {
    const state = await buildSessionStateForUser(String(req.params.id), req.sessionUser);
    if (!state) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json({ state });
  } catch (err) {
    console.error("Get session state failed:", err);
    res.status(500).json({ error: "Unable to load session." });
  }
});
teacherRouter.post("/sessions/:id/control", async (req, res) => {
  try {
    const teacherId = req.sessionUser.uid;
    const sessionId = String(req.params.id);
    const action = req.body?.action;
    if (!["start", "next", "reveal", "end"].includes(action)) {
      res.status(400).json({ error: "Invalid session action." });
      return;
    }
    const state = await startOrAdvanceSession({ sessionId, teacherId, action });
    res.json({ state });
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.startsWith("NOT_FOUND:")) res.status(404).json({ error: msg.replace("NOT_FOUND: ", "") });
    else if (msg.startsWith("FORBIDDEN:")) res.status(403).json({ error: msg.replace("FORBIDDEN: ", "") });
    else if (msg.startsWith("BAD_REQUEST:")) res.status(400).json({ error: msg.replace("BAD_REQUEST: ", "") });
    else {
      console.error("Control session failed:", err);
      res.status(500).json({ error: "Unable to update live quiz session." });
    }
  }
});
teacherRouter.get("/catalog", async (_req, res) => {
  try {
    await ensureSeeded();
    const [creaturesSnap, itemsSnap, rules] = await Promise.all([
      adminDb.collection("creatures").get(),
      adminDb.collection("catalog_items").get(),
      getGameRules()
    ]);
    const creatures = creaturesSnap.docs.map((d) => d.data()).sort((a, b) => a.price - b.price);
    const items = itemsSnap.docs.map((d) => d.data()).sort((a, b) => a.price - b.price);
    res.json({ creatures, items, rules });
  } catch (err) {
    console.error("Get teacher catalog failed:", err);
    res.status(500).json({ error: "Unable to load shop catalog." });
  }
});
teacherRouter.post("/creatures", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const element = String(req.body?.element || "Cosmic");
    const rarity = String(req.body?.rarity || "Rare");
    const description = String(req.body?.description || "").trim();
    const artKey = String(req.body?.artKey || "crystal_wisp");
    const price = Math.max(50, Number(req.body?.price || 400));
    const powerValue = Math.max(20, Number(req.body?.powerValue || 200));
    if (!name || !description) {
      res.status(400).json({ error: "Creature name and description are required." });
      return;
    }
    const id = `creature_${crypto5.randomUUID().slice(0, 8)}`;
    const creature = {
      id,
      name,
      element,
      rarity,
      description,
      artKey,
      price,
      powerValue,
      isActive: true
    };
    await adminDb.collection("creatures").doc(id).set(creature);
    res.status(201).json({ creature });
  } catch (err) {
    console.error("Create creature failed:", err);
    res.status(500).json({ error: "Unable to add creature." });
  }
});
teacherRouter.put("/creatures/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = adminDb.collection("creatures").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: "Creature not found." });
      return;
    }
    const prev = snap.data();
    await ref.update({
      name: String(req.body?.name ?? prev.name).trim(),
      price: Math.max(10, Number(req.body?.price ?? prev.price)),
      powerValue: Math.max(10, Number(req.body?.powerValue ?? prev.powerValue)),
      isActive: req.body?.isActive !== void 0 ? Boolean(req.body.isActive) : prev.isActive
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Update creature failed:", err);
    res.status(500).json({ error: "Unable to update creature." });
  }
});
teacherRouter.put("/items/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = adminDb.collection("catalog_items").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: "Item not found." });
      return;
    }
    const prev = snap.data();
    await ref.update({
      name: String(req.body?.name ?? prev.name).trim(),
      price: Math.max(0, Number(req.body?.price ?? prev.price)),
      powerValue: Math.max(0, Number(req.body?.powerValue ?? prev.powerValue)),
      isActive: req.body?.isActive !== void 0 ? Boolean(req.body.isActive) : prev.isActive
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Update item failed:", err);
    res.status(500).json({ error: "Unable to update catalog item." });
  }
});
teacherRouter.put("/rules", async (req, res) => {
  try {
    const prev = await getGameRules();
    const next = {
      creaturePowerMultiplier: Math.max(0.1, Number(req.body?.creaturePowerMultiplier ?? prev.creaturePowerMultiplier)),
      buildingPowerMultiplier: Math.max(0.1, Number(req.body?.buildingPowerMultiplier ?? prev.buildingPowerMultiplier)),
      achievementPowerMultiplier: Math.max(0.1, Number(req.body?.achievementPowerMultiplier ?? prev.achievementPowerMultiplier)),
      participationCoins: Math.max(0, Number(req.body?.participationCoins ?? prev.participationCoins)),
      firstPlaceBonusCoins: Math.max(0, Number(req.body?.firstPlaceBonusCoins ?? prev.firstPlaceBonusCoins)),
      secondPlaceBonusCoins: Math.max(0, Number(req.body?.secondPlaceBonusCoins ?? prev.secondPlaceBonusCoins)),
      thirdPlaceBonusCoins: Math.max(0, Number(req.body?.thirdPlaceBonusCoins ?? prev.thirdPlaceBonusCoins)),
      coinsPerCorrectAnswer: Math.max(0, Number(req.body?.coinsPerCorrectAnswer ?? prev.coinsPerCorrectAnswer))
    };
    await adminDb.collection("config").doc("game_rules").set(next);
    const teamsSnap = await adminDb.collection("teams").where("teacherId", "==", req.sessionUser.uid).get();
    await Promise.all(teamsSnap.docs.map((d) => recalculateTeamIslandPower(d.id)));
    res.json({ rules: next });
  } catch (err) {
    console.error("Update rules failed:", err);
    res.status(500).json({ error: "Unable to update game rules." });
  }
});
teacherRouter.get("/reports", async (req, res) => {
  try {
    await ensureSeeded();
    const teacherId = req.sessionUser.uid;
    const [teamsSnap, sessionsSnap, resultsSnap, achSnap, teamAchSnap, rankingsSnap] = await Promise.all([
      adminDb.collection("teams").where("teacherId", "==", teacherId).get(),
      adminDb.collection("quiz_sessions").where("teacherId", "==", teacherId).get(),
      adminDb.collection("quiz_results").get(),
      adminDb.collection("achievements").get(),
      adminDb.collection("team_achievements").get(),
      adminDb.collection("term_rankings").get()
    ]);
    const teamIds = new Set(teamsSnap.docs.map((d) => d.id));
    const finishedSessions = sessionsSnap.docs.filter((d) => d.data().status === "finished");
    const resultsByTeam = /* @__PURE__ */ new Map();
    for (const d of resultsSnap.docs) {
      const r = d.data();
      if (!teamIds.has(r.teamId)) continue;
      if (!resultsByTeam.has(r.teamId)) resultsByTeam.set(r.teamId, []);
      resultsByTeam.get(r.teamId).push(r);
    }
    const teamAnalytics = await Promise.all(
      teamsSnap.docs.map(async (d) => {
        const t = d.data();
        const [walletSnap, islandSnap, tcSnap] = await Promise.all([
          adminDb.collection("team_wallets").doc(d.id).get(),
          adminDb.collection("team_islands").doc(d.id).get(),
          adminDb.collection("team_creatures").where("teamId", "==", d.id).get()
        ]);
        const teamResults = resultsByTeam.get(d.id) || [];
        const totalQuestionsAnswered = teamResults.reduce((s, r) => s + Number(r.totalQuestions || 0), 0);
        const totalCorrect = teamResults.reduce((s, r) => s + Number(r.correctCount || 0), 0);
        const accuracyPct = totalQuestionsAnswered > 0 ? Math.round(totalCorrect / totalQuestionsAnswered * 100) : 0;
        const avgScore = teamResults.length > 0 ? Math.round(teamResults.reduce((s, r) => s + Number(r.totalScore || 0), 0) / teamResults.length) : 0;
        return {
          teamId: d.id,
          teamName: t.name,
          quizzesPlayed: teamResults.length,
          accuracyPct,
          avgScore,
          coins: walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0,
          termPower: islandSnap.exists ? Number(islandSnap.data()?.termPower ?? 0) : 0,
          lifetimePower: islandSnap.exists ? Number(islandSnap.data()?.lifetimePower ?? 0) : 0,
          creaturesOwned: tcSnap.size
        };
      })
    );
    const achUnlockCounts = /* @__PURE__ */ new Map();
    for (const d of teamAchSnap.docs) {
      const tid = d.data().teamId;
      if (!teamIds.has(tid)) continue;
      const aid = d.data().achievementId;
      achUnlockCounts.set(aid, (achUnlockCounts.get(aid) || 0) + 1);
    }
    const achievementDistribution = achSnap.docs.map((d) => ({
      id: d.id,
      title: d.data().title,
      unlockedByTeams: achUnlockCounts.get(d.id) || 0
    }));
    const quizHistory = finishedSessions.map((d) => {
      const s = d.data();
      const sessResults = Array.from(resultsByTeam.values()).flat().filter((r) => r.sessionId === s.id);
      const avgSessionScore = sessResults.length > 0 ? Math.round(sessResults.reduce((sum, r) => sum + r.totalScore, 0) / sessResults.length) : 0;
      return {
        sessionId: s.id,
        quizTitle: s.quizTitle,
        subject: s.subject,
        termNumber: s.termNumber,
        participantsCount: sessResults.length,
        avgScore: avgSessionScore,
        finishedAt: s.finishedAt || s.createdAt
      };
    }).sort((a, b) => String(b.finishedAt || "").localeCompare(String(a.finishedAt || "")));
    const archivedTerms = rankingsSnap.docs.map((d) => d.data()).filter((r) => teamIds.has(r.teamId)).sort((a, b) => b.termNumber - a.termNumber || a.finalRank - b.finalRank);
    res.json({
      teamAnalytics,
      achievementDistribution,
      quizHistory,
      archivedTerms,
      defaultRules: DEFAULT_GAME_RULES
    });
  } catch (err) {
    console.error("Teacher reports failed:", err);
    res.status(500).json({ error: "Unable to generate classroom analytics." });
  }
});

// server/routes/teamRoutes.ts
import crypto6 from "node:crypto";
import { Router as Router3 } from "express";
var teamRouter = Router3();
teamRouter.use(requireTeam);
async function loadTeamSummary(teamId) {
  const [teamSnap, avatarSnap, walletSnap, islandSnap] = await Promise.all([
    adminDb.collection("teams").doc(teamId).get(),
    adminDb.collection("team_avatars").doc(teamId).get(),
    adminDb.collection("team_wallets").doc(teamId).get(),
    adminDb.collection("team_islands").doc(teamId).get()
  ]);
  if (!teamSnap.exists) return null;
  const t = teamSnap.data();
  const avatar = avatarSnap.exists ? avatarSnap.data() : DEFAULT_AVATAR;
  const coins = walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0;
  const islandData = islandSnap.exists ? islandSnap.data() : {};
  return {
    id: t.id,
    classId: t.classId,
    teacherId: t.teacherId,
    name: t.name,
    username: t.username,
    members: t.members || [],
    captainMemberId: t.captainMemberId,
    captainName: t.captainName,
    avatar,
    coins,
    island: {
      theme: islandData.theme || "emerald_isle",
      termPower: Number(islandData.termPower ?? 0),
      lifetimePower: Number(islandData.lifetimePower ?? 0),
      teacherBonusPower: Number(islandData.teacherBonusPower ?? 0),
      placements: Array.isArray(islandData.placements) ? islandData.placements : []
    },
    createdAt: t.createdAt
  };
}
teamRouter.get("/dashboard", async (req, res) => {
  try {
    await ensureSeeded();
    const teamId = req.sessionUser.teamId;
    const classId = req.sessionUser.classId;
    const [team, classSnap, classTeamsSnap, resultsSnap, teamAchSnap, achSnap, activeSessionsSnap] = await Promise.all([
      loadTeamSummary(teamId),
      adminDb.collection("classes").doc(classId).get(),
      adminDb.collection("teams").where("classId", "==", classId).get(),
      adminDb.collection("quiz_results").where("teamId", "==", teamId).get(),
      adminDb.collection("team_achievements").where("teamId", "==", teamId).get(),
      adminDb.collection("achievements").get(),
      adminDb.collection("quiz_sessions").where("classId", "==", classId).where("status", "in", ["lobby", "active"]).get()
    ]);
    if (!team) {
      res.status(404).json({ error: "Team account not found." });
      return;
    }
    const islandDocs = await Promise.all(
      classTeamsSnap.docs.map((d) => adminDb.collection("team_islands").doc(d.id).get())
    );
    const powers = islandDocs.map((snap) => ({
      teamId: snap.id,
      power: snap.exists ? Number(snap.data()?.termPower ?? 0) : 0
    })).sort((a, b) => b.power - a.power);
    const rankIndex = powers.findIndex((p) => p.teamId === teamId);
    const currentRank = rankIndex >= 0 ? rankIndex + 1 : 1;
    const recentResults = resultsSnap.docs.map((d) => d.data()).sort((a, b) => String(b.finishedAt || "").localeCompare(String(a.finishedAt || ""))).slice(0, 5);
    const achMap = /* @__PURE__ */ new Map();
    for (const d of achSnap.docs) achMap.set(d.id, d.data());
    const recentAchievements = teamAchSnap.docs.map((d) => ({
      id: d.id,
      unlockedAt: d.data().unlockedAt,
      achievement: achMap.get(d.data().achievementId)
    })).filter((a) => Boolean(a.achievement)).sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt)).slice(0, 4);
    const activeSessions = activeSessionsSnap.docs.map((d) => {
      const s = d.data();
      return {
        id: s.id,
        quizTitle: s.quizTitle,
        subject: s.subject,
        pinCode: s.pinCode,
        status: s.status
      };
    });
    const cls = classSnap.exists ? classSnap.data() : null;
    res.json({
      team,
      classroom: cls ? {
        id: cls.id,
        name: cls.name,
        gradeLevel: cls.gradeLevel,
        academicYearLabel: cls.academicYearLabel,
        activeTermNumber: cls.activeTermNumber
      } : null,
      currentRank,
      totalTeamsInClass: classTeamsSnap.size,
      recentResults,
      recentAchievements,
      activeSessions
    });
  } catch (err) {
    console.error("Team dashboard failed:", err);
    res.status(500).json({ error: "Unable to load team dashboard." });
  }
});
teamRouter.put("/avatar", async (req, res) => {
  try {
    const teamId = req.sessionUser.teamId;
    const body = req.body;
    const validCharacters = ["wizard", "explorer", "knight", "scholar"];
    const validHair = ["short", "braids", "spiky", "curly"];
    const validFaces = ["happy", "curious", "determined", "sparkle"];
    const validClothes = ["robe", "tunic", "cape", "vest"];
    const validAccessories = ["wizard_hat", "crown", "glasses", "star_pin", "none"];
    const avatar = {
      characterType: validCharacters.includes(String(body.characterType)) ? body.characterType : DEFAULT_AVATAR.characterType,
      hairStyle: validHair.includes(String(body.hairStyle)) ? body.hairStyle : DEFAULT_AVATAR.hairStyle,
      faceStyle: validFaces.includes(String(body.faceStyle)) ? body.faceStyle : DEFAULT_AVATAR.faceStyle,
      clothingStyle: validClothes.includes(String(body.clothingStyle)) ? body.clothingStyle : DEFAULT_AVATAR.clothingStyle,
      accessory: validAccessories.includes(String(body.accessory)) ? body.accessory : DEFAULT_AVATAR.accessory,
      primaryColor: /^#[0-9a-fA-F]{6}$/.test(String(body.primaryColor || "")) ? String(body.primaryColor) : DEFAULT_AVATAR.primaryColor,
      accentColor: /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor || "")) ? String(body.accentColor) : DEFAULT_AVATAR.accentColor
    };
    await adminDb.collection("team_avatars").doc(teamId).set(avatar);
    res.json({ avatar });
  } catch (err) {
    console.error("Update avatar failed:", err);
    res.status(500).json({ error: "Unable to save team avatar." });
  }
});
teamRouter.get("/island", async (req, res) => {
  try {
    const teamId = req.sessionUser.teamId;
    const [team, tcSnap, tiSnap, creaturesSnap, itemsSnap, teamAchSnap, achSnap, rules] = await Promise.all([
      loadTeamSummary(teamId),
      adminDb.collection("team_creatures").where("teamId", "==", teamId).get(),
      adminDb.collection("team_inventory_items").where("teamId", "==", teamId).get(),
      adminDb.collection("creatures").get(),
      adminDb.collection("catalog_items").get(),
      adminDb.collection("team_achievements").where("teamId", "==", teamId).get(),
      adminDb.collection("achievements").get(),
      getGameRules()
    ]);
    if (!team) {
      res.status(404).json({ error: "Team not found." });
      return;
    }
    const creatureMap = /* @__PURE__ */ new Map();
    for (const d of creaturesSnap.docs) creatureMap.set(d.id, d.data());
    const itemMap = /* @__PURE__ */ new Map();
    for (const d of itemsSnap.docs) itemMap.set(d.id, d.data());
    const achMap = /* @__PURE__ */ new Map();
    for (const d of achSnap.docs) achMap.set(d.id, d.data());
    const ownedCreatures = tcSnap.docs.map((d) => ({
      id: d.id,
      creatureId: d.data().creatureId,
      acquiredAt: d.data().acquiredAt,
      creature: creatureMap.get(d.data().creatureId)
    })).filter((c) => Boolean(c.creature));
    const ownedItems = tiSnap.docs.map((d) => ({
      id: d.id,
      itemId: d.data().itemId,
      purchasedAt: d.data().purchasedAt,
      item: itemMap.get(d.data().itemId)
    })).filter((i) => Boolean(i.item));
    const creaturePower = ownedCreatures.reduce(
      (sum, c) => sum + Math.round((c.creature?.powerValue || 0) * rules.creaturePowerMultiplier),
      0
    );
    const buildingPower = ownedItems.reduce(
      (sum, i) => sum + Math.round((i.item?.powerValue || 0) * rules.buildingPowerMultiplier),
      0
    );
    const achievementPower = teamAchSnap.docs.reduce(
      (sum, d) => sum + Math.round((achMap.get(d.data().achievementId)?.powerValue || 0) * rules.achievementPowerMultiplier),
      0
    );
    res.json({
      team,
      ownedCreatures,
      ownedItems,
      powerBreakdown: {
        creaturePower,
        buildingPower,
        achievementPower,
        teacherBonusPower: team.island.teacherBonusPower,
        termPower: team.island.termPower,
        lifetimePower: team.island.lifetimePower
      }
    });
  } catch (err) {
    console.error("Get island failed:", err);
    res.status(500).json({ error: "Unable to load team island." });
  }
});
teamRouter.put("/island/placements", async (req, res) => {
  try {
    const teamId = req.sessionUser.teamId;
    const rawPlacements = Array.isArray(req.body?.placements) ? req.body.placements : [];
    const theme = String(req.body?.theme || "emerald_isle");
    const [tcSnap, tiSnap, creaturesSnap, itemsSnap] = await Promise.all([
      adminDb.collection("team_creatures").where("teamId", "==", teamId).get(),
      adminDb.collection("team_inventory_items").where("teamId", "==", teamId).get(),
      adminDb.collection("creatures").get(),
      adminDb.collection("catalog_items").get()
    ]);
    const ownedInvIds = /* @__PURE__ */ new Map();
    for (const d of tiSnap.docs) ownedInvIds.set(d.id, d.data().itemId);
    const ownedTcIds = /* @__PURE__ */ new Map();
    for (const d of tcSnap.docs) ownedTcIds.set(d.id, d.data().creatureId);
    const creatureMap = /* @__PURE__ */ new Map();
    for (const d of creaturesSnap.docs) creatureMap.set(d.id, d.data());
    const itemMap = /* @__PURE__ */ new Map();
    for (const d of itemsSnap.docs) itemMap.set(d.id, d.data());
    const validatedPlacements = [];
    const usedSlots = /* @__PURE__ */ new Set();
    const usedEntities = /* @__PURE__ */ new Set();
    for (const p of rawPlacements) {
      const slotIndex = Number(p?.slotIndex);
      const inventoryItemId = String(p?.inventoryItemId || "");
      if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 11) continue;
      if (usedSlots.has(slotIndex) || usedEntities.has(inventoryItemId)) continue;
      if (ownedInvIds.has(inventoryItemId)) {
        const itemId = ownedInvIds.get(inventoryItemId);
        const item = itemMap.get(itemId);
        if (!item) continue;
        usedSlots.add(slotIndex);
        usedEntities.add(inventoryItemId);
        validatedPlacements.push({
          id: `place_${slotIndex}_${inventoryItemId.slice(0, 8)}`,
          inventoryItemId,
          itemId,
          name: item.name,
          category: item.category,
          artKey: item.artKey,
          slotIndex
        });
      } else if (ownedTcIds.has(inventoryItemId)) {
        const creatureId = ownedTcIds.get(inventoryItemId);
        const creature = creatureMap.get(creatureId);
        if (!creature) continue;
        usedSlots.add(slotIndex);
        usedEntities.add(inventoryItemId);
        validatedPlacements.push({
          id: `place_${slotIndex}_${inventoryItemId.slice(0, 8)}`,
          inventoryItemId,
          itemId: creatureId,
          name: creature.name,
          category: "creature",
          artKey: creature.artKey,
          slotIndex
        });
      }
    }
    await adminDb.collection("team_islands").doc(teamId).set(
      {
        theme,
        placements: validatedPlacements,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      { merge: true }
    );
    res.json({ placements: validatedPlacements, theme });
  } catch (err) {
    console.error("Update island placements failed:", err);
    res.status(500).json({ error: "Unable to save island layout." });
  }
});
teamRouter.get("/shop", async (req, res) => {
  try {
    await ensureSeeded();
    const teamId = req.sessionUser.teamId;
    const [creaturesSnap, itemsSnap, walletSnap, tcSnap, tiSnap] = await Promise.all([
      adminDb.collection("creatures").where("isActive", "==", true).get(),
      adminDb.collection("catalog_items").where("isActive", "==", true).get(),
      adminDb.collection("team_wallets").doc(teamId).get(),
      adminDb.collection("team_creatures").where("teamId", "==", teamId).get(),
      adminDb.collection("team_inventory_items").where("teamId", "==", teamId).get()
    ]);
    const creatures = creaturesSnap.docs.map((d) => d.data()).sort((a, b) => a.price - b.price);
    const items = itemsSnap.docs.map((d) => d.data()).filter((i) => i.price > 0).sort((a, b) => a.price - b.price);
    const ownedCreatureCounts = {};
    for (const d of tcSnap.docs) {
      const cid = d.data().creatureId;
      ownedCreatureCounts[cid] = (ownedCreatureCounts[cid] || 0) + 1;
    }
    const ownedItemCounts = {};
    for (const d of tiSnap.docs) {
      const iid = d.data().itemId;
      ownedItemCounts[iid] = (ownedItemCounts[iid] || 0) + 1;
    }
    res.json({
      coins: walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0,
      creatures,
      items,
      ownedCreatureCounts,
      ownedItemCounts
    });
  } catch (err) {
    console.error("Shop load failed:", err);
    res.status(500).json({ error: "Unable to load Pet & Island Shop." });
  }
});
teamRouter.post("/shop/buy-creature", async (req, res) => {
  try {
    const teamId = req.sessionUser.teamId;
    const creatureId = String(req.body?.creatureId || "");
    const idempotencyKey = String(req.body?.idempotencyKey || crypto6.randomUUID());
    if (!creatureId) {
      res.status(400).json({ error: "Missing creatureId." });
      return;
    }
    const result = await purchaseCreature({ teamId, creatureId, idempotencyKey });
    res.json(result);
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.startsWith("NOT_FOUND:")) res.status(404).json({ error: msg.replace("NOT_FOUND: ", "") });
    else if (msg.startsWith("CONFLICT:")) res.status(409).json({ error: msg.replace("CONFLICT: ", "") });
    else if (msg.startsWith("BAD_REQUEST:")) res.status(400).json({ error: msg.replace("BAD_REQUEST: ", "") });
    else {
      console.error("Buy creature failed:", err);
      res.status(500).json({ error: "Purchase could not be completed." });
    }
  }
});
teamRouter.post("/shop/buy-item", async (req, res) => {
  try {
    const teamId = req.sessionUser.teamId;
    const itemId = String(req.body?.itemId || "");
    const idempotencyKey = String(req.body?.idempotencyKey || crypto6.randomUUID());
    if (!itemId) {
      res.status(400).json({ error: "Missing itemId." });
      return;
    }
    const result = await purchaseCatalogItem({ teamId, itemId, idempotencyKey });
    res.json(result);
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.startsWith("NOT_FOUND:")) res.status(404).json({ error: msg.replace("NOT_FOUND: ", "") });
    else if (msg.startsWith("CONFLICT:")) res.status(409).json({ error: msg.replace("CONFLICT: ", "") });
    else if (msg.startsWith("BAD_REQUEST:")) res.status(400).json({ error: msg.replace("BAD_REQUEST: ", "") });
    else {
      console.error("Buy item failed:", err);
      res.status(500).json({ error: "Purchase could not be completed." });
    }
  }
});
teamRouter.get("/collection", async (req, res) => {
  try {
    const teamId = req.sessionUser.teamId;
    const [tcSnap, tiSnap, txSnap, creaturesSnap, itemsSnap, walletSnap] = await Promise.all([
      adminDb.collection("team_creatures").where("teamId", "==", teamId).get(),
      adminDb.collection("team_inventory_items").where("teamId", "==", teamId).get(),
      adminDb.collection("coin_transactions").where("teamId", "==", teamId).get(),
      adminDb.collection("creatures").get(),
      adminDb.collection("catalog_items").get(),
      adminDb.collection("team_wallets").doc(teamId).get()
    ]);
    const creatureMap = /* @__PURE__ */ new Map();
    for (const d of creaturesSnap.docs) creatureMap.set(d.id, d.data());
    const itemMap = /* @__PURE__ */ new Map();
    for (const d of itemsSnap.docs) itemMap.set(d.id, d.data());
    const creatures = tcSnap.docs.map((d) => ({
      id: d.id,
      teamId,
      creatureId: d.data().creatureId,
      acquiredAt: d.data().acquiredAt,
      creature: creatureMap.get(d.data().creatureId)
    })).filter((c) => Boolean(c.creature));
    const items = tiSnap.docs.map((d) => ({
      id: d.id,
      teamId,
      itemId: d.data().itemId,
      purchasedAt: d.data().purchasedAt,
      item: itemMap.get(d.data().itemId)
    })).filter((i) => Boolean(i.item));
    const transactions = txSnap.docs.map((d) => d.data()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      coins: walletSnap.exists ? Number(walletSnap.data()?.balance ?? 0) : 0,
      creatures,
      items,
      transactions,
      catalogTotalCreatures: creaturesSnap.size
    });
  } catch (err) {
    console.error("Collection load failed:", err);
    res.status(500).json({ error: "Unable to load collection." });
  }
});
teamRouter.get("/achievements", async (req, res) => {
  try {
    const teamId = req.sessionUser.teamId;
    const [achSnap, unlockedSnap] = await Promise.all([
      adminDb.collection("achievements").get(),
      adminDb.collection("team_achievements").where("teamId", "==", teamId).get()
    ]);
    const unlockedMap = /* @__PURE__ */ new Map();
    for (const d of unlockedSnap.docs) {
      unlockedMap.set(d.data().achievementId, d.data().unlockedAt);
    }
    const list = achSnap.docs.map((d) => {
      const a = d.data();
      return {
        ...a,
        unlocked: unlockedMap.has(a.id),
        unlockedAt: unlockedMap.get(a.id) || null
      };
    });
    res.json({ achievements: list });
  } catch (err) {
    console.error("Achievements load failed:", err);
    res.status(500).json({ error: "Unable to load achievements." });
  }
});
teamRouter.get("/leaderboards", async (req, res) => {
  try {
    const classId = req.sessionUser.classId;
    const [classSnap, teamsSnap, rankingsSnap, resultsSnap] = await Promise.all([
      adminDb.collection("classes").doc(classId).get(),
      adminDb.collection("teams").where("classId", "==", classId).get(),
      adminDb.collection("term_rankings").where("classId", "==", classId).get(),
      adminDb.collection("quiz_results").where("classId", "==", classId).get()
    ]);
    const cls = classSnap.exists ? classSnap.data() : { activeTermNumber: 1, academicYearLabel: "2026-2027" };
    const teamEntries = await Promise.all(
      teamsSnap.docs.map(async (d) => {
        const [avatarSnap, islandSnap] = await Promise.all([
          adminDb.collection("team_avatars").doc(d.id).get(),
          adminDb.collection("team_islands").doc(d.id).get()
        ]);
        const t = d.data();
        const island = islandSnap.exists ? islandSnap.data() : {};
        return {
          teamId: d.id,
          teamName: t.name,
          avatar: avatarSnap.exists ? avatarSnap.data() : DEFAULT_AVATAR,
          termPower: Number(island.termPower ?? 0),
          lifetimePower: Number(island.lifetimePower ?? 0)
        };
      })
    );
    const currentTermStandings = [...teamEntries].sort((a, b) => b.termPower - a.termPower).map((entry, idx) => ({ ...entry, rank: idx + 1 }));
    const academicYearStandings = [...teamEntries].sort((a, b) => b.lifetimePower - a.lifetimePower).map((entry, idx) => ({ ...entry, rank: idx + 1 }));
    const previousTerms = rankingsSnap.docs.map((d) => d.data()).sort((a, b) => b.termNumber - a.termNumber || a.finalRank - b.finalRank);
    const allResults = resultsSnap.docs.map((d) => d.data());
    allResults.sort((a, b) => String(b.finishedAt || "").localeCompare(String(a.finishedAt || "")));
    const latestSessionId = allResults[0]?.sessionId;
    const latestQuizTitle = allResults[0]?.quizTitle || null;
    const latestQuizStandings = latestSessionId ? allResults.filter((r) => r.sessionId === latestSessionId).sort((a, b) => a.rank - b.rank) : [];
    res.json({
      activeTermNumber: cls.activeTermNumber,
      academicYearLabel: cls.academicYearLabel,
      currentTermStandings,
      academicYearStandings,
      previousTerms,
      latestQuizTitle,
      latestQuizStandings
    });
  } catch (err) {
    console.error("Leaderboards load failed:", err);
    res.status(500).json({ error: "Unable to load leaderboards." });
  }
});
teamRouter.post("/quiz/join", async (req, res) => {
  try {
    const teamId = req.sessionUser.teamId;
    const classId = req.sessionUser.classId;
    const pinCode = req.body?.pinCode ? String(req.body.pinCode) : "";
    const sessionId = req.body?.sessionId ? String(req.body.sessionId) : "";
    if (!pinCode && !sessionId) {
      res.status(400).json({ error: "Enter a quiz PIN or select an active classroom quiz." });
      return;
    }
    const joined = pinCode ? await joinSessionByPin({ pinCode, teamId, classId }) : await joinSessionById({ sessionId, teamId, classId });
    const state = await buildSessionStateForUser(joined.sessionId, req.sessionUser);
    res.json({ ...joined, state });
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.startsWith("NOT_FOUND:")) res.status(404).json({ error: msg.replace("NOT_FOUND: ", "") });
    else if (msg.startsWith("FORBIDDEN:")) res.status(403).json({ error: msg.replace("FORBIDDEN: ", "") });
    else if (msg.startsWith("BAD_REQUEST:")) res.status(400).json({ error: msg.replace("BAD_REQUEST: ", "") });
    else {
      console.error("Join quiz failed:", err);
      res.status(500).json({ error: "Unable to join quiz session." });
    }
  }
});
teamRouter.get("/quiz/sessions/:id", async (req, res) => {
  try {
    const sessionId = String(req.params.id);
    const state = await buildSessionStateForUser(sessionId, req.sessionUser);
    if (!state) {
      res.status(404).json({ error: "Quiz session not found." });
      return;
    }
    if (state.classId !== req.sessionUser.classId) {
      res.status(403).json({ error: "This quiz session belongs to another classroom." });
      return;
    }
    res.json({ state });
  } catch (err) {
    console.error("Get quiz session failed:", err);
    res.status(500).json({ error: "Unable to load quiz session." });
  }
});
teamRouter.post("/quiz/sessions/:id/submit", async (req, res) => {
  try {
    const sessionId = String(req.params.id);
    const teamId = req.sessionUser.teamId;
    const questionId = String(req.body?.questionId || "");
    const optionId = String(req.body?.optionId || "");
    if (!questionId || !optionId) {
      res.status(400).json({ error: "Please select an answer before submitting." });
      return;
    }
    const result = await submitTeamAnswer({ sessionId, teamId, questionId, optionId });
    const state = await buildSessionStateForUser(sessionId, req.sessionUser);
    res.json({ ...result, state });
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.startsWith("NOT_FOUND:")) res.status(404).json({ error: msg.replace("NOT_FOUND: ", "") });
    else if (msg.startsWith("FORBIDDEN:")) res.status(403).json({ error: msg.replace("FORBIDDEN: ", "") });
    else if (msg.startsWith("CONFLICT:")) res.status(409).json({ error: msg.replace("CONFLICT: ", "") });
    else if (msg.startsWith("BAD_REQUEST:")) res.status(400).json({ error: msg.replace("BAD_REQUEST: ", "") });
    else {
      console.error("Submit answer failed:", err);
      res.status(500).json({ error: "Answer submission failed." });
    }
  }
});

// server/app.ts
function createExpressApp() {
  const app3 = express();
  app3.set("trust proxy", 1);
  app3.use((req, res, next) => {
    if (req.body !== void 0) {
      if (typeof req.body === "string") {
        try {
          req.body = req.body.trim() ? JSON.parse(req.body) : {};
        } catch {
          res.status(400).json({ error: "Invalid JSON request body." });
          return;
        }
      }
      if (req.body !== null && typeof req.body === "object") {
        next();
        return;
      }
    }
    express.json({ limit: "1mb" })(req, res, next);
  });
  app3.use(cookieParser());
  app3.use(attachSession);
  app3.get("/api/health", async (_req, res) => {
    try {
      await ensureSeeded();
      res.json({
        ok: true,
        service: "quiztopia",
        db: useRemoteFirestore ? "firestore" : "local",
        ...firebaseInitError ? { warning: firebaseInitError } : {}
      });
    } catch (err) {
      console.error("Health check failed:", err);
      res.status(500).json({
        ok: false,
        error: err?.message || "Database initialization failed."
      });
    }
  });
  app3.use("/api/auth", authRouter);
  app3.use("/api/teacher", teacherRouter);
  app3.use("/api/team", teamRouter);
  app3.use("/api", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });
  app3.use((err, _req, res, _next) => {
    console.error("Unhandled Express error:", err);
    if (res.headersSent) return;
    const status = typeof err?.status === "number" && err.status >= 400 ? err.status : 500;
    res.status(status).json({ error: err?.message || "Internal server error." });
  });
  return app3;
}

// server/vercel.ts
var app2 = createExpressApp();
function handler(req, res) {
  try {
    if (req.url) {
      try {
        const parsed = new URL(req.url, "http://localhost");
        const rewrittenPath = parsed.searchParams.get("__path");
        if (rewrittenPath !== null) {
          parsed.searchParams.delete("__path");
          const qs = parsed.searchParams.toString();
          const cleanPath = rewrittenPath.replace(/^\/+/, "");
          req.url = `/api/${cleanPath}${qs ? `?${qs}` : ""}`;
        }
      } catch {
      }
    }
    return app2(req, res);
  } catch (err) {
    console.error("Vercel handler fatal error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: err?.message || "Serverless handler error." }));
    }
  }
}
export {
  handler as default
};
