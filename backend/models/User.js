import supabase from '../lib/supabase.js';

function toUser(data) {
  if (!data) return null;
  return {
    ...data,
    _id:           data.id,
    googleId:      data.google_id,
    resumeContext: data.resume_context ?? null,
  };
}

export const User = {
  // Find a single user by email or googleId (no password)
  findOne: async (where) => {
    let query = supabase.from('users').select('id,name,email,google_id,avatar,created_at');
    if (where.email)    query = query.eq('email', where.email);
    if (where.googleId) query = query.eq('google_id', where.googleId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return toUser(data);
  },

  // Find user by id
  findById: async (id) => {
    const { data, error } = await supabase
      .from('users')
      .select('id,name,email,google_id,avatar,resume_context,created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return toUser(data);
  },

  // Find user WITH password field (for login)
  findOneWithPassword: async (email) => {
    const { data, error } = await supabase
      .from('users')
      .select('id,name,email,password,google_id,avatar,created_at')
      .eq('email', email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return toUser(data);
  },

  // Create a new user
  create: async (userData) => {
    const { data, error } = await supabase
      .from('users')
      .insert({
        name:      userData.name,
        email:     userData.email,
        password:  userData.password  || null,
        google_id: userData.googleId  || null,
        avatar:    userData.avatar    || '',
      })
      .select('id,name,email,google_id,avatar,created_at')
      .single();
    if (error) throw new Error(error.message);
    return toUser(data);
  },
  // Update user fields (name, avatar)
  update: async (id, fields) => {
    const allowed = {};
    if (fields.name          !== undefined) allowed.name           = fields.name;
    if (fields.avatar        !== undefined) allowed.avatar         = fields.avatar;
    if (fields.googleId      !== undefined) allowed.google_id      = fields.googleId;
    if (fields.resumeContext !== undefined) allowed.resume_context = fields.resumeContext;
    const { data, error } = await supabase
      .from('users')
      .update(allowed)
      .eq('id', id)
      .select('id,name,email,google_id,avatar,resume_context,created_at')
      .single();
    if (error) throw new Error(error.message);
    return toUser(data);
  },
};

export default User;
