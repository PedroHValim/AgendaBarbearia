// ── src/routes/barbers.js ──
const express = require('express');
const router = express.Router();
const {
  listBarbers, createBarber, updateBarber, toggleBarberActive,
  getBarberServices, updateBarberServices,
} = require('../controllers/barberController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', listBarbers);                                                    // público
router.get('/:id/services', getBarberServices);                                  // público
router.post('/', authenticate, requireAdmin, createBarber);
router.put('/:id', authenticate, requireAdmin, updateBarber);
router.patch('/:id/toggle', authenticate, requireAdmin, toggleBarberActive);
router.put('/:id/services', authenticate, requireAdmin, updateBarberServices);

module.exports = router;