// ── src/routes/services.js ──
const express = require('express');
const router = express.Router();
const { listServices, createService, updateService } = require('../controllers/barberController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', listServices);
router.post('/', authenticate, requireAdmin, createService);
router.put('/:id', authenticate, requireAdmin, updateService);

module.exports = router;
