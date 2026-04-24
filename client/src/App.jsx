import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = "http://localhost:4000/api";

const SPORTS = [
  { name: "Cricket", accent: "linear-gradient(135deg, #1d976c, #93f9b9)", icon: "🏏" },
  { name: "Football", accent: "linear-gradient(135deg, #0f2027, #2c5364)", icon: "⚽" },
  { name: "Basketball", accent: "linear-gradient(135deg, #ff8008, #ffc837)", icon: "🏀" },
  { name: "Volleyball", accent: "linear-gradient(135deg, #4568dc, #b06ab3)", icon: "🏐" },
  { name: "Tennis", accent: "linear-gradient(135deg, #56ab2f, #a8e063)", icon: "🎾" },
  { name: "Badminton", accent: "linear-gradient(135deg, #2193b0, #6dd5ed)", icon: "🏸" },
  { name: "Hockey", accent: "linear-gradient(135deg, #355c7d, #6c5b7b)", icon: "🏑" },
  { name: "Athletics", accent: "linear-gradient(135deg, #ee0979, #ff6a00)", icon: "🏃" },
  { name: "Kabaddi", accent: "linear-gradient(135deg, #614385, #516395)", icon: "🤼" },
  { name: "Table Tennis", accent: "linear-gradient(135deg, #0cebeb, #20e3b2)", icon: "🏓" },
  { name: "Swimming", accent: "linear-gradient(135deg, #1488cc, #2b32b2)", icon: "🏊" },
  { name: "Wrestling", accent: "linear-gradient(135deg, #8e2de2, #4a00e0)", icon: "🥇" },
  { name: "Boxing", accent: "linear-gradient(135deg, #cb2d3e, #ef473a)", icon: "🥊" },
  { name: "Baseball", accent: "linear-gradient(135deg, #f46b45, #eea849)", icon: "⚾" }
];

const POSITION_MAP = {
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

const AGE_GROUPS = ["Under 12", "13-15", "16-18", "19-22", "23+"];
const METRIC_LABELS = [
  ["speedScore", "Speed Score"],
  ["accuracyScore", "Accuracy Score"],
  ["reactionTime", "Reaction Time"],
  ["movementEfficiency", "Movement Efficiency"],
  ["techniqueQuality", "Technique Quality"],
  ["staminaEstimation", "Stamina Estimation"]
];

const emptyRegister = {
  fullName: "",
  email: "",
  password: "",
  mobileNumber: "",
  dateOfBirth: "",
  gender: "",
  country: "",
  phoneOtp: ""
};

function parseHash() {
  const raw = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);
  return {
    entryPage: params.get("entry") || "welcome",
    role: params.get("role") || "player",
    mode: params.get("mode") || "login",
    playerPage: params.get("playerPage") || "sports",
    selectedSport: params.get("sport") || "",
    videoId: params.get("videoId") || ""
  };
}

function buildHash({ entryPage, role, mode, playerPage, selectedSport, videoId }) {
  const params = new URLSearchParams();
  if (entryPage) params.set("entry", entryPage);
  if (role) params.set("role", role);
  if (mode) params.set("mode", mode);
  if (playerPage) params.set("playerPage", playerPage);
  if (selectedSport) params.set("sport", selectedSport);
  if (videoId) params.set("videoId", videoId);
  return `#${params.toString()}`;
}

async function adminApi(path, adminKey) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "x-admin-key": adminKey
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Admin request failed.");
  }
  return data;
}

function getStoredSession() {
  const raw = localStorage.getItem("sports-platform-session");
  return raw ? JSON.parse(raw) : null;
}

function storeSession(session) {
  localStorage.setItem("sports-platform-session", JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem("sports-platform-session");
}

async function api(path, options = {}, token) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }
  return data;
}

