// ── src/routes/services.js ──
const express = require('express');
const router = express.Router();
const { listServices, createService, updateService, deleteService } = require('../controllers/barberController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', listServices);
router.post('/', authenticate, requireAdmin, createService);
router.put('/:id', authenticate, requireAdmin, updateService);
router.delete('/:id', authenticate, requireAdmin, deleteService);

module.exports = router;