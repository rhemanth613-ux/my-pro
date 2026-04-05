import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dbPath = path.join(rootDir, "data", "db.json");
const uploadsDir = path.join(rootDir, "uploads");
const app = express();
const port = 4000;
const JWT_SECRET = process.env.JWT_SECRET || "sports-talent-secret";

const SPORTS = [
  "Cricket",
  "Football",
  "Basketball",
  "Volleyball",
  "Tennis",
  "Badminton",
  "Hockey",
  "Athletics",
  "Kabaddi",
  "Table Tennis",
  "Swimming",
  "Wrestling",
  "Boxing",
  "Baseball"
];

const POSITIONS = {
  Cricket: ["Batter", "Bowler", "All-Rounder", "Wicketkeeper"],
  Football: ["Goalkeeper", "Defender", "Midfielder", "Forward"],
  Basketball: ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"],
  Volleyball: ["Setter", "Outside Hitter", "Middle Blocker", "Libero", "Opposite Hitter"],
  Tennis: ["Singles", "Doubles", "All-Court"],
  Badminton: ["Singles", "Doubles", "Mixed Doubles"],
  Hockey: ["Goalkeeper", "Defender", "Midfielder", "Forward"],
  Athletics: ["Sprint", "Middle Distance", "Long Distance", "Jumps", "Throws"],
  Kabaddi: ["Raider", "Defender", "All-Rounder"],
  "Table Tennis": ["Attacker", "Defender", "All-Rounder"],
  Swimming: ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "Medley"],
  Wrestling: ["Freestyle", "Greco-Roman"],
  Boxing: ["Out-Boxer", "Slugger", "Boxer-Puncher", "Counterpuncher"],
  Baseball: ["Pitcher", "Catcher", "Infielder", "Outfielder"]
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-msvideo"]);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(uploadsDir));

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify({ players: [], coaches: [], videos: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const month = today.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function createId(prefix, count) {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function auth(requiredRole) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (requiredRole && payload.role !== requiredRole) {
        return res.status(403).json({ message: "Access denied for this role." });
      }
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ message: "Invalid token." });
    }
  };
}

