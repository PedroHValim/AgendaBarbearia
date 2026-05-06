// ── src/routes/barbers.js ──
const express = require('express');
const router = express.Router();
const {
  listBarbers, createBarber, updateBarber, toggleBarberActive,
} = require('../controllers/barberController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', listBarbers);                                          // público
router.post('/', authenticate, requireAdmin, createBarber);           // admin
router.put('/:id', authenticate, requireAdmin, updateBarber);         // admin
router.patch('/:id/toggle', authenticate, requireAdmin, toggleBarberActive); // admin

module.exports = router;
