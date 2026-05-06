const supabase = require('../../config/supabase');

// ── BARBEIROS ─────────────────────────────────────────

async function listBarbers(req, res) {
  try {
    const { data, error } = await supabase
      .from('barbers')
      .select('id, name, specialty, bio, avatar_url, rating, is_active, work_schedule')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return res.json({ barbers: data });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar barbeiros' });
  }
}

async function createBarber(req, res) {
  const { name, specialty, bio, phone, work_schedule } = req.body;

  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  try {
    const { data, error } = await supabase
      .from('barbers')
      .insert({ name, specialty, bio, phone, work_schedule, is_active: true })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ message: 'Barbeiro cadastrado!', barber: data });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao cadastrar barbeiro' });
  }
}

async function updateBarber(req, res) {
  const { id } = req.params;
  const updates = req.body;

  try {
    const { data, error } = await supabase
      .from('barbers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ message: 'Barbeiro atualizado!', barber: data });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar barbeiro' });
  }
}

async function toggleBarberActive(req, res) {
  const { id } = req.params;

  try {
    const { data: barber } = await supabase
      .from('barbers')
      .select('is_active')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('barbers')
      .update({ is_active: !barber.is_active })
      .eq('id', id);

    if (error) throw error;
    return res.json({ message: `Barbeiro ${barber.is_active ? 'desativado' : 'ativado'}!` });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar barbeiro' });
  }
}

// ── SERVIÇOS ──────────────────────────────────────────

async function listServices(req, res) {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, description, price, duration_minutes, is_active')
      .eq('is_active', true)
      .order('price');

    if (error) throw error;
    return res.json({ services: data });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar serviços' });
  }
}

async function createService(req, res) {
  const { name, description, price, duration_minutes } = req.body;

  if (!name || !price || !duration_minutes) {
    return res.status(400).json({ error: 'Nome, preço e duração são obrigatórios' });
  }

  try {
    const { data, error } = await supabase
      .from('services')
      .insert({ name, description, price, duration_minutes, is_active: true })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ message: 'Serviço criado!', service: data });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao criar serviço' });
  }
}

async function updateService(req, res) {
  const { id } = req.params;
  const updates = req.body;

  try {
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ message: 'Serviço atualizado!', service: data });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar serviço' });
  }
}

module.exports = {
  listBarbers, createBarber, updateBarber, toggleBarberActive,
  listServices, createService, updateService,
};
