const axios = require('axios');

// ── FORMATA TELEFONE PARA PADRÃO WHATSAPP ─────────────
// Z-API usa: 5511999999999 (código país + DDD + número, sem + nem espaços)
function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  // Se não começa com 55 (Brasil), adiciona
  return digits.startsWith('55') ? digits : `55${digits}`;
}

// ── ENVIA MENSAGEM DE TEXTO SIMPLES ──────────────────
async function sendMessage(phone, message) {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!instanceId || !token) {
    console.log('[WhatsApp] Credenciais não configuradas. Mensagem não enviada.');
    console.log(`[WhatsApp] Para: ${phone}`);
    console.log(`[WhatsApp] Mensagem: ${message}`);
    return false;
  }

  try {
    const response = await axios.post(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        phone: formatPhone(phone),
        message,
      },
      {
        headers: { 'Client-Token': clientToken },
        timeout: 10000,
      }
    );

    console.log(`[WhatsApp] Mensagem enviada para ${phone}:`, response.data);
    return true;
  } catch (err) {
    console.error('[WhatsApp] Erro ao enviar mensagem:', err.response?.data || err.message);
    return false;
  }
}

// ── TEMPLATES DE MENSAGEM ─────────────────────────────
function buildMessage(type, data) {
  const { client, service, barber, date, time } = data;
  const dateFormatted = new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long'
  });
  const barbearia = process.env.BARBEARIA_NOME || 'BarberPro';

  const templates = {
    // Confirmação de novo agendamento
    new_booking: `✂ *${barbearia}*\n\nOlá, *${client}*! 👋\n\nSeu agendamento foi confirmado:\n\n📅 *${dateFormatted}*\n⏰ *${time}*\n✂ *${service}*\n💈 Barbeiro: *${barber}*\n\nTe esperamos! Qualquer dúvida é só responder essa mensagem. 😊`,

    // Lembrete 24h antes
    reminder_24h: `⏰ *Lembrete — ${barbearia}*\n\nOlá, *${client}*!\n\nAmanhã você tem:\n\n📅 *${dateFormatted}*\n⏰ *${time}*\n✂ *${service}* com *${barber}*\n\n👇 Por favor, confirme sua presença respondendo *SIM* ou *NÃO*.\n\nSe não confirmar até as 20h, o horário poderá ser liberado.`,

    // Cancelado pelo admin
    cancelled_by_admin: `❌ *${barbearia}*\n\nOlá, *${client}*.\n\nInfelizmente precisamos cancelar seu agendamento:\n\n📅 *${dateFormatted}* às *${time}*\n✂ *${service}*\n\nPedimos desculpas pelo inconveniente. Acesse o site para remarcar: ${process.env.FRONTEND_URL}\n\nObrigado pela compreensão! 🙏`,

    // Cancelado pelo cliente
    cancelled_by_client: `✅ *${barbearia}*\n\nCancelamento confirmado!\n\nSeu agendamento de *${service}* em *${dateFormatted}* às *${time}* foi cancelado.\n\nPara remarcar: ${process.env.FRONTEND_URL}`,

    // Horário liberado (não confirmou)
    slot_released: `📢 *${barbearia}*\n\nOlá, *${client}*.\n\nComo não recebemos sua confirmação, o horário de *${dateFormatted}* às *${time}* foi liberado.\n\nPara agendar novamente: ${process.env.FRONTEND_URL}`,
  };

  return templates[type] || '';
}

// ── FUNÇÃO PRINCIPAL CHAMADA PELOS CONTROLLERS ────────
async function sendWhatsAppReminder(appointment, type) {
  try {
    // Extrai dados do appointment (pode vir com joins ou flat)
    const client = appointment.users?.name || appointment.client_name || 'Cliente';
    const phone = appointment.users?.phone || appointment.client_phone;
    const service = appointment.services?.name || appointment.service_name || 'Serviço';
    const barber = appointment.barbers?.name || appointment.barber_name || 'Barbeiro';
    const date = appointment.date;
    const time = appointment.time;

    if (!phone) {
      console.log('[WhatsApp] Telefone não encontrado para o cliente. Pulando.');
      return false;
    }

    const message = buildMessage(type, { client, service, barber, date, time });
    if (!message) {
      console.log(`[WhatsApp] Template desconhecido: ${type}`);
      return false;
    }

    return await sendMessage(phone, message);
  } catch (err) {
    console.error('[WhatsApp] Erro ao preparar mensagem:', err);
    return false;
  }
}

module.exports = { sendWhatsAppReminder, sendMessage };
