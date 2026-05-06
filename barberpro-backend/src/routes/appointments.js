const express = require('express');
const router = express.Router();
const {
  createAppointment,
  getMyAppointments,
  cancelAppointment,
  confirmPresence,
} = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/auth');

// Todas precisam de login
router.use(authenticate);

router.post('/', createAppointment);
router.get('/my', getMyAppointments);
router.patch('/:id/cancel', cancelAppointment);
router.patch('/:id/confirm', confirmPresence);

module.exports = router;
