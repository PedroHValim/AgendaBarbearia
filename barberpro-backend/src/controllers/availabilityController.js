const supabase = require('../../config/supabase');

// ── HORÁRIOS DISPONÍVEIS PARA UMA DATA ───────────────
// GET /api/availability?barber_id=X&date=2025-05-15&service_id=Y
async function getAvailableSlots(req, res) {
  const { barber_id, date, service_id } = req.query;

  if (!barber_id || !date) {
    return res.status(400).json({ error: 'barber_id e date são obrigatórios' });
  }

  try {
    // 1. Busca configuração da barbearia (horários de funcionamento)
    const { data: config } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'business_hours')
      .single();

    const businessHours = config?.value || {
      start: '09:00',
      end: '20:00',
      lunch_start: '12:00',
      lunch_end: '14:00',
      slot_interval: 30,
    };

    // 2. Duração do serviço
    let serviceDuration = businessHours.slot_interval;
    if (service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', service_id)
        .single();
      if (service) serviceDuration = service.duration_minutes;
    }

    // 3. Busca agendamentos já existentes para essa data/barbeiro
    const { data: existingAppts } = await supabase
      .from('appointments')
      .select('time, end_time')
      .eq('barber_id', barber_id)
      .eq('date', date)
      .not('status', 'eq', 'cancelled');

    // 4. Busca horários bloqueados
    const { data: blockedSlots } = await supabase
      .from('blocked_slots')
      .select('start_time, end_time')
      .eq('barber_id', barber_id)
      .eq('date', date);

    // 5. Gera todos os slots possíveis no dia
    const allSlots = generateSlots(
      businessHours.start,
      businessHours.end,
      businessHours.slot_interval,
      businessHours.lunch_start,
      businessHours.lunch_end
    );

    // 6. Marca quais estão ocupados
    const now = new Date();
    const slots = allSlots.map(slot => {
      const slotDateTime = new Date(`${date}T${slot}:00`);
      const isPast = slotDateTime <= now;

      const isBooked = (existingAppts || []).some(appt =>
        timeOverlaps(slot, addMinutes(slot, serviceDuration), appt.time, appt.end_time)
      );

      const isBlocked = (blockedSlots || []).some(b =>
        timeOverlaps(slot, addMinutes(slot, serviceDuration), b.start_time, b.end_time)
      );

      return {
        time: slot,
        available: !isPast && !isBooked && !isBlocked,
        reason: isPast ? 'past' : isBooked ? 'booked' : isBlocked ? 'blocked' : null,
      };
    });

    return res.json({ date, barber_id, slots });
  } catch (err) {
    console.error('Erro ao buscar disponibilidade:', err);
    return res.status(500).json({ error: 'Erro ao buscar horários disponíveis' });
  }
}

// ── DIAS DISPONÍVEIS NO MÊS ──────────────────────────
// GET /api/availability/month?barber_id=X&year=2025&month=5
async function getAvailableDays(req, res) {
  const { barber_id, year, month } = req.query;

  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Busca folgas/dias bloqueados inteiros do barbeiro
    const { data: fullyBlocked } = await supabase
      .from('blocked_slots')
      .select('date')
      .eq('barber_id', barber_id)
      .eq('full_day', true)
      .gte('date', startDate)
      .lte('date', endDate);

    const blockedDays = (fullyBlocked || []).map(b => b.date);

    // Gera lista de dias do mês (excluindo domingos e dias passados)
    const today = new Date();
    const days = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const date = new Date(dateStr);
      const isSunday = date.getDay() === 0;
      const isPast = date < today && date.toDateString() !== today.toDateString();
      const isBlocked = blockedDays.includes(dateStr);

      days.push({
        date: dateStr,
        available: !isSunday && !isPast && !isBlocked,
      });
    }

    return res.json({ days });
  } catch (err) {
    console.error('Erro ao buscar dias:', err);
    return res.status(500).json({ error: 'Erro ao buscar dias disponíveis' });
  }
}

// ──── HELPERS ────
function generateSlots(start, end, intervalMin, lunchStart, lunchEnd) {
  const slots = [];
  let current = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const lunchStartMin = timeToMinutes(lunchStart);
  const lunchEndMin = timeToMinutes(lunchEnd);

  while (current < endMin) {
    const timeStr = minutesToTime(current);
    const isLunch = current >= lunchStartMin && current < lunchEndMin;
    if (!isLunch) slots.push(timeStr);
    current += intervalMin;
  }

  return slots;
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function addMinutes(time, minutes) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

function timeOverlaps(start1, end1, start2, end2) {
  return timeToMinutes(start1) < timeToMinutes(end2) &&
         timeToMinutes(end1) > timeToMinutes(start2);
}

module.exports = { getAvailableSlots, getAvailableDays };
