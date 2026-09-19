const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

async function setupDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);

  const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM students");
  if (countResult.rows[0].count === 0) {
    const student = await pool.query(
      `INSERT INTO students (student_name, email, department, semester, phone)
       VALUES ($1,$2,$3,$4,$5) RETURNING student_id`,
      ["Srikar", "srikar@example.com", "Computer Science", 4, "9876543210"]
    );
    const studentId = student.rows[0].student_id;

    const courses = await pool.query(
      `INSERT INTO courses (course_code, course_name, credits, faculty_name)
       VALUES
       ('CS301','Database Management Systems',4,'Dr. Rao'),
       ('CS302','Data Structures and Algorithms',4,'Dr. Sharma'),
       ('CS303','Operating Systems',3,'Dr. Kumar'),
       ('CS304','Web Technology',3,'Dr. Priya')
       ON CONFLICT (course_code) DO UPDATE SET course_name=EXCLUDED.course_name
       RETURNING course_id, course_code`
    );

    for (const c of courses.rows) {
      await pool.query(
        `INSERT INTO enrollments (student_id, course_id, semester)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [studentId, c.course_id, "Trimester 4"]
      );
    }

    const recordCourses = await pool.query(
      "SELECT course_id, course_code FROM courses ORDER BY course_id LIMIT 4"
    );
    const marks = [86, 79, 91, 88];
    for (let i = 0; i < recordCourses.rows.length; i++) {
      const m = marks[i];
      const grade = m >= 90 ? "A+" : m >= 80 ? "A" : "B+";
      await pool.query(
        `INSERT INTO academic_records (student_id, course_id, marks, grade, semester)
         VALUES ($1,$2,$3,$4,$5)`,
        [studentId, recordCourses.rows[i].course_id, m, grade, "Trimester 4"]
      );
    }

    await pool.query(
      `INSERT INTO notifications (student_id, title, message)
       VALUES
       ($1,'Welcome','Your EdTech student self-service account is ready.'),
       ($1,'Academic Update','Your latest academic records are available.')`,
      [studentId]
    );
  }

  const demoStudent = await pool.query("SELECT student_id FROM students ORDER BY student_id LIMIT 1");
  if (demoStudent.rows.length) {
    const studentId = demoStudent.rows[0].student_id;
    const courseRows = await pool.query("SELECT course_id, course_code, course_name FROM courses ORDER BY course_code LIMIT 4");
    const attendance = [[28, 25], [30, 24], [26, 24], [32, 27]];
    for (let i = 0; i < courseRows.rows.length; i++) {
      const course = courseRows.rows[i];
      await pool.query(
        `INSERT INTO attendance (student_id, course_id, classes_held, classes_attended)
         VALUES ($1,$2,$3,$4) ON CONFLICT (student_id, course_id) DO NOTHING`,
        [studentId, course.course_id, ...(attendance[i] || [24, 20])]
      );
      await pool.query(
        `INSERT INTO handouts (course_id, title, description, file_url)
         VALUES ($1,$2,$3,$4) ON CONFLICT (course_id, title) DO NOTHING`,
        [course.course_id, `${course.course_code} lecture notes`, `Core handout for ${course.course_name}`, "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"]
      );
    }
  }
}

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      "SELECT student_id, student_name, email, department, semester, phone FROM students WHERE LOWER(email)=LOWER($1) AND password=$2",
      [email, password]
    );
    if (!result.rows.length) return res.status(401).json({ message: "Invalid email or password." });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ success: true, message: "Backend and PostgreSQL are connected." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/students/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM students WHERE student_id=$1",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Student not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/students/:id/courses", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.course_id, c.course_code, c.course_name, c.credits, c.faculty_name, e.semester
       FROM enrollments e
       JOIN courses c ON c.course_id=e.course_id
       WHERE e.student_id=$1
       ORDER BY c.course_code`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/students/:id/records", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.record_id, c.course_code, c.course_name, ar.marks, ar.grade, ar.semester
       FROM academic_records ar
       JOIN courses c ON c.course_id=ar.course_id
       WHERE ar.student_id=$1
       ORDER BY c.course_code`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/students/:id/requests", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM requests WHERE student_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/students/:id/requests", async (req, res) => {
  try {
    const { request_type, description } = req.body;
    if (!request_type || !description) {
      return res.status(400).json({ message: "Request type and description are required." });
    }

    const result = await pool.query(
      `INSERT INTO requests (student_id, request_type, description)
       VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, request_type, description]
    );

    await pool.query(
      `INSERT INTO notifications (student_id, title, message)
       VALUES ($1,$2,$3)`,
      [req.params.id, "Request Submitted", `Your ${request_type} request has been submitted.`]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/students/:id/notifications", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE student_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/students/:id/attendance", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.attendance_id, c.course_code, c.course_name, a.classes_held, a.classes_attended,
       ROUND(a.classes_attended::numeric * 100 / NULLIF(a.classes_held, 0), 1) AS percentage
       FROM attendance a JOIN courses c ON c.course_id=a.course_id
       WHERE a.student_id=$1 ORDER BY c.course_code`, [req.params.id]
    );
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/api/students/:id/handouts", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT h.handout_id, h.title, h.description, h.file_url, c.course_code, c.course_name
       FROM handouts h JOIN courses c ON c.course_id=h.course_id
       JOIN enrollments e ON e.course_id=h.course_id AND e.student_id=$1
       ORDER BY c.course_code, h.title`, [req.params.id]
    );
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/api/students/:id/assignments", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.assignment_id, a.title, a.file_name, a.submitted_at, c.course_code, c.course_name
       FROM assignments a JOIN courses c ON c.course_id=a.course_id
       WHERE a.student_id=$1 ORDER BY a.submitted_at DESC`, [req.params.id]
    );
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post("/api/students/:id/assignments", async (req, res) => {
  try {
    const { course_id, title, file_name, file_data } = req.body;
    if (!course_id || !title || !file_name || !file_data) return res.status(400).json({ message: "Course, title, and file are required." });
    const result = await pool.query(
      `INSERT INTO assignments (student_id, course_id, title, file_name, file_data)
       VALUES ($1,$2,$3,$4,$5) RETURNING assignment_id, title, file_name, submitted_at`,
      [req.params.id, course_id, title, file_name, file_data]
    );
    await pool.query(
      `INSERT INTO notifications (student_id, title, message) VALUES ($1,$2,$3)`,
      [req.params.id, "Assignment uploaded", `${title} was submitted successfully.`]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

async function start() {
  try {
    await pool.query("SELECT NOW()");
    console.log("Database connected successfully");
    await setupDatabase();
    console.log("Database tables checked/created");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database connection/setup failed:");
    console.error(error.message);
    console.error("Check backend/.env and make sure DATABASE_URL is your real Neon connection string.");
    process.exit(1);
  }
}

start();
