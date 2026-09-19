# EdTech Student Self-Service App

A DBMS-focused EdTech student self-service website based on the provided EdTech presentation.

## Stack used for this working demo
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL hosted on Neon
- Database driver: pg
- Environment variables: dotenv
- CORS: cors

## What is implemented
1. Student dashboard/profile
2. Courses
3. Academic records
4. Digital service requests with status tracking
5. Notifications
6. PostgreSQL tables and relationships
7. REST APIs between React and Express
8. Sample data for presentation/demo

## Database tables
- students
- courses
- enrollments
- academic_records
- requests
- notifications

## Important
The real Neon DATABASE_URL is NOT included in this ZIP for security. You must create `backend/.env` from `backend/.env.example`.

## Setup

### 1. Backend
Open a terminal:

```powershell
cd backend
npm install
```

Create `backend/.env`:

```env
DATABASE_URL=PASTE_YOUR_NEON_CONNECTION_STRING_HERE
PORT=5000
```

Then run:

```powershell
node server.js
```

You should see:

```text
Database connected successfully
Database tables checked/created
Server running on http://localhost:5000
```

The server automatically creates the tables and inserts demo data if the database is empty.

### 2. Frontend
Open a SECOND terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite, normally:

http://localhost:5173

## Presentation explanation

React is the frontend. It displays the student interface and sends HTTP requests.

Node.js + Express is the backend. It provides REST APIs and contains the application logic.

PostgreSQL is the relational database. Neon hosts that PostgreSQL database online.

Data flow:

React -> Express REST API -> PostgreSQL/Neon
PostgreSQL/Neon -> Express -> React

When a student submits a request, React sends it to Express. Express executes an INSERT query and PostgreSQL stores the row in the `requests` table.

## DBMS points to explain
- Primary keys uniquely identify rows.
- Foreign keys connect related tables.
- `students -> enrollments -> courses` represents a many-to-many relationship.
- `academic_records` stores marks/grades related to a student and course.
- `requests` stores digital service requests and their status.
- SQL JOINs combine information from related tables.
- Neon is the cloud host for the PostgreSQL database.