async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function waitForEvent(target, eventName) {
  return new Promise((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Unable to analyze the selected video."));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onSuccess);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(eventName, onSuccess, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function sampleFrameStats(context, width, height, previousFrame) {
  const { data } = context.getImageData(0, 0, width, height);
  let brightnessTotal = 0;
  let diffTotal = 0;
  let sharpnessTotal = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    brightnessTotal += brightness;

    if (previousFrame) {
      const prevBrightness = previousFrame[i / 4];
      diffTotal += Math.abs(brightness - prevBrightness);
    }

    if (i >= 4) {
      const prevR = data[i - 4];
      const prevG = data[i - 3];
      const prevB = data[i - 2];
      sharpnessTotal += Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
    }
  }

  const pixelCount = width * height;
  const brightnessValues = new Float32Array(pixelCount);
  for (let i = 0, pixelIndex = 0; i < data.length; i += 4, pixelIndex += 1) {
    brightnessValues[pixelIndex] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  return {
    brightness: brightnessTotal / pixelCount,
    motion: previousFrame ? diffTotal / pixelCount : 0,
    sharpness: sharpnessTotal / pixelCount,
    frame: brightnessValues
  };
}

async function analyzeVideoFile(file) {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;

  try {
    await waitForEvent(video, "loadedmetadata");

    const durationSec = Number(video.duration || 0);
    const width = Number(video.videoWidth || 0);
    const height = Number(video.videoHeight || 0);
    const sampleCount = durationSec > 12 ? 6 : 4;
    const sampleTimes = Array.from({ length: sampleCount }, (_, index) =>
      Math.max(0, Math.min(durationSec - 0.05, (durationSec * (index + 1)) / (sampleCount + 1)))
    );

    const canvas = document.createElement("canvas");
    const sampleWidth = 96;
    const sampleHeight = 54;
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Canvas analysis unavailable.");
    }

    const brightnessValues = [];
    const motionValues = [];
    const sharpnessValues = [];
    let previousFrame = null;

    for (const sampleTime of sampleTimes) {
      video.currentTime = sampleTime;
      await waitForEvent(video, "seeked");
      context.drawImage(video, 0, 0, sampleWidth, sampleHeight);
      const stats = sampleFrameStats(context, sampleWidth, sampleHeight, previousFrame);
      brightnessValues.push(stats.brightness);
      motionValues.push(stats.motion);
      sharpnessValues.push(stats.sharpness);
      previousFrame = stats.frame;
    }

    const average = (values) => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
    const standardDeviation = (values, mean) =>
      Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length || 1));

    const averageBrightness = average(brightnessValues);
    const averageMotion = average(motionValues);
    const averageSharpness = average(sharpnessValues);
    const brightnessDeviation = standardDeviation(brightnessValues, averageBrightness);

    return {
      durationSec,
      width,
      height,
      fileSizeMb: file.size / (1024 * 1024),
      brightnessScore: Math.max(0, Math.min(100, (averageBrightness / 255) * 100)),
      motionScore: Math.max(0, Math.min(100, averageMotion / 1.8)),
      sharpnessScore: Math.max(0, Math.min(100, averageSharpness / 2.2)),
      brightnessConsistency: Math.max(0, Math.min(100, 100 - brightnessDeviation * 1.4))
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

function RadarChart({ metrics }) {
  const values = METRIC_LABELS.map(([key]) => metrics[key] || 0);
  const size = 220;
  const center = size / 2;
  const radius = 74;
  const points = values
    .map((value, index) => {
      const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
      const scaled = (value / 100) * radius;
      const x = center + Math.cos(angle) * scaled;
      const y = center + Math.sin(angle) * scaled;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="radar-card">
      <svg viewBox={`0 0 ${size} ${size}`} className="radar-svg">
        {[20, 40, 60, 80, 100].map((level) => {
          const ring = METRIC_LABELS.map((_, index) => {
            const angle = (Math.PI * 2 * index) / METRIC_LABELS.length - Math.PI / 2;
            const scaled = (level / 100) * radius;
            const x = center + Math.cos(angle) * scaled;
            const y = center + Math.sin(angle) * scaled;
            return `${x},${y}`;
          }).join(" ");
          return <polygon key={level} points={ring} fill="none" stroke="rgba(255,255,255,0.14)" />;
        })}
        {METRIC_LABELS.map((entry, index) => {
          const angle = (Math.PI * 2 * index) / METRIC_LABELS.length - Math.PI / 2;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return <line key={entry[0]} x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,0.18)" />;
        })}
        <polygon points={points} fill="rgba(105, 214, 255, 0.32)" stroke="#69d6ff" strokeWidth="2" />
      </svg>
    </div>
  );
}

function ProfileMenu({ user, onLogout, onUpload }) {
  const fileInput = useRef(null);
  const [showDetails, setShowDetails] = useState(false);
  const detailsLabel = user.role === "coach" ? "Coach Details" : "Player Details";

  return (
    <div className="profile-menu">
      <button className="profile-trigger" type="button">
        {user.profileImage ? <img src={`http://localhost:4000${user.profileImage}`} alt={user.fullName} /> : user.fullName[0]}
      </button>
      <div className="profile-dropdown">
        <div className="profile-header-name">
          <strong>{user.fullName}</strong>
        </div>
        <div className="profile-actions">
          <button className="dropdown-action" type="button" onClick={() => fileInput.current?.click()}>
            Upload Profile Picture
          </button>
          <button className="dropdown-action" type="button" onClick={() => setShowDetails((current) => !current)}>
            {detailsLabel}
          </button>
          {showDetails ? (
            <div className="profile-summary">
              <span>{user.email}</span>
              <span>{user.id}</span>
              <span>{user.mobileNumber}</span>
              <span>{user.gender}</span>
              <span>{user.country}</span>
              <span>{user.age} years</span>
              {user.primarySport ? <span>{user.primarySport}</span> : null}
            </div>
          ) : null}
          <a className="dropdown-action support-link" href="mailto:support@talentforge.com">
            Customer Support
          </a>
          <button className="dropdown-action danger" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
        <input
          ref={fileInput}
          hidden
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
          }}
        />
      </div>
    </div>
  );
}

