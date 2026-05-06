const supabase = require('../../config/supabase');
const { sendWhatsAppReminder } = require('../services/whatsapp');

// ── DASHBOARD ─────────────────────────────────────────
async function getDashboard(req, res) {
  const today = new Date().toISOString().split('T')[0];

  try {
    // Agendamentos de hoje
    const { data: todayAppts } = await supabase
      .from('appointments')
      .select(`
        id, time, end_time, status, confirmation_status, price,
        services (name),
        barbers (name),
        users!appointments_client_id_fkey (name, phone)
      `)
      .eq('date', today)
      .not('status', 'eq', 'cancelled')
      .order('time');

    const scheduled = todayAppts?.filter(a => a.status === 'scheduled') || [];
    const completed = todayAppts?.filter(a => a.status === 'completed') || [];
    const confirmed = todayAppts?.filter(a => a.confirmation_status === 'confirmed') || [];
    const noShow = todayAppts?.filter(a => a.confirmation_status === 'no_show') || [];
    const revenue = completed.reduce((sum, a) => sum + Number(a.price || 0), 0);

    return res.json({
      today: {
        total: todayAppts?.length || 0,
        scheduled: scheduled.length,
        completed: completed.length,
        confirmed: confirmed.length,
        no_show: noShow.length,
        revenue,
        appointments: todayAppts || [],
      },
    });
  } catch (err) {
    console.error('Erro no dashboard:', err);
    return res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
}

// ── AGENDA (listagem admin) ───────────────────────────
async function getAgenda(req, res) {
  const { date, barber_id, week_start } = req.query;

  try {
    let query = supabase
      .from('appointments')
      .select(`
        id, date, time, end_time, status, confirmation_status, price,
        services (id, name, duration_minutes),
        barbers (id, name),
        users!appointments_client_id_fkey (id, name, phone)
      `)
      .not('status', 'eq', 'cancelled')
      .order('date')
      .order('time');

    if (date) {
      query = query.eq('date', date);
    } else if (week_start) {
      const end = new Date(week_start);
      end.setDate(end.getDate() + 6);
      query = query
        .gte('date', week_start)
        .lte('date', end.toISOString().split('T')[0]);
    }

    if (barber_id) {
      query = query.eq('barber_id', barber_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ appointments: data });
  } catch (err) {
    console.error('Erro na agenda:', err);
    return res.status(500).json({ error: 'Erro ao buscar agenda' });
  }
}

// ── CANCELAR (pelo admin) ─────────────────────────────
async function adminCancelAppointment(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const { data: appt } = await supabase
      .from('appointments')
      .select(`
        id, status, date, time,
        users!appointments_client_id_fkey (name, phone),
        services (name),
        barbers (name)
      `)
      .eq('id', id)
      .single();

    if (!appt) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || 'Cancelado pelo estabelecimento',
      })
      .eq('id', id);

    if (error) throw error;

    // Notifica o cliente via WhatsApp
    sendWhatsAppReminder(appt, 'cancelled_by_admin').catch(console.error);

    return res.json({ message: 'Agendamento cancelado e cliente notificado' });
  } catch (err) {
    console.error('Erro ao cancelar:', err);
    return res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
}

// ── MARCAR COMO CONCLUÍDO ────────────────────────────
async function completeAppointment(req, res) {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return res.json({ message: 'Atendimento marcado como concluído!' });
  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({ error: 'Erro ao atualizar status' });
  }
}

// ── BLOQUEAR HORÁRIO ─────────────────────────────────
async function blockSlot(req, res) {
  const { barber_id, date, start_time, end_time, reason, full_day } = req.body;

  if (!barber_id || !date) {
    return res.status(400).json({ error: 'barber_id e date são obrigatórios' });
  }

  try {
    const { data, error } = await supabase
      .from('blocked_slots')
      .insert({
        barber_id,
        date,
        start_time: full_day ? '00:00' : start_time,
        end_time: full_day ? '23:59' : end_time,
        reason: reason || 'Bloqueado pelo admin',
        full_day: !!full_day,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ message: 'Horário bloqueado com sucesso', slot: data });
  } catch (err) {
    console.error('Erro ao bloquear:', err);
    return res.status(500).json({ error: 'Erro ao bloquear horário' });
  }
}

