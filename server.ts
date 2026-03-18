import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, "lingospaced.db"));

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
    points INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    last_study_date TEXT
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    teacher_id INTEGER NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS class_students (
    class_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    PRIMARY KEY(class_id, student_id),
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS study_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    class_id INTEGER NOT NULL,
    cefr_level TEXT,
    theme TEXT,
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    extra TEXT,
    image_url TEXT,
    audio_url TEXT,
    FOREIGN KEY(set_id) REFERENCES study_sets(id)
  );

  CREATE TABLE IF NOT EXISTS student_progress (
    student_id INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    next_review_date TEXT NOT NULL,
    interval INTEGER NOT NULL DEFAULT 0,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    repetitions INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'learning',
    PRIMARY KEY(student_id, card_id),
    FOREIGN KEY(student_id) REFERENCES users(id),
    FOREIGN KEY(card_id) REFERENCES flashcards(id)
  );

  CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    badge_name TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    set_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_seconds INTEGER DEFAULT 0,
    FOREIGN KEY(student_id) REFERENCES users(id),
    FOREIGN KEY(set_id) REFERENCES study_sets(id)
  );
`);

try {
  db.exec("ALTER TABLE study_sets ADD COLUMN cefr_level TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE study_sets ADD COLUMN theme TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN google_id TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN password TEXT");
} catch (e) {}

// Seed initial users if none exist
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const hash = bcrypt.hashSync('password123', 10);
  const insertUser = db.prepare("INSERT INTO users (name, role, password) VALUES (?, ?, ?)");
  insertUser.run("Mr. Smith", "teacher", hash);
  insertUser.run("Alice", "student", hash);
  insertUser.run("Bob", "student", hash);
} else {
  try {
    const hash = bcrypt.hashSync('password123', 10);
    db.prepare("UPDATE users SET password = ? WHERE password IS NULL").run(hash);
  } catch (e) {}
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images/audio

  // --- API Routes ---

  // Local Auth
  app.post('/api/auth/register', (req, res) => {
    try {
      const { name, password, role } = req.body;
      if (!name || !password || !role) return res.status(400).json({ error: 'Missing fields' });
      
      const existing = db.prepare("SELECT * FROM users WHERE name = ?").get(name);
      if (existing) return res.status(400).json({ error: 'Username already exists' });

      const hash = bcrypt.hashSync(password, 10);
      const info = db.prepare("INSERT INTO users (name, password, role) VALUES (?, ?, ?)").run(name, hash, role);
      
      const user = { id: info.lastInsertRowid, name, role, points: 0, streak: 0 };
      res.json(user);
    } catch (error: any) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Failed to register user: ' + error.message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { name, password } = req.body;
      if (!name || !password) return res.status(400).json({ error: 'Missing fields' });

      const user = db.prepare("SELECT * FROM users WHERE name = ?").get(name) as any;
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });

      if (user.password) {
        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) return res.status(400).json({ error: 'Invalid credentials' });
      } else {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Failed to login: ' + error.message });
    }
  });

  // Users
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.get("/api/users/:id", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (user) res.json(user);
    else res.status(404).json({ error: "User not found" });
  });

  // Classes
  app.get("/api/classes", (req, res) => {
    const { teacher_id, student_id } = req.query;
    if (teacher_id) {
      const classes = db.prepare("SELECT * FROM classes WHERE teacher_id = ?").all(teacher_id);
      res.json(classes);
    } else if (student_id) {
      const classes = db.prepare(`
        SELECT c.* FROM classes c
        JOIN class_students cs ON c.id = cs.class_id
        WHERE cs.student_id = ?
      `).all(student_id);
      res.json(classes);
    } else {
      res.json(db.prepare("SELECT * FROM classes").all());
    }
  });

  app.post("/api/classes", (req, res) => {
    const { name, teacher_id } = req.body;
    const join_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const info = db.prepare("INSERT INTO classes (name, teacher_id, join_code) VALUES (?, ?, ?)").run(name, teacher_id, join_code);
      res.json({ id: info.lastInsertRowid, name, teacher_id, join_code });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/classes/join", (req, res) => {
    const { join_code, student_id } = req.body;
    const cls = db.prepare("SELECT * FROM classes WHERE join_code = ?").get(join_code) as any;
    if (!cls) return res.status(404).json({ error: "Invalid join code" });
    try {
      db.prepare("INSERT INTO class_students (class_id, student_id) VALUES (?, ?)").run(cls.id, student_id);
      res.json({ success: true, class: cls });
    } catch (e: any) {
      res.status(400).json({ error: "Already joined or error" });
    }
  });

  // Leaderboard
  app.get("/api/classes/:class_id/leaderboard", (req, res) => {
    const leaderboard = db.prepare(`
      SELECT u.id, u.name, u.points, u.streak
      FROM users u
      JOIN class_students cs ON u.id = cs.student_id
      WHERE cs.class_id = ?
      ORDER BY u.points DESC
      LIMIT 10
    `).all(req.params.class_id);
    res.json(leaderboard);
  });

  // Study Sets
  app.get("/api/classes/:class_id/sets", (req, res) => {
    const sets = db.prepare("SELECT * FROM study_sets WHERE class_id = ?").all(req.params.class_id);
    res.json(sets);
  });

  app.post("/api/classes/:class_id/sets", (req, res) => {
    const { title, cefr_level, theme } = req.body;
    const info = db.prepare("INSERT INTO study_sets (title, class_id, cefr_level, theme) VALUES (?, ?, ?, ?)").run(title, req.params.class_id, cefr_level || null, theme || null);
    res.json({ id: info.lastInsertRowid, title, class_id: req.params.class_id, cefr_level, theme });
  });

  app.get("/api/sets/:set_id", (req, res) => {
    const set = db.prepare("SELECT * FROM study_sets WHERE id = ?").get(req.params.set_id);
    if (set) res.json(set);
    else res.status(404).json({ error: "Set not found" });
  });

  // Flashcards
  app.get("/api/sets/:set_id/cards", (req, res) => {
    const cards = db.prepare("SELECT * FROM flashcards WHERE set_id = ?").all(req.params.set_id);
    res.json(cards);
  });

  app.post("/api/sets/:set_id/cards", (req, res) => {
    const { front, back, extra, image_url, audio_url } = req.body;
    const info = db.prepare("INSERT INTO flashcards (set_id, front, back, extra, image_url, audio_url) VALUES (?, ?, ?, ?, ?, ?)").run(req.params.set_id, front, back, extra || null, image_url || null, audio_url || null);
    res.json({ id: info.lastInsertRowid, set_id: req.params.set_id, front, back, extra, image_url, audio_url });
  });

  app.put("/api/cards/:card_id", (req, res) => {
    const { front, back, extra, image_url, audio_url } = req.body;
    db.prepare("UPDATE flashcards SET front = ?, back = ?, extra = ?, image_url = ?, audio_url = ? WHERE id = ?").run(front, back, extra || null, image_url || null, audio_url || null, req.params.card_id);
    res.json({ success: true });
  });

  app.delete("/api/cards/:card_id", (req, res) => {
    db.prepare("DELETE FROM student_progress WHERE card_id = ?").run(req.params.card_id);
    db.prepare("DELETE FROM flashcards WHERE id = ?").run(req.params.card_id);
    res.json({ success: true });
  });

  app.post("/api/sets/:set_id/cards/batch", (req, res) => {
    const { cards } = req.body;
    const insert = db.prepare("INSERT INTO flashcards (set_id, front, back, extra, image_url, audio_url) VALUES (?, ?, ?, ?, ?, ?)");
    const insertMany = db.transaction((cardsToInsert) => {
      for (const card of cardsToInsert) {
        insert.run(req.params.set_id, card.front, card.back, card.extra || null, card.image_url || null, card.audio_url || null);
      }
    });
    insertMany(cards);
    res.json({ success: true });
  });

  // Progress / Study
  app.get("/api/study/:student_id/:set_id", (req, res) => {
    const { student_id, set_id } = req.params;
    const cards = db.prepare(`
      SELECT f.*, p.next_review_date, p.interval, p.ease_factor, p.repetitions, p.status
      FROM flashcards f
      LEFT JOIN student_progress p ON f.id = p.card_id AND p.student_id = ?
      WHERE f.set_id = ?
    `).all(student_id, set_id);
    res.json(cards);
  });

  app.post("/api/study/progress", (req, res) => {
    const { student_id, card_id, quality } = req.body; 
    
    let progress = db.prepare("SELECT * FROM student_progress WHERE student_id = ? AND card_id = ?").get(student_id, card_id) as any;
    
    let interval = 0;
    let repetitions = 0;
    let ease_factor = 2.5;
    let status = 'learning';

    if (progress) {
      interval = progress.interval;
      repetitions = progress.repetitions;
      ease_factor = progress.ease_factor;
      status = progress.status;
    }

    if (quality >= 3) {
      if (repetitions === 0) interval = 1;
      else if (repetitions === 1) interval = 6;
      else interval = Math.round(interval * ease_factor);
      repetitions += 1;
    } else {
      repetitions = 0;
      interval = 1;
    }

    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease_factor < 1.3) ease_factor = 1.3;

    if (interval > 21) {
      status = 'mastered';
    } else if (quality < 3 && repetitions > 3) {
      status = 'struggling';
    } else {
      status = 'learning';
    }

    const next_review_date = new Date();
    next_review_date.setDate(next_review_date.getDate() + interval);

    if (progress) {
      db.prepare(`
        UPDATE student_progress 
        SET next_review_date = ?, interval = ?, ease_factor = ?, repetitions = ?, status = ?
        WHERE student_id = ? AND card_id = ?
      `).run(next_review_date.toISOString(), interval, ease_factor, repetitions, status, student_id, card_id);
    } else {
      db.prepare(`
        INSERT INTO student_progress (student_id, card_id, next_review_date, interval, ease_factor, repetitions, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(student_id, card_id, next_review_date.toISOString(), interval, ease_factor, repetitions, status);
    }

    // Award points
    const pointsEarned = quality >= 3 ? 10 : 2;
    db.prepare("UPDATE users SET points = points + ? WHERE id = ?").run(pointsEarned, student_id);

    // Update streak
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(student_id) as any;
    const today = new Date().toISOString().split('T')[0];
    if (user.last_study_date !== today) {
      let newStreak = user.streak;
      if (user.last_study_date) {
        const lastDate = new Date(user.last_study_date);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastDate.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }
      db.prepare("UPDATE users SET streak = ?, last_study_date = ? WHERE id = ?").run(newStreak, today, student_id);
    }

    res.json({ success: true, pointsEarned });
  });

  // Study Sessions
  app.post("/api/study/session/start", (req, res) => {
    const { student_id, set_id } = req.body;
    const info = db.prepare("INSERT INTO study_sessions (student_id, set_id, start_time) VALUES (?, ?, ?)").run(student_id, set_id, new Date().toISOString());
    res.json({ session_id: info.lastInsertRowid });
  });

  app.post("/api/study/session/end", (req, res) => {
    const { session_id } = req.body;
    const session = db.prepare("SELECT * FROM study_sessions WHERE id = ?").get(session_id) as any;
    if (session) {
      const endTime = new Date();
      const startTime = new Date(session.start_time);
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      db.prepare("UPDATE study_sessions SET end_time = ?, duration_seconds = ? WHERE id = ?").run(endTime.toISOString(), duration, session_id);
      
      // Award completion points
      db.prepare("UPDATE users SET points = points + 50 WHERE id = ?").run(session.student_id);
      
      // Check for badges
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.student_id) as any;
      if (user.streak >= 3) {
        const hasBadge = db.prepare("SELECT * FROM badges WHERE student_id = ? AND badge_name = ?").get(session.student_id, '3-Day Streak');
        if (!hasBadge) {
          db.prepare("INSERT INTO badges (student_id, badge_name, earned_at) VALUES (?, ?, ?)").run(session.student_id, '3-Day Streak', new Date().toISOString());
        }
      }

      res.json({ success: true, duration, pointsEarned: 50 });
    } else {
      res.status(404).json({ error: "Session not found" });
    }
  });

  app.get("/api/users/:id/badges", (req, res) => {
    const badges = db.prepare("SELECT * FROM badges WHERE student_id = ?").all(req.params.id);
    res.json(badges);
  });

  // Teacher Analytics
  app.get("/api/analytics/class/:class_id", (req, res) => {
    const students = db.prepare(`
      SELECT u.id, u.name, u.points, u.streak 
      FROM users u
      JOIN class_students cs ON u.id = cs.student_id
      WHERE cs.class_id = ?
    `).all(req.params.class_id);

    const stats = db.prepare(`
      SELECT 
        p.student_id, 
        COUNT(p.card_id) as cards_studied, 
        AVG(p.ease_factor) as avg_ease,
        SUM(CASE WHEN p.status = 'mastered' THEN 1 ELSE 0 END) as mastered_count,
        SUM(CASE WHEN p.status = 'struggling' THEN 1 ELSE 0 END) as struggling_count
      FROM student_progress p
      JOIN flashcards f ON p.card_id = f.id
      JOIN study_sets s ON f.set_id = s.id
      WHERE s.class_id = ?
      GROUP BY p.student_id
    `).all(req.params.class_id);

    const timeStats = db.prepare(`
      SELECT 
        ss.student_id,
        SUM(ss.duration_seconds) as total_time_seconds
      FROM study_sessions ss
      JOIN study_sets s ON ss.set_id = s.id
      WHERE s.class_id = ?
      GROUP BY ss.student_id
    `).all(req.params.class_id);

    res.json({ students, stats, timeStats });
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