function AuthPanel({ role, mode, onSwitchMode, onSubmit, loading, message }) {
  const [form, setForm] = useState(emptyRegister);
  const [otpStatus, setOtpStatus] = useState("");
  const [otpLoading, setOtpLoading] = useState({ phone: false, verifyPhone: false });
  const [verification, setVerification] = useState({
    phoneVerified: false,
    phoneVerifiedToken: ""
  });
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);

  async function requestOtp() {
    const value = form.mobileNumber;
    if (!value) {
      setOtpStatus("Enter mobile number first.");
      return;
    }
    setOtpLoading((current) => ({ ...current, phone: true }));
    try {
      const result = await api("/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "phone", value })
      });
      setOtpStatus(result.message);
      setPhoneOtpSent(true);
      setVerification((current) => ({ ...current, phoneVerified: false, phoneVerifiedToken: "" }));
    } catch (error) {
      setOtpStatus(error.message);
    } finally {
      setOtpLoading((current) => ({ ...current, phone: false }));
    }
  }

  async function verifyOtp() {
    const value = form.mobileNumber;
    const otp = form.phoneOtp;
    if (!value || !otp) {
      setOtpStatus("Enter mobile number and phone OTP.");
      return;
    }
    setOtpLoading((current) => ({ ...current, verifyPhone: true }));
    try {
      const result = await api("/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "phone", value, otp })
      });
      setOtpStatus(result.message);
      setVerification((current) => ({
        ...current,
        phoneVerified: true,
        phoneVerifiedToken: result.verifiedToken
      }));
    } catch (error) {
      setOtpStatus(error.message);
    } finally {
      setOtpLoading((current) => ({ ...current, verifyPhone: false }));
    }
  }

  return (
    <section className="auth-card">
      <div className="section-eyebrow">{role === "player" ? "Player Access" : "Coach Access"}</div>
      <h2>{mode === "login" ? "Welcome back" : `Create your ${role} account`}</h2>
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ ...form, ...verification });
        }}
      >
        {mode === "register" ? (
          <>
            <input placeholder="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <div className="inline-action-field">
              <input placeholder="Mobile Number" value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} required />
              <button className="inline-action-btn" type="button" onClick={() => requestOtp()} disabled={otpLoading.phone}>
                {otpLoading.phone ? "Sending..." : phoneOtpSent ? "OTP Sent" : "Send OTP"}
              </button>
            </div>
            <div className="inline-action-field">
              <input
                placeholder="Enter OTP"
                value={form.phoneOtp}
                onChange={(e) => setForm({ ...form, phoneOtp: e.target.value })}
                disabled={!phoneOtpSent}
                required
              />
              <button className="inline-action-btn" type="button" onClick={() => verifyOtp()} disabled={!phoneOtpSent || otpLoading.verifyPhone}>
                {verification.phoneVerified ? "Verified" : otpLoading.verifyPhone ? "Verifying..." : "Verify Phone"}
              </button>
            </div>
            <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} required />
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} required>
              <option value="">Select Gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
            <input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required />
          </>
        ) : (
          <>
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </>
        )}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>
      </form>
      {otpStatus ? <div className="info-banner">{otpStatus}</div> : null}
      {message ? <div className="info-banner">{message}</div> : null}
      <button className="text-btn" type="button" onClick={onSwitchMode}>
        {mode === "login" ? "Need an account? Register" : "Already registered? Login"}
      </button>
    </section>
  );
}

function SportCard({ sport, selected, onSelect }) {
  return (
    <button
      className={`sport-card ${selected ? "active" : ""}`}
      type="button"
      style={{ background: sport.accent }}
      onClick={() => onSelect(sport.name)}
    >
      <div className="thumb-overlay">
        <span className="sport-icon">{sport.icon}</span>
        <span className="play-pill">AI-ready</span>
      </div>
      <div className="sport-card-footer">
        <strong>{sport.name}</strong>
        <span>Upload assessment</span>
      </div>
    </button>
  );
}

