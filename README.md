# InterviewAI – Full Stack AI Interview Simulator

A production-ready full-stack application built with React (Vite), Node.js, Express, MongoDB, and AI integration.

## 🚀 Getting Started

The project has been fully built with both Frontend and Backend components.

### 1. Setup Backend
Open a terminal and run the following commands:
```bash
cd backend
npm install
npm run dev
```
*(The backend runs on http://localhost:5001. It uses a mock AI service by default so you don't need API keys immediately, and uses `mongodb://localhost:27017/interviewai` for the database. Ensure MongoDB is running locally).*

### 2. Setup Frontend
Open a **new** terminal and run:
```bash
npm install
npm run dev
```
*(The frontend runs on http://localhost:5173).*

---

## 🧠 Key Features Implemented

1. **Authentication**
   - Google OAuth 2.0 flow integrated.
   - Quick "Demo Login" feature added to instantly test the app without setting up Google credentials.
   - JWT-based authentication context in React.

2. **Dashboard & History**
   - Fetches and displays real user interview history from the database.
   - Calculates dynamic stats (Total interviews, average score, best score).

3. **AI Interview Session**
   - Fully interactive chat interface with typing indicators.
   - Communicates with the backend to generate dynamic, domain-specific questions.
   - Evaluates answers and provides structured feedback.
   - *Mock AI Service*: Currently uses a robust local Mock AI service (`backend/services/mockAI.js`) so you can test it immediately without OpenAI/Gemini keys.
   - *Real AI Service*: When you add `OPENAI_API_KEY` or `GEMINI_API_KEY` to `backend/.env` and set `USE_MOCK_AI=false`, it automatically switches to real LLM-based evaluation.

4. **Performance Feedback**
   - Renders a complete breakdown of the score (Content, Communication, Confidence).
   - Generates and displays specific AI-suggested "Better Answers" for every question asked during the session.

## 🛠️ Architecture

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, Context API.
- **Backend**: Node.js, Express, Mongoose, Passport (OAuth), JSON Web Tokens.
- **AI Service**: Graceful fallback system (OpenAI -> Gemini -> MockAI).
