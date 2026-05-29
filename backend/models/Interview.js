import supabase from '../lib/supabase.js';

function toInterview(data) {
  if (!data) return null;
  const obj = {
    ...data,
    _id:            data.id,
    userId:         data.user_id,
    totalQuestions: data.total_questions,
    finalScore:     data.final_score     ?? 0,
    scoreBreakdown: data.score_breakdown ?? {},
    completedAt:    data.completed_at,
    createdAt:      data.created_at,
    qa:             data.qa              ?? [],
    strengths:      data.strengths       ?? [],
    improvements:   data.improvements   ?? [],
  };
  // Attach a save() method that persists changes back to Supabase
  obj.save = async () => {
    const { error } = await supabase
      .from('interviews')
      .update({
        qa:             obj.qa,
        status:         obj.status,
        final_score:    obj.finalScore,
        score_breakdown:obj.scoreBreakdown,
        strengths:      obj.strengths,
        improvements:   obj.improvements,
        completed_at:   obj.completedAt,
      })
      .eq('id', obj._id);
    if (error) throw new Error(error.message);
    return obj;
  };
  return obj;
}

export const Interview = {
  create: async (data) => {
    const { data: row, error } = await supabase
      .from('interviews')
      .insert({
        user_id:        data.userId,
        type:           data.type,
        domain:         data.domain,
        total_questions:data.totalQuestions ?? 5,
        status:         data.status         ?? 'active',
        qa:             data.qa             ?? [],
        final_score:    0,
        score_breakdown:{},
        strengths:      [],
        improvements:   [],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toInterview(row);
  },

  findOne: async (where) => {
    let query = supabase.from('interviews').select('*');
    if (where._id)    query = query.eq('id', where._id);
    if (where.userId) query = query.eq('user_id', where.userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return toInterview(data);
  },

  find: async (where, opts = {}) => {
    const cols = opts.select ||
      'id,type,domain,final_score,score_breakdown,strengths,improvements,created_at,completed_at,total_questions,status';
    let query = supabase.from('interviews').select(cols);
    if (where.userId) query = query.eq('user_id', where.userId);
    if (where.status) query = query.eq('status', where.status);
    if (opts.sort?.completedAt === -1)
      query = query.order('completed_at', { ascending: false });
    if (opts.skip !== undefined && opts.limit)
      query = query.range(opts.skip, opts.skip + opts.limit - 1);
    else if (opts.limit)
      query = query.limit(opts.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(toInterview);
  },

  countDocuments: async (where) => {
    let query = supabase
      .from('interviews')
      .select('id', { count: 'exact', head: true });
    if (where.userId) query = query.eq('user_id', where.userId);
    if (where.status) query = query.eq('status', where.status);
    const { count } = await query;
    return count ?? 0;
  },
};

export default Interview;