function VideoUploadForm({ user, selectedSport, onBack, onUploaded, token }) {
  const [ageGroup, setAgeGroup] = useState("");
  const [position, setPosition] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || !file.type.startsWith("video/")) {
      setStatus("Only video files are allowed.");
      return;
    }

    setLoading(true);
    setStatus("Analyzing Video...");

    let analysisMeta;
    let videoHash;
    try {
      [analysisMeta, videoHash] = await Promise.all([analyzeVideoFile(file), hashFile(file)]);
    } catch (error) {
      setLoading(false);
      setStatus(error.message);
      return;
    }

    setStatus("Uploading Video...");
    const formData = new FormData();
    formData.append("video", file);
    formData.append("sport", selectedSport);
    formData.append("ageGroup", ageGroup);
    formData.append("position", position);
    formData.append("analysisMeta", JSON.stringify(analysisMeta));
    formData.append("videoHash", videoHash);

    try {
      const result = await api("/videos/upload", { method: "POST", body: formData }, token);
      setStatus(result.warning || "Video Successfully Submitted");
      onUploaded(result.video);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-eyebrow">Performance Upload</div>
          <h3>{selectedSport} submission</h3>
        </div>
        <button className="ghost-btn" type="button" onClick={onBack}>
          Back to Sports
        </button>
      </div>
      <form className="upload-grid" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={user.fullName} disabled />
        </label>
        <label>
          Email
          <input value={user.email} disabled />
        </label>
        <label>
          Player ID
          <input value={user.id} disabled />
        </label>
        <label>
          Selected Sport
          <input value={selectedSport} disabled />
        </label>
        <label>
          Age Selection
          <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} required>
            <option value="">Select age group</option>
            {AGE_GROUPS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Position Selection
          <select value={position} onChange={(e) => setPosition(e.target.value)} required>
            <option value="">Select position</option>
            {(POSITION_MAP[selectedSport] || []).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="file-drop">
          Performance Video
          <input
            type="file"
            accept=".mp4,.mov,.avi,video/mp4,video/quicktime,video/x-msvideo"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
        </label>
        <button className="primary-btn" type="submit" disabled={loading}>
          Submit Performance
        </button>
      </form>
      {status ? <div className="info-banner">{status}</div> : null}
    </section>
  );
}

