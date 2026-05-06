// ── src/routes/whatsapp.js ──
// Webhook para receber respostas do cliente (SIM/NÃO) via Z-API
const express = require('express');
const router = express.Router();
const supabase = require('../../config/supabase');
const { sendMessage } = require('../services/whatsapp');

// Z-API chama este endpoint quando o cliente responde uma mensagem
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // responde imediato para a Z-API

  try {
    const { phone, text, fromMe } = req.body;
    if (fromMe) return; // ignora mensagens enviadas por nós

    const cleanPhone = phone.replace(/\D/g, '').replace(/^55/, '');
    const normalized = text?.trim().toUpperCase();

    if (!['SIM', 'NÃO', 'NAO', 'S', 'N'].includes(normalized)) return;

    const isConfirm = ['SIM', 'S'].includes(normalized);

    // Busca o agendamento pendente de confirmação para este telefone (mais próximo)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: user } = await supabase
      .from('users')
      .select('id, name')
      .eq('phone', cleanPhone)
      .single();

    if (!user) return;

    const { data: appt } = await supabase
      .from('appointments')
      .select('id, date, time')
      .eq('client_id', user.id)
      .eq('date', tomorrowStr)
      .eq('status', 'scheduled')
      .eq('confirmation_status', 'pending')
      .single();

    if (!appt) return;

    if (isConfirm) {
      await supabase
        .from('appointments')
        .update({ confirmation_status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', appt.id);

      await sendMessage(phone, `✅ Presença confirmada! Te esperamos amanhã às ${appt.time}. 💈`);

      // Notifica admin
      await supabase.from('notifications').insert({
        target: 'admin',
        type: 'confirmed',
        title: 'Presença confirmada',
        message: `${user.name} confirmou presença para ${appt.time} de amanhã.`,
        appointment_id: appt.id,
        is_read: false,
      });
    } else {
      await supabase
        .from('appointments')
        .update({ status: 'cancelled', confirmation_status: 'no_show', cancelled_at: new Date().toISOString() })
        .eq('id', appt.id);

      await sendMessage(phone, `Tudo bem! Seu agendamento foi cancelado. Para remarcar: ${process.env.FRONTEND_URL} 🗓️`);

      await supabase.from('notifications').insert({
        target: 'admin',
        type: 'cancelled',
        title: 'Cliente cancelou via WhatsApp',
        message: `${user.name} recusou presença para ${appt.time} de amanhã.`,
        appointment_id: appt.id,
        is_read: false,
      });
    }
  } catch (err) {
    console.error('[Webhook WhatsApp] Erro:', err);
  }
});

module.exports = router;