// ── REMOVER BLOQUEIO ─────────────────────────────────
async function unblockSlot(req, res) {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('blocked_slots')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ message: 'Bloqueio removido' });
  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({ error: 'Erro ao remover bloqueio' });
  }
}

// ── ADICIONAR ENCAIXE ────────────────────────────────
async function addWalkIn(req, res) {
  const { client_name, client_phone, service_id, barber_id, date, time, existing_client_id } = req.body;

  try {
    let user = null;

    // Se veio um existing_client_id, usa direto
    if (existing_client_id) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', existing_client_id)
        .single();
      user = existingUser;
    }

    // Se não, busca ou cria pelo telefone
    if (!user && client_phone) {
      const cleanPhone = client_phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        let { data: foundUser } = await supabase
          .from('users')
          .select('id')
          .eq('phone', cleanPhone)
          .single();
        user = foundUser;
      }
    }

    // Se ainda não achou, cria novo usuário
    if (!user) {
      const cleanPhone = client_phone ? client_phone.replace(/\D/g, '') : null;
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          name: client_name,
          phone: cleanPhone || null,
          role: 'client',
          auth_provider: 'walkin',
          is_active: true,
        })
        .select('id')
        .single();
      user = newUser;
    }

    const { data: service } = await supabase
      .from('services')
      .select('duration_minutes, price')
      .eq('id', service_id)
      .single();

    const [h, m] = time.split(':').map(Number);
    const endMin = h * 60 + m + (service?.duration_minutes || 30);
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

    const { data: appt, error } = await supabase
      .from('appointments')
      .insert({
        client_id: user.id,
        barber_id,
        service_id,
        date,
        time,
        end_time: endTime,
        status: 'scheduled',
        confirmation_status: 'confirmed', // encaixe já é confirmado
        price: service?.price || 0,
        is_walkin: true,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ message: 'Encaixe adicionado!', appointment: appt });
  } catch (err) {
    console.error('Erro no encaixe:', err);
    return res.status(500).json({ error: 'Erro ao adicionar encaixe' });
  }
}

// ── CONFIGURAÇÕES ─────────────────────────────────────
async function getSettings(req, res) {
  try {
    const { data } = await supabase
      .from('settings')
      .select('key, value');

    const settings = {};
    (data || []).forEach(s => { settings[s.key] = s.value; });

    return res.json({ settings });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
}

async function updateSettings(req, res) {
  const { settings } = req.body; // { key: value, key2: value2 }

  try {
    const upserts = Object.entries(settings).map(([key, value]) => ({ key, value }));

    const { error } = await supabase
      .from('settings')
      .upsert(upserts, { onConflict: 'key' });

    if (error) throw error;

    return res.json({ message: 'Configurações salvas!' });
  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
    return res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
}

// ── NOTIFICAÇÕES ADMIN ───────────────────────────────
async function getAdminNotifications(req, res) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('target', 'admin')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.json({ notifications: data });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
}

async function markNotificationRead(req, res) {
  const { id } = req.params;
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    return res.json({ message: 'Notificação marcada como lida' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro' });
  }
}

// ── BUSCAR CLIENTE POR EMAIL OU TELEFONE ─────────────
async function searchClient(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parâmetro q obrigatório' });

  const cleanQ = q.trim();
  const isPhone = /^\d+$/.test(cleanQ.replace(/\D/g, '')) && cleanQ.replace(/\D/g, '').length >= 10;

  try {
    let query = supabase
      .from('users')
      .select('id, name, email, phone')
      .eq('is_active', true);

    if (isPhone) {
      const digits = cleanQ.replace(/\D/g, '');
      query = query.eq('phone', digits);
    } else {
      query = query.ilike('email', `%${cleanQ}%`);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return res.json({ user: null });
    }

    return res.json({ user: data });
  } catch (err) {
    return res.json({ user: null });
  }
}

module.exports = {
  getDashboard,
  getAgenda,
  adminCancelAppointment,
  completeAppointment,
  blockSlot,
  unblockSlot,
  addWalkIn,
  searchClient,
  getSettings,
  updateSettings,
  getAdminNotifications,
  markNotificationRead,
};