function getCurrentUser(req) {
  const db = readDb();
  const collection = req.user.role === "coach" ? db.coaches : db.players;
  return collection.find((item) => item.id === req.user.id);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value, min, max) {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function metricScore(value) {
  return Math.round(clamp(value, 0, 100));
}

function buildAnalysis(videoMeta, sport, position, ageGroup) {
  const meta = videoMeta || {};
  const width = Number(meta.width || 0);
  const height = Number(meta.height || 0);
  const durationSec = Number(meta.durationSec || 0);
  const fileSizeMb = Number(meta.fileSizeMb || 0);
  const brightness = Number(meta.brightnessScore || 0);
  const motion = Number(meta.motionScore || 0);
  const sharpness = Number(meta.sharpnessScore || 0);
  const brightnessConsistency = Number(meta.brightnessConsistency || 0);

  const resolutionPixels = width * height;
  const resolutionScore = normalize(resolutionPixels, 640 * 360, 1920 * 1080) * 100;
  const durationScore = normalize(durationSec, 8, 75) * 100;
  const bitrateMbps = durationSec > 0 ? (fileSizeMb * 8) / durationSec : 0;
  const bitrateScore = normalize(bitrateMbps, 0.5, 8) * 100;
  const balancedBrightness = 100 - Math.abs(brightness - 55) * 1.8;
  const stabilitySignal = brightnessConsistency;

  const scores = {
    speedScore: metricScore(motion * 0.7 + durationScore * 0.15 + bitrateScore * 0.15),
    accuracyScore: metricScore(sharpness * 0.45 + stabilitySignal * 0.35 + balancedBrightness * 0.2),
    reactionTime: metricScore(motion * 0.6 + sharpness * 0.25 + bitrateScore * 0.15),
    movementEfficiency: metricScore(stabilitySignal * 0.4 + motion * 0.35 + balancedBrightness * 0.25),
    techniqueQuality: metricScore(sharpness * 0.45 + resolutionScore * 0.3 + bitrateScore * 0.25),
    staminaEstimation: metricScore(durationScore * 0.65 + motion * 0.2 + stabilitySignal * 0.15)
  };
  const overallPerformanceScore = Math.round(
    Object.values(scores).reduce((sum, value) => sum + value, 0) / Object.values(scores).length
  );

  const metricEntries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topMetric = metricEntries[0][0];
  const weakestMetric = metricEntries[metricEntries.length - 1][0];
  const formatMetric = (value) => value.replace(/([A-Z])/g, " $1").toLowerCase();

  return {
    ...scores,
    overallPerformanceScore,
    summary: `Video-based analysis for ${position} in ${sport} shows strongest ${formatMetric(topMetric)} and improvement headroom in ${formatMetric(weakestMetric)}.`,
    suggestions: [
      scores.staminaEstimation < 65 ? "Upload a longer continuous performance sequence to better reflect endurance." : "Endurance signal is stable across the submitted clip.",
      scores.techniqueQuality < 65 ? "Use a clearer camera angle and steady framing to improve technique analysis quality." : "Technique visibility is clear in the submitted footage.",
      scores.speedScore < 65 ? "Include more high-intensity action moments to improve movement and reaction assessment." : "Movement intensity is well represented in the uploaded clip."
    ],
    analysisBasis: {
      durationSec: Math.round(durationSec * 10) / 10,
      resolution: width && height ? `${width}x${height}` : "Unavailable",
      fileSizeMb: Math.round(fileSizeMb * 100) / 100,
      brightnessScore: metricScore(brightness),
      motionScore: metricScore(motion),
      sharpnessScore: metricScore(sharpness),
      brightnessConsistency: metricScore(brightnessConsistency),
      ageGroup
    }
  };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${stamp}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

function validateRegistration(body, role) {
  const required = ["fullName", "email", "password", "mobileNumber", "dateOfBirth", "gender", "country"];
  const missing = required.filter((field) => !body[field]);
  if (missing.length) {
    return `Missing required fields: ${missing.join(", ")}`;
  }
  if (!/\S+@\S+\.\S+/.test(body.email)) {
    return "Please provide a valid email address.";
  }
  if (String(body.password).length < 6) {
    return "Password must be at least 6 characters.";
  }
  return null;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/sports", (_req, res) => {
  res.json({
    sports: SPORTS.map((sport) => ({
      name: sport,
      positions: POSITIONS[sport],
      thumbnail: `/thumbnails/${sport.toLowerCase().replace(/\s+/g, "-")}.jpg`
    }))
  });
});

app.post("/api/auth/:role/register", async (req, res) => {
  const role = req.params.role;
  if (!["player", "coach"].includes(role)) {
    return res.status(400).json({ message: "Unsupported role." });
  }

  const error = validateRegistration(req.body, role);
  if (error) {
    return res.status(400).json({ message: error });
  }

  const db = readDb();
  const collection = role === "player" ? db.players : db.coaches;
  const email = normalizeEmail(req.body.email);
  const existing = collection.find((item) => item.email === email);

  if (existing) {
    return res.status(409).json({
      message: "Account already created. Please login."
    });
  }

  const password = await bcrypt.hash(req.body.password, 10);
  const id = createId(role === "player" ? "PLY" : "COA", collection.length);
  const newUser = {
    id,
    role,
    fullName: req.body.fullName.trim(),
    email,
    password,
    mobileNumber: req.body.mobileNumber.trim(),
    dateOfBirth: req.body.dateOfBirth,
    gender: req.body.gender,
    country: req.body.country,
    age: calculateAge(req.body.dateOfBirth),
    profileImage: "",
    createdAt: new Date().toISOString(),
    selectedPlayers: [],
    ...(role === "player" ? { primarySport: "", uploadedVideos: [] } : {})
  };

  collection.push(newUser);
  writeDb(db);

  return res.status(201).json({
    message: "Account Created Successfully",
    token: signToken(newUser),
    user: sanitizeUser(newUser)
  });
});

app.post("/api/auth/:role/login", async (req, res) => {
  const role = req.params.role;
  if (!["player", "coach"].includes(role)) {
    return res.status(400).json({ message: "Unsupported role." });
  }

  const db = readDb();
  const collection = role === "player" ? db.players : db.coaches;
  const email = normalizeEmail(req.body.email || "");
  const user = collection.find((item) => item.email === email);

  if (!user) {
    return res.status(404).json({
      message: "User not found. Please create an account."
    });
  }

  const valid = await bcrypt.compare(req.body.password || "", user.password);
  if (!valid) {
    return res.status(401).json({ message: "Incorrect password." });
  }

  return res.json({
    message: "Login successful.",
    token: signToken(user),
    user: sanitizeUser(user)
  });
});

app.get("/api/auth/me", auth(), (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  return res.json({ user: sanitizeUser(user) });
});

app.post("/api/profile/image", auth(), upload.single("profileImage"), (req, res) => {
  if (!req.file || !IMAGE_TYPES.has(req.file.mimetype)) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ message: "Only JPG, JPEG, and PNG images are allowed." });
  }

  const db = readDb();
  const collection = req.user.role === "coach" ? db.coaches : db.players;
  const user = collection.find((item) => item.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  user.profileImage = `/uploads/${req.file.filename}`;
  writeDb(db);
  return res.json({ message: "Profile image updated.", imageUrl: user.profileImage });
});

