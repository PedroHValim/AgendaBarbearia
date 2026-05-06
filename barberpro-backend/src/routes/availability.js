// ── src/routes/availability.js ──
const express = require('express');
const router = express.Router();
const { getAvailableSlots, getAvailableDays } = require('../controllers/availabilityController');

router.get('/', getAvailableSlots);         // ?barber_id=X&date=YYYY-MM-DD&service_id=Y
router.get('/month', getAvailableDays);     // ?barber_id=X&year=2025&month=5

module.exports = router;
