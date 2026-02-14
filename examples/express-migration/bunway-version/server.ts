import bunway from "bunway";
import { Strategy as LocalStrategy } from "passport-local";

const app = bunway();

app.use(bunway.helmet());
app.use(bunway.cors());
app.use(bunway.json());
app.use(bunway.urlencoded({ extended: true }));
app.use(bunway.cookieParser());
app.use(bunway.static("./public"));

app.use(
  "/api/",
  bunway.rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

app.use(
  bunway.session({
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

const passport = bunway.passport();
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

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser((id: any, done) => {
  const user = users.find((u) => u.id === id);
  done(null, user);
});

const upload = bunway.upload({
  storage: bunway.upload.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname}`),
  }),
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

const ensureAuth = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "Unauthorized" });
};

app.get("/", (req, res) => {
  res.json({
    name: "TaskAPI",
    version: "1.0.0",
    framework: "bunway",
  });
});

app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
  res.json({
    message: "Logged in successfully",
    user: { id: req.user.id, username: req.user.username },
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.logout((err: any) => {
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

app.use((err: Error, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status((err as any).status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TaskAPI (bunway) running on http://localhost:${PORT}`);
});
