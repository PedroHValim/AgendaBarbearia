const cron = require('node-cron');
const supabase = require('../../config/supabase');
const { sendWhatsAppReminder } = require('./whatsapp');

console.log('[Cron] Jobs de agendamento iniciados');

// ── LEMBRETE 24H ANTES ────────────────────────────────
// Roda todo dia às 09:00
cron.schedule('0 9 * * *', async () => {
  console.log('[Cron] Enviando lembretes de 24h...');

  // Data de amanhã
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  try {
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        id, date, time,
        services (name),
        barbers (name),
        users!appointments_client_id_fkey (name, phone)
      `)
      .eq('date', tomorrowStr)
      .eq('status', 'scheduled')
      .eq('confirmation_status', 'pending');

    if (!appointments || appointments.length === 0) {
      console.log('[Cron] Nenhum lembrete para enviar hoje');
      return;
    }

    console.log(`[Cron] Enviando ${appointments.length} lembretes...`);

    for (const appt of appointments) {
      await sendWhatsAppReminder(appt, 'reminder_24h');
      // Pequeno delay entre mensagens para não sobrecarregar a API
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log('[Cron] Lembretes enviados com sucesso');
  } catch (err) {
    console.error('[Cron] Erro ao enviar lembretes:', err);
  }
}, { timezone: 'America/Sao_Paulo' });

// ── LIBERAR HORÁRIOS SEM CONFIRMAÇÃO ─────────────────
// Roda todo dia às 20:00 — libera os de amanhã que não confirmaram
cron.schedule('0 20 * * *', async () => {
  console.log('[Cron] Verificando confirmações pendentes...');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  try {
    // Busca configuração: liberar ou não quando não confirmar
    const { data: config } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'auto_release_unconfirmed')
      .single();

    const shouldRelease = config?.value === true || config?.value === 'true';

    const { data: unconfirmed } = await supabase
      .from('appointments')
      .select(`
        id, date, time,
        services (name),
        barbers (name),
        users!appointments_client_id_fkey (name, phone)
      `)
      .eq('date', tomorrowStr)
      .eq('status', 'scheduled')
      .eq('confirmation_status', 'pending');

    if (!unconfirmed || unconfirmed.length === 0) return;

    console.log(`[Cron] ${unconfirmed.length} agendamentos sem confirmação`);

    for (const appt of unconfirmed) {
      if (shouldRelease) {
        // Cancela o agendamento e libera o slot
        await supabase
          .from('appointments')
          .update({
            status: 'cancelled',
            confirmation_status: 'no_show',
            cancelled_at: new Date().toISOString(),
            cancel_reason: 'Cancelado automaticamente por falta de confirmação',
          })
          .eq('id', appt.id);

        await sendWhatsAppReminder(appt, 'slot_released');
      } else {
        // Apenas marca como no_show e notifica o admin (salva notificação no banco)
        await supabase
          .from('appointments')
          .update({ confirmation_status: 'no_show' })
          .eq('id', appt.id);

        await supabase.from('notifications').insert({
          target: 'admin',
          type: 'no_show',
          title: 'Cliente não confirmou presença',
          message: `${appt.users?.name} (${appt.time} — ${appt.services?.name}) não confirmou presença para amanhã.`,
          appointment_id: appt.id,
          is_read: false,
        });
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err) {
    console.error('[Cron] Erro ao verificar confirmações:', err);
  }
}, { timezone: 'America/Sao_Paulo' });

// ── MARCAR ATENDIMENTOS PASSADOS COMO CONCLUÍDOS ─────
// Roda todo dia à meia noite
cron.schedule('0 0 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  try {
    await supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('date', yesterdayStr)
      .eq('status', 'scheduled');

    console.log('[Cron] Atendimentos de ontem marcados como concluídos');
  } catch (err) {
    console.error('[Cron] Erro ao fechar atendimentos:', err);
  }
}, { timezone: 'America/Sao_Paulo' });
