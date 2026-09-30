const { createClient } = require('@supabase/supabase-js');

// PENTING: SUPABASE_SERVICE_ROLE_KEY hanya boleh dipakai di server
// (di dalam folder /api), JANGAN PERNAH dikirim/dipakai di browser.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = { supabaseAdmin };
