const supabase = require('../../config/supabase');
const { sendWhatsAppReminder } = require('../services/whatsapp');

// ── CRIAR AGENDAMENTO ─────────────────────────────────
async function createAppointment(req, res) {
  const { service_id, barber_id, date, time } = req.body;
  const client_id = req.user.id;

  if (!service_id || !barber_id || !date || !time) {
    return res.status(400).json({ error: 'Preencha todos os campos do agendamento' });
  }

  // Validação de data — não aceita datas passadas
  const appointmentDate = new Date(`${date}T${time}:00`);
  if (appointmentDate <= new Date()) {
    return res.status(400).json({ error: 'Não é possível agendar para datas passadas' });
  }

  // Não aceita mais de 30 dias no futuro
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  if (appointmentDate > maxDate) {
    return res.status(400).json({ error: 'Agendamentos disponíveis apenas para os próximos 30 dias' });
  }

  try {
    // 1. Busca o serviço para pegar a duração
    const { data: service } = await supabase
      .from('services')
      .select('id, name, price, duration_minutes')
      .eq('id', service_id)
      .eq('is_active', true)
      .single();

    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    // 2. Verifica se o barbeiro existe e está ativo
    const { data: barber } = await supabase
      .from('barbers')
      .select('id, name')
      .eq('id', barber_id)
      .eq('is_active', true)
      .single();

    if (!barber) {
      return res.status(404).json({ error: 'Barbeiro não encontrado ou inativo' });
    }

    // 3. Verifica conflito de horário (mesmo barbeiro, mesmo horário)
    const { data: conflict } = await supabase
      .from('appointments')
      .select('id')
      .eq('barber_id', barber_id)
      .eq('date', date)
      .eq('time', time)
      .not('status', 'eq', 'cancelled')
      .single();

    if (conflict) {
      return res.status(409).json({ error: 'Este horário já está ocupado. Escolha outro.' });
    }

    // 4. Verifica se está em horário bloqueado
    const { data: blocked } = await supabase
      .from('blocked_slots')
      .select('id')
      .eq('barber_id', barber_id)
      .eq('date', date)
      .lte('start_time', time)
      .gte('end_time', time)
      .single();

    if (blocked) {
      return res.status(409).json({ error: 'Este horário está bloqueado pelo barbeiro.' });
    }

    // 5. Calcula horário de término
    const [h, m] = time.split(':').map(Number);
    const endMinutes = h * 60 + m + service.duration_minutes;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    // 6. Cria o agendamento
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        client_id,
        barber_id,
        service_id,
        date,
        time,
        end_time: endTime,
        status: 'scheduled',
        confirmation_status: 'pending',
        price: service.price,
      })
      .select(`
        id, date, time, end_time, status, confirmation_status, price,
        services (name, duration_minutes),
        barbers (name),
        users!appointments_client_id_fkey (name, phone)
      `)
      .single();

    if (error) throw error;

    // 7. Envia confirmação via WhatsApp (não bloqueia a resposta)
    sendWhatsAppReminder(appointment, 'new_booking').catch(console.error);

    return res.status(201).json({
      message: 'Agendamento realizado com sucesso!',
      appointment,
    });
  } catch (err) {
    console.error('Erro ao criar agendamento:', err);
    return res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
}

// ── LISTAR AGENDAMENTOS DO CLIENTE ───────────────────
async function getMyAppointments(req, res) {
  const client_id = req.user.id;

  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, date, time, end_time, status, confirmation_status, price,
        services (id, name, duration_minutes),
        barbers (id, name)
      `)
      .eq('client_id', client_id)
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) throw error;

    return res.json({ appointments: data });
  } catch (err) {
    console.error('Erro ao listar agendamentos:', err);
    return res.status(500).json({ error: 'Erro ao buscar agendamentos' });
  }
}

// ── CANCELAR AGENDAMENTO (pelo cliente) ──────────────
async function cancelAppointment(req, res) {
  const { id } = req.params;
  const client_id = req.user.id;

  try {
    // Só pode cancelar o próprio agendamento
    const { data: appt } = await supabase
      .from('appointments')
      .select('id, status, date, time, client_id')
      .eq('id', id)
      .single();

    if (!appt) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    if (appt.client_id !== client_id) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    if (appt.status === 'cancelled') {
      return res.status(400).json({ error: 'Agendamento já cancelado' });
    }

    if (appt.status === 'completed') {
      return res.status(400).json({ error: 'Não é possível cancelar um serviço já concluído' });
    }

    // Verifica se está a menos de 2h do horário marcado
    const apptDateTime = new Date(`${appt.date}T${appt.time}:00`);
    const hoursUntil = (apptDateTime - new Date()) / (1000 * 60 * 60);
    if (hoursUntil < 2) {
      return res.status(400).json({
        error: 'Cancelamentos devem ser feitos com pelo menos 2h de antecedência.'
      });
    }

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return res.json({ message: 'Agendamento cancelado com sucesso' });
  } catch (err) {
    console.error('Erro ao cancelar:', err);
    return res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
}

// ── CONFIRMAR PRESENÇA (pelo cliente) ────────────────
async function confirmPresence(req, res) {
  const { id } = req.params;
  const client_id = req.user.id;

  try {
    const { data: appt } = await supabase
      .from('appointments')
      .select('id, client_id, status, confirmation_status')
      .eq('id', id)
      .single();

    if (!appt || appt.client_id !== client_id) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    if (appt.status === 'cancelled') {
      return res.status(400).json({ error: 'Este agendamento foi cancelado' });
    }

    const { error } = await supabase
      .from('appointments')
      .update({ confirmation_status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return res.json({ message: 'Presença confirmada!' });
  } catch (err) {
    console.error('Erro ao confirmar presença:', err);
    return res.status(500).json({ error: 'Erro ao confirmar presença' });
  }
}

module.exports = {
  createAppointment,
  getMyAppointments,
  cancelAppointment,
  confirmPresence,
};
