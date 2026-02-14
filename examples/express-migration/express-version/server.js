import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

app.use(express.static(join(__dirname, "public")));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use("/api/", limiter);

app.use(
  session({
    secret: "taskapi-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

const users = [
  { id: 1, username: "admin", password: "password123" },
  { id: 2, username: "user", password: "userpass" },
];

passport.use(
  new LocalStrategy((username, password, done) => {
    const user = users.find((u) => u.username === username);
    if (!user) return done(null, false, { message: "User not found" });
    if (user.password !== password)
      return done(null, false, { message: "Incorrect password" });
    return done(null, user);
  })
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = users.find((u) => u.id === id);
  done(null, user);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, join(__dirname, "uploads")),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"));
    }
  },
});

const tasks = [
  { id: 1, title: "Build TaskAPI", completed: false, userId: 1 },
  { id: 2, title: "Test migration", completed: false, userId: 1 },
];

const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "Unauthorized" });
};

app.get("/", (req, res) => {
  res.json({
    name: "TaskAPI",
    version: "1.0.0",
    framework: "Express",
  });
});

app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
  res.json({
    message: "Logged in successfully",
    user: { id: req.user.id, username: req.user.username },
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.json({ message: "Logged out successfully" });
  });
});

app.get("/api/auth/me", ensureAuth, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
  });
});

app.get("/api/tasks", ensureAuth, (req, res) => {
  const userTasks = tasks.filter((t) => t.userId === req.user.id);
  res.json(userTasks);
});

app.post("/api/tasks", ensureAuth, (req, res) => {
  const { title } = req.body;
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: "Title is required" });
  }

  const newTask = {
    id: tasks.length + 1,
    title: title.trim(),
    completed: false,
    userId: req.user.id,
  };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.get("/api/tasks/:id", ensureAuth, (req, res) => {
  const task = tasks.find(
    (t) => t.id === parseInt(req.params.id) && t.userId === req.user.id
  );
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

app.put("/api/tasks/:id", ensureAuth, (req, res) => {
  const task = tasks.find(
    (t) => t.id === parseInt(req.params.id) && t.userId === req.user.id
  );
  if (!task) return res.status(404).json({ error: "Task not found" });

  const { title, completed } = req.body;
  if (title !== undefined) task.title = title.trim();
  if (completed !== undefined) task.completed = Boolean(completed);

  res.json(task);
});

app.delete("/api/tasks/:id", ensureAuth, (req, res) => {
  const index = tasks.findIndex(
    (t) => t.id === parseInt(req.params.id) && t.userId === req.user.id
  );
  if (index === -1) return res.status(404).json({ error: "Task not found" });

  tasks.splice(index, 1);
  res.status(204).send();
});

app.post("/api/upload/avatar", ensureAuth, upload.single("avatar"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    message: "Avatar uploaded successfully",
    file: {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/api/error/sync", (req, res) => {
  throw new Error("Synchronous error");
});

app.get("/api/error/async", async (req, res) => {
  throw new Error("Asynchronous error");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TaskAPI (Express) running on http://localhost:${PORT}`);
});
