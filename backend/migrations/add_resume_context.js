// Run this script ONCE to add the resume_context column to the interviews table.
// Usage: node backend/migrations/add_resume_context.js

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function migrate() {
  console.log('Adding resume_context column to interviews table...');

  // Try inserting a test row with resume_context to see if column exists
  // If the column doesn't exist, you need to add it via Supabase Dashboard:
  //
  // 1. Go to https://supabase.com/dashboard
  // 2. Select your project
  // 3. Go to SQL Editor
  // 4. Run this SQL:
  //
  //   ALTER TABLE interviews ADD COLUMN IF NOT EXISTS resume_context JSONB DEFAULT NULL;
  //
  // That's it!

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  MANUAL STEP REQUIRED                                       ║
║                                                              ║
║  Go to your Supabase Dashboard → SQL Editor → Run:          ║
║                                                              ║
║  ALTER TABLE interviews                                      ║
║    ADD COLUMN IF NOT EXISTS resume_context JSONB              ║
║    DEFAULT NULL;                                             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

migrate();
