const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');

router.get('/', backupController.listar);
router.post('/', backupController.crear);
router.get('/:nombre/descargar', backupController.descargar);
router.post('/:nombre/restaurar', backupController.restaurar);

module.exports = router;