function UploadedReview({ video, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.6;
    }
  }, [video]);

  if (!video) return null;

  return (
    <section className="panel stack-gap">
      <div className="panel-head">
        <div>
          <div className="section-eyebrow">Playback + AI Analysis</div>
          <h3>Submission review</h3>
        </div>
        <button className="ghost-btn" type="button" onClick={onClose}>
          Close Review
        </button>
      </div>
      <div className="video-stage">
        <video ref={videoRef} src={`http://localhost:4000${video.videoUrl}`} controls autoPlay muted playsInline className="video-player" />
      </div>
      <div className="analysis-grid">
        <div className="panel subtle score-panel">
          <h4>Overall Performance</h4>
          <div className="score-hero">{video.aiMetrics.overallPerformanceScore}%</div>
          <p>{video.aiMetrics.summary}</p>
          <div className="suggestion-list">
            {video.aiMetrics.suggestions.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <RadarChart metrics={video.aiMetrics} />
      </div>
      {video.aiMetrics.analysisBasis ? (
        <div className="analysis-basis">
          <div className="basis-pill">Duration: {video.aiMetrics.analysisBasis.durationSec}s</div>
          <div className="basis-pill">Resolution: {video.aiMetrics.analysisBasis.resolution}</div>
          <div className="basis-pill">File Size: {video.aiMetrics.analysisBasis.fileSizeMb} MB</div>
          <div className="basis-pill">Brightness: {video.aiMetrics.analysisBasis.brightnessScore}%</div>
          <div className="basis-pill">Motion: {video.aiMetrics.analysisBasis.motionScore}%</div>
          <div className="basis-pill">Sharpness: {video.aiMetrics.analysisBasis.sharpnessScore}%</div>
        </div>
      ) : null}
      <div className="metrics-list">
        {METRIC_LABELS.map(([key, label]) => (
          <div className="metric-row" key={key}>
            <div className="metric-meta">
              <span>{label}</span>
              <strong>{video.aiMetrics[key]}%</strong>
            </div>
            <div className="metric-bar">
              <span style={{ width: `${video.aiMetrics[key]}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlayerDashboard({ user, videos, token, onRefresh, onShowVideo }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const filteredVideos = videos.filter((video) =>
    `${video.sport} ${video.position}`.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  async function handleDelete(videoId) {
    try {
      await api(`/player/videos/${videoId}`, { method: "DELETE" }, token);
      setMessage("Video deleted successfully.");
      await onRefresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-eyebrow">Player Dashboard</div>
          <h3>Your performance history</h3>
        </div>
      </div>
      <div className="stat-row">
        <div className="stat-card">
          <span>Best Score</span>
          <strong>{videos[0] ? Math.max(...videos.map((v) => v.aiMetrics.overallPerformanceScore)) : 0}%</strong>
        </div>
      </div>
      <div className="sports-search-wrap">
        <input
          className="sports-search"
          type="text"
          placeholder="Search by sport or position"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>
      {message ? <div className="info-banner">{message}</div> : null}
      <div className="dashboard-list">
        {videos.length === 0 ? <div className="empty-card">No performance videos yet. Upload a new assessment to begin.</div> : null}
        {videos.length > 0 && filteredVideos.length === 0 ? <div className="empty-card">No matching uploads found.</div> : null}
        {filteredVideos.map((video) => (
          <article className="video-card" key={video.id}>
            <div className="video-card-head">
              <div>
                <strong>{video.sport}</strong>
                <span>{video.position}</span>
              </div>
              <div className="pill">{video.aiMetrics.overallPerformanceScore}%</div>
            </div>
            <div className="video-meta">
              <span>{video.ageGroup}</span>
              <span>{new Date(video.uploadDate).toLocaleDateString()}</span>
            </div>
            <div className="dashboard-score-grid">
              {METRIC_LABELS.map(([key, label]) => (
                <div className="dashboard-score-item" key={key}>
                  <span>{label}</span>
                  <strong>{video.aiMetrics[key]}%</strong>
                </div>
              ))}
            </div>
            <button className="primary-btn" type="button" onClick={() => onShowVideo(video)}>
              Show Video
            </button>
            <button className="ghost-btn" type="button" onClick={() => handleDelete(video.id)}>
              Delete Video
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PlayerVideoPage({ video, onBack }) {
  if (!video) return null;

  return (
    <section className="panel stack-gap">
      <div className="panel-head">
        <div>
          <div className="section-eyebrow">Video Page</div>
          <h3>{video.sport} performance video</h3>
        </div>
        <button className="ghost-btn" type="button" onClick={onBack}>
          Back to Dashboard
        </button>
      </div>
      <div className="video-stage">
        <video src={`http://localhost:4000${video.videoUrl}`} controls autoPlay playsInline className="video-player" />
      </div>
    </section>
  );
}

function CoachVideoPage({ video, onBack }) {
  if (!video) return null;

  return (
    <section className="panel stack-gap">
      <div className="panel-head">
        <div>
          <div className="section-eyebrow">Coach Video Page</div>
          <h3>{video.playerName} performance video</h3>
        </div>
        <button className="ghost-btn" type="button" onClick={onBack}>
          Back to Coach Dashboard
        </button>
      </div>
      <div className="video-stage">
        <video src={`http://localhost:4000${video.videoUrl}`} controls autoPlay playsInline className="video-player" />
      </div>
    </section>
  );
}

function AdminPage() {
  const [adminKey, setAdminKey] = useState(localStorage.getItem("sports-admin-key") || "");
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadDatabase() {
    setLoading(true);
    setStatus("");
    try {
      const result = await adminApi("/admin/database", adminKey);
      setSnapshot(result);
      localStorage.setItem("sports-admin-key", adminKey);
    } catch (error) {
      setStatus(error.message);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-layout">
      <section className="panel admin-panel">
        <div className="panel-head">
          <div>
            <div className="section-eyebrow">Admin Page</div>
            <h3>Database Viewer</h3>
          </div>
        </div>
        <div className="admin-key-row">
          <input
            className="sports-search"
            type="password"
            placeholder="Enter admin key"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
          />
          <button className="primary-btn" type="button" onClick={loadDatabase} disabled={loading || !adminKey}>
            {loading ? "Loading..." : "Load Database"}
          </button>
        </div>
        {status ? <div className="info-banner">{status}</div> : null}
        {snapshot ? (
          <div className="stack-gap">
            <div className="stat-row">
              <div className="stat-card">
                <span>Players</span>
                <strong>{snapshot.summary.players}</strong>
              </div>
              <div className="stat-card">
                <span>Coaches</span>
                <strong>{snapshot.summary.coaches}</strong>
              </div>
              <div className="stat-card">
                <span>Videos</span>
                <strong>{snapshot.summary.videos}</strong>
              </div>
            </div>

            <section className="panel admin-subpanel">
              <div className="section-eyebrow">Players</div>
              <pre className="admin-pre">{JSON.stringify(snapshot.players, null, 2)}</pre>
            </section>

            <section className="panel admin-subpanel">
              <div className="section-eyebrow">Coaches</div>
              <pre className="admin-pre">{JSON.stringify(snapshot.coaches, null, 2)}</pre>
            </section>

            <section className="panel admin-subpanel">
              <div className="section-eyebrow">Videos</div>
              <pre className="admin-pre">{JSON.stringify(snapshot.videos, null, 2)}</pre>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function CoachDashboard({ token, user }) {
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState({ q: "", sport: "", position: "", minScore: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [coachPage, setCoachPage] = useState("dashboard");

  async function loadData(currentFilters = filters) {
    setLoading(true);
    const query = new URLSearchParams(currentFilters).toString();
    try {
      const [playersRes, selectedRes] = await Promise.all([
        api(`/coach/players?${query}`, {}, token),
        api("/coach/selected", {}, token)
      ]);
      setPlayers(playersRes.players);
      setSelected(selectedRes.selectedPlayers);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleSelection(playerId, chosen) {
    try {
      if (chosen) {
        await api(`/coach/selected/${playerId}`, { method: "DELETE" }, token);
      } else {
        await api(`/coach/selected/${playerId}`, { method: "POST" }, token);
      }
      setMessage(chosen ? "Player removed from dashboard." : "Player added to dashboard.");
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const selectedIds = new Set(selected.map((item) => item.playerId));
  const positions = useMemo(() => Object.values(POSITION_MAP).flat(), []);

  if (coachPage === "video") {
    return <CoachVideoPage video={selectedVideo} onBack={() => setCoachPage("dashboard")} />;
  }

  return (
    <section className="stack-gap">
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="section-eyebrow">Coach Dashboard</div>
            <h3>{user.fullName}'s selection board</h3>
          </div>
        </div>
        <div className="filter-grid">
          <input
            placeholder="Search players"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
          <select value={filters.sport} onChange={(e) => setFilters({ ...filters, sport: e.target.value })}>
            <option value="">Filter by sport</option>
            {SPORTS.map((sport) => (
              <option key={sport.name}>{sport.name}</option>
            ))}
          </select>
          <select value={filters.position} onChange={(e) => setFilters({ ...filters, position: e.target.value })}>
            <option value="">Filter by position</option>
            {positions.map((position) => (
              <option key={position}>{position}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="Minimum score"
            value={filters.minScore}
            onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
          />
          <button className="primary-btn" type="button" onClick={() => loadData()}>
            Apply Filters
          </button>
        </div>
        {message ? <div className="info-banner">{message}</div> : null}
        {loading ? <div className="empty-card">Loading player assessments...</div> : null}
        <div className="dashboard-list">
          {players.map((entry) => {
            const chosen = selectedIds.has(entry.playerId);
            return (
              <article className="video-card" key={entry.id}>
                <div className="video-card-head">
                  <div>
                    <strong>{entry.playerName}</strong>
                    <span>{entry.sport} • {entry.position}</span>
                  </div>
                  <div className="pill">{entry.aiMetrics.overallPerformanceScore}%</div>
                </div>
                <div className="video-meta">
                  <span>{entry.ageGroup}</span>
                  <span>{new Date(entry.uploadDate).toLocaleDateString()}</span>
                </div>
                <div className="dashboard-score-grid">
                  {METRIC_LABELS.map(([key, label]) => (
                    <div className="dashboard-score-item" key={key}>
                      <span>{label}</span>
                      <strong>{entry.aiMetrics[key]}%</strong>
                    </div>
                  ))}
                </div>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => {
                    setSelectedVideo(entry);
                    setCoachPage("video");
                  }}
                >
                  Show Video
                </button>
                <button className={chosen ? "ghost-btn" : "primary-btn"} type="button" onClick={() => toggleSelection(entry.playerId, chosen)}>
                  {chosen ? "Remove Player" : "Add Player to Dashboard"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="section-eyebrow">Selected Players</div>
            <h3>Shortlisted talent</h3>
          </div>
        </div>
        <div className="dashboard-list">
          {selected.length === 0 ? <div className="empty-card">No selected players yet.</div> : null}
          {selected.map((entry) => (
            <article className="video-card" key={`${entry.playerId}-${entry.id}`}>
              <div className="video-card-head">
                <div>
                  <strong>{entry.playerName}</strong>
                  <span>{entry.sport} • {entry.position}</span>
                </div>
                <div className="pill">{entry.aiMetrics.overallPerformanceScore}%</div>
              </div>
              <div className="dashboard-score-grid">
                {METRIC_LABELS.map(([key, label]) => (
                  <div className="dashboard-score-item" key={key}>
                    <span>{label}</span>
                    <strong>{entry.aiMetrics[key]}%</strong>
                  </div>
                ))}
              </div>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  setSelectedVideo(entry);
                  setCoachPage("video");
                }}
              >
                Show Video
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default function App() {
  const initialRoute = typeof window !== "undefined" ? parseHash() : null;
  const [role, setRole] = useState(initialRoute?.role || "player");
  const [mode, setMode] = useState(initialRoute?.mode || "login");
  const [session, setSession] = useState(getStoredSession());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedSport, setSelectedSport] = useState(initialRoute?.selectedSport || "");
  const [dashboard, setDashboard] = useState([]);
  const [latestVideo, setLatestVideo] = useState(null);
  const [playerPage, setPlayerPage] = useState(initialRoute?.playerPage || "sports");
  const [entryPage, setEntryPage] = useState(initialRoute?.entryPage || "welcome");
  const [sportSearch, setSportSearch] = useState("");
  const restoringFromHash = useRef(false);

  useEffect(() => {
    if (!session) return;
    api("/auth/me", {}, session.token)
      .then(({ user }) => {
        const updated = { ...session, user };
        setSession(updated);
        storeSession(updated);
      })
      .catch(() => {
        clearSession();
        setSession(null);
      });
  }, []);

  useEffect(() => {
    function handleHashChange() {
      const route = parseHash();
      restoringFromHash.current = true;
      setEntryPage(route.entryPage);
      setRole(route.role);
      setMode(route.mode);
      setPlayerPage(route.playerPage);
      setSelectedSport(route.selectedSport);
      if (!route.videoId) {
        setLatestVideo(null);
      }
    }

    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) {
      window.history.replaceState(null, "", buildHash({
        entryPage: initialRoute?.entryPage || "welcome",
        role: initialRoute?.role || "player",
        mode: initialRoute?.mode || "login",
        playerPage: initialRoute?.playerPage || "sports",
        selectedSport: initialRoute?.selectedSport || "",
        videoId: initialRoute?.videoId || ""
      }));
    }
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (restoringFromHash.current) {
      restoringFromHash.current = false;
      return;
    }
    const nextHash = buildHash({
      entryPage,
      role,
      mode,
      playerPage,
      selectedSport,
      videoId: latestVideo?.id || ""
    });
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [entryPage, role, mode, playerPage, selectedSport, latestVideo]);

  useEffect(() => {
    if (!session || session.user.role !== "player") return;
    api("/player/dashboard", {}, session.token)
      .then(({ videos }) => {
        setDashboard(videos);
        const route = parseHash();
        if (route.videoId) {
          const matchedVideo = videos.find((video) => video.id === route.videoId);
          if (matchedVideo) {
            setLatestVideo(matchedVideo);
          }
        }
      })
      .catch((error) => setMessage(error.message));
  }, [session]);

  async function handleAuth(form) {
    setLoading(true);
    setMessage("");
    try {
      const payload =
        mode === "register"
          ? form
          : {
              email: form.email,
              password: form.password
            };
      const result = await api(`/auth/${role}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const newSession = { token: result.token, user: result.user };
      setSession(newSession);
      storeSession(newSession);
      setMessage(result.message);
      setMode("login");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileUpload(file) {
    if (!file.type.startsWith("image/")) {
      setMessage("Only JPG, JPEG, and PNG images are allowed.");
      return;
    }
    const formData = new FormData();
    formData.append("profileImage", file);
    try {
      const result = await api("/profile/image", { method: "POST", body: formData }, session.token);
      const updated = { ...session, user: { ...session.user, profileImage: result.imageUrl } };
      setSession(updated);
      storeSession(updated);
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setDashboard([]);
    setSelectedSport("");
    setLatestVideo(null);
    setPlayerPage("sports");
    setEntryPage("welcome");
    setMessage("");
  }

  async function refreshPlayerData(video) {
    setLatestVideo(video);
    const result = await api("/player/dashboard", {}, session.token);
    setDashboard(result.videos);
    setPlayerPage("score");
  }

  function renderPlayerPage() {
    if (!session || session.user.role !== "player") return null;
    const filteredSports = SPORTS.filter((sport) =>
      sport.name.toLowerCase().includes(sportSearch.trim().toLowerCase())
    );

    if (playerPage === "video") {
      return <PlayerVideoPage video={latestVideo} onBack={() => setPlayerPage("dashboard")} />;
    }

    if (playerPage === "dashboard") {
      return (
        <PlayerDashboard
          user={{ ...session.user, age: calculateAge(session.user.dateOfBirth) }}
          videos={dashboard}
          token={session.token}
          onRefresh={async () => {
            const result = await api("/player/dashboard", {}, session.token);
            setDashboard(result.videos);
          }}
          onShowVideo={(video) => {
            setLatestVideo(video);
            setPlayerPage("video");
          }}
        />
      );
    }

    if (playerPage === "upload") {
      return (
        <VideoUploadForm
          user={session.user}
          selectedSport={selectedSport}
          onBack={() => setPlayerPage("sports")}
          onUploaded={refreshPlayerData}
          token={session.token}
        />
      );
    }

    if (playerPage === "score") {
      return (
        <UploadedReview
          video={latestVideo}
          onClose={() => setPlayerPage("sports")}
        />
      );
    }

    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="section-eyebrow">Sports Page</div>
            <h3>Choose your sport and continue to upload</h3>
          </div>
        </div>
        <div className="sports-search-wrap">
          <input
            className="sports-search"
            type="text"
            placeholder="Search sports"
            value={sportSearch}
            onChange={(event) => setSportSearch(event.target.value)}
          />
        </div>
        <div className="sports-grid">
          {filteredSports.map((sport) => (
            <SportCard
              key={sport.name}
              sport={sport}
              selected={selectedSport === sport.name}
              onSelect={(sportName) => {
                setSelectedSport(sportName);
                setPlayerPage("upload");
              }}
            />
          ))}
        </div>
        {filteredSports.length === 0 ? <div className="empty-card">No sports found.</div> : null}
      </section>
    );
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      {entryPage === "admin" ? <AdminPage /> : null}
      {entryPage === "admin" ? null : (
        <>
          {(session || entryPage === "auth") ? (
            <header className="hero">
              <div className="hero-copy">
                <div className="section-eyebrow">Sports Talent Platform</div>
                <h1>Player Access</h1>
              </div>
              {session ? (
                <ProfileMenu
                  user={session.user}
                  onLogout={handleLogout}
                  onUpload={handleProfileUpload}
                />
              ) : (
                <div className="mode-switch">
                  <button className={role === "player" ? "chip active" : "chip"} type="button" onClick={() => setRole("player")}>
                    Player
                  </button>
                  <button className={role === "coach" ? "chip active" : "chip"} type="button" onClick={() => setRole("coach")}>
                    Coach
                  </button>
                </div>
              )}
            </header>
          ) : null}

          {!session ? (
        entryPage === "welcome" ? (
          <main className="welcome-layout">
            <section className="welcome-card">
              <div className="section-eyebrow">TalentForge Sports</div>
              <h2>Simple player assessment for coaches and athletes.</h2>
              <button className="primary-btn welcome-btn" type="button" onClick={() => setEntryPage("auth")}>
                Get Started
              </button>
            </section>
          </main>
        ) : (
          <main className="auth-layout">
            <AuthPanel
              role={role}
              mode={mode}
              onSwitchMode={() => setMode((current) => (current === "login" ? "register" : "login"))}
              onSubmit={handleAuth}
              loading={loading}
              message={message}
            />
          </main>
        )
      ) : session.user.role === "player" ? (
        <main className="content-stack">
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="section-eyebrow">Player Journey</div>
                <h3>Player Journey</h3>
              </div>
              <div className="page-steps">
                <button
                  className={playerPage === "sports" ? "chip active" : "chip"}
                  type="button"
                  onClick={() => setPlayerPage("sports")}
                >
                  Sports
                </button>
                <button
                  className={playerPage === "upload" ? "chip active" : "chip"}
                  type="button"
                  onClick={() => selectedSport && setPlayerPage("upload")}
                  disabled={!selectedSport}
                >
                  Upload
                </button>
                <button
                  className={playerPage === "score" ? "chip active" : "chip"}
                  type="button"
                  onClick={() => latestVideo && setPlayerPage("score")}
                  disabled={!latestVideo}
                >
                  Score
                </button>
                <button
                  className={playerPage === "dashboard" ? "chip active" : "chip"}
                  type="button"
                  onClick={() => setPlayerPage("dashboard")}
                >
                  Dashboard
                </button>
              </div>
            </div>
          </section>
          {renderPlayerPage()}
        </main>
      ) : (
        <main className="content-stack">
          <CoachDashboard token={session.token} user={session.user} />
        </main>
      )}
        </>
      )}
    </div>
  );
}