app.post("/api/videos/upload", auth("player"), upload.single("video"), (req, res) => {
  if (!req.file || !VIDEO_TYPES.has(req.file.mimetype)) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ message: "Only video files are allowed." });
  }

  const { sport, ageGroup, position } = req.body;
  if (!sport || !ageGroup || !position) {
    return res.status(400).json({ message: "Sport, age group, and position are required." });
  }

  const db = readDb();
  const player = db.players.find((item) => item.id === req.user.id);
  if (!player) {
    return res.status(404).json({ message: "Player not found." });
  }

  if (!player.primarySport) {
    player.primarySport = sport;
  }

  let analysisMeta = null;
  try {
    analysisMeta = req.body.analysisMeta ? JSON.parse(req.body.analysisMeta) : null;
  } catch {
    analysisMeta = null;
  }

  const analysis = buildAnalysis(analysisMeta, sport, position, ageGroup);
  const video = {
    id: `VID-${String(db.videos.length + 1).padStart(4, "0")}`,
    playerId: player.id,
    playerName: player.fullName,
    email: player.email,
    sport,
    ageGroup,
    position,
    videoUrl: `/uploads/${req.file.filename}`,
    aiMetrics: analysis,
    uploadDate: new Date().toISOString()
  };

  db.videos.unshift(video);
  player.uploadedVideos.unshift(video.id);
  writeDb(db);

  return res.status(201).json({
    message: "Video Successfully Submitted",
    video
  });
});

app.get("/api/player/dashboard", auth("player"), (req, res) => {
  const db = readDb();
  const player = db.players.find((item) => item.id === req.user.id);
  if (!player) {
    return res.status(404).json({ message: "Player not found." });
  }

  const videos = db.videos.filter((item) => item.playerId === player.id);
  return res.json({
    player: sanitizeUser(player),
    videos
  });
});

app.get("/api/coach/players", auth("coach"), (req, res) => {
  const db = readDb();
  const { q = "", sport = "", position = "", minScore = "" } = req.query;
  const filtered = db.videos.filter((video) => {
    const queryMatch = q
      ? `${video.playerName} ${video.sport} ${video.position}`.toLowerCase().includes(String(q).toLowerCase())
      : true;
    const sportMatch = sport ? video.sport === sport : true;
    const positionMatch = position ? video.position === position : true;
    const scoreMatch = minScore ? video.aiMetrics.overallPerformanceScore >= Number(minScore) : true;
    return queryMatch && sportMatch && positionMatch && scoreMatch;
  });

  return res.json({ players: filtered });
});

app.get("/api/coach/selected", auth("coach"), (req, res) => {
  const db = readDb();
  const coach = db.coaches.find((item) => item.id === req.user.id);
  if (!coach) {
    return res.status(404).json({ message: "Coach not found." });
  }

  const selected = db.videos.filter((video) => coach.selectedPlayers.includes(video.playerId));
  return res.json({ selectedPlayers: selected });
});

app.post("/api/coach/selected/:playerId", auth("coach"), (req, res) => {
  const db = readDb();
  const coach = db.coaches.find((item) => item.id === req.user.id);
  if (!coach) {
    return res.status(404).json({ message: "Coach not found." });
  }

  if (!coach.selectedPlayers.includes(req.params.playerId)) {
    coach.selectedPlayers.push(req.params.playerId);
  }

  writeDb(db);
  return res.json({ message: "Player added to dashboard." });
});

app.delete("/api/coach/selected/:playerId", auth("coach"), (req, res) => {
  const db = readDb();
  const coach = db.coaches.find((item) => item.id === req.user.id);
  if (!coach) {
    return res.status(404).json({ message: "Coach not found." });
  }

  coach.selectedPlayers = coach.selectedPlayers.filter((id) => id !== req.params.playerId);
  writeDb(db);
  return res.json({ message: "Player removed from dashboard." });
});

app.listen(port, () => {
  console.log(`AI Sports Talent API running on http://localhost:${port}`);
});
