import 'dotenv/config';
import express  from 'express';
import cors     from 'cors';
import session  from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import authRoutes      from './routes/auth.js';
import userRoutes      from './routes/user.js';
import interviewRoutes from './routes/interview.js';
import resumeRoutes    from './routes/resume.js';
import aptitudeRoutes  from './routes/aptitude.js';

const app  = express();
const PORT = process.env.PORT || 5001;

// ─── Middleware ──────────────────────────────────────────────────────────────
// Support multiple origins: CLIENT_URL can be comma-separated in production
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));        // 5mb for base64 avatar uploads
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev_secret',
  resave:            false,
  saveUninitialized: false,
}));

// ─── Google OAuth (Passport) ─────────────────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID:    process.env.GOOGLE_CLIENT_ID     || 'dummy_id',
    clientSecret:process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret',
    callbackURL: process.env.GOOGLE_CALLBACK_URL  || 'http://localhost:5001/auth/google/callback',
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const { User } = await import('./models/User.js');
      const googleEmail = profile.emails[0].value;

      // 1. Already linked Google account?
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        // 2. Account exists with same email (registered via email/password)?
        user = await User.findOne({ email: googleEmail });
        if (user) {
          // Link Google ID to the existing account
          user = await User.update(user._id, { googleId: profile.id });
        } else {
          // 3. Brand new user — create
          user = await User.create({
            googleId: profile.id,
            name:     profile.displayName,
            email:    googleEmail,
            avatar:   profile.photos[0]?.value || '',
          });
        }
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));
app.use(passport.initialize());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth',           authRoutes);
app.use('/api/user',       userRoutes);
app.use('/api/interview',  interviewRoutes);
app.use('/api/resume',     resumeRoutes);
app.use('/api/aptitude',   aptitudeRoutes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', db: 'supabase' }));

// ─── Diagnostic Route ────────────────────────────────────────────────────────
app.get('/api/test-ai', async (req, res) => {
  try {
    const { default: axios } = await import('axios');
    const key = process.env.NVIDIA_API_KEY;
    const model = process.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-51b-instruct';
    
    const results = {};
    
    // Test 1: Chat Completion with configured model
    try {
      const response = await axios.post(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        {
          model: model,
          messages: [{ role: 'user', content: 'Say hello in one word.' }],
          temperature: 0.7,
          max_tokens: 50,
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
        }
      );
      results.test1 = { status: 'success', data: response.data.choices[0].message };
    } catch (err) {
      results.test1 = { 
        status: 'failed', 
        code: err.response?.status, 
        data: err.response?.data, 
        message: err.message 
      };
    }
    
    // Test 2: List models
    try {
      const response = await axios.get(
        'https://integrate.api.nvidia.com/v1/models',
        {
          headers: {
            Authorization: `Bearer ${key}`,
          },
        }
      );
      results.test2 = { 
        status: 'success', 
        models: response.data.data.map(m => m.id)
      };
    } catch (err) {
      results.test2 = { 
        status: 'failed', 
        code: err.response?.status, 
        data: err.response?.data, 
        message: err.message 
      };
    }
    
    res.json({
      env: {
        NVIDIA_MODEL: process.env.NVIDIA_MODEL,
        NVIDIA_MODEL_EVAL: process.env.NVIDIA_MODEL_EVAL,
        hasKey: !!key,
        keyPrefix: key ? key.substring(0, 10) : null
      },
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Using Supabase: ${process.env.SUPABASE_URL}`);
});
