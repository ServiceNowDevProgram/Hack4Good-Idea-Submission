LearnSphere – AI Study Companion
1. Problem Statement
An AI-powered platform to help students summarize notes, generate quizzes, and track learning progress, simplifying revision.
2. System Architecture
Stack: React.js (Frontend) → Node.js/Express.js (Backend) → MongoDB Atlas (Database)
Services: JWT for Authentication, OpenAI API for AI features.
Hosting: Vercel (Frontend) & Render (Backend).
3. Key Features
Category
Features
Authentication
Secure JWT Login & Registration.
AI Tools
On-demand Note Summaries & Quizzes.
CRUD
Create, Read, Update, & Delete Notes.
Tracking
Visual charts for learning & quiz performance.
Routing
Dashboard, Notes, Analytics, etc.

4. Tech Stack
Layer
Technologies
Frontend
React.js, React Router, Axios, Tailwind CSS
Backend
Node.js, Express.js
Database
MongoDB Atlas
Services
JWT, OpenAI API, Chart.js

5. API Overview
Endpoint
Method
Description
Access
/api/auth/...
POST
Signup / Login User
Public
/api/notes
GET/POST
Manage User Notes
Authenticated
/api/ai/summarize
POST
Generate Note Summary
Authenticated
/api/ai/quiz
POST
Generate Quiz from Note
Authenticated
/api/progress
GET
Fetch User Progress Data
Authenticated


