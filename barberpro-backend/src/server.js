require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Rotas
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const barberRoutes = require('./routes/barbers');
const serviceRoutes = require('./routes/services');
const adminRoutes = require('./routes/admin');
const availabilityRoutes = require('./routes/availability');
const whatsappRoutes = require('./routes/whatsapp');

// Cron jobs
require('./services/cronJobs');

const app = express();

// ── MIDDLEWARES GLOBAIS ──
app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting — proteção básica contra abuso
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' }
});
app.use(limiter);

// ── ROTAS ──
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/barbers', barberRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Handler de erros global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✂  BarberPro API rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
