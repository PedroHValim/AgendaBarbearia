// ── src/routes/admin.js ──
const express = require('express');
const router = express.Router();
const {
  getDashboard, getAgenda,
  adminCancelAppointment, completeAppointment,
  blockSlot, unblockSlot, addWalkIn, searchClient,
  getSettings, updateSettings,
  getAdminNotifications, markNotificationRead,
} = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboard);
router.get('/agenda', getAgenda);
router.get('/search-client', searchClient);
router.patch('/appointments/:id/cancel', adminCancelAppointment);
router.patch('/appointments/:id/complete', completeAppointment);
router.post('/blocked-slots', blockSlot);
router.delete('/blocked-slots/:id', unblockSlot);
router.post('/walk-in', addWalkIn);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.get('/notifications', getAdminNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

module.exports = router;