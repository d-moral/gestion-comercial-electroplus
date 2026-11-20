const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');

router.get('/', backupController.listar);
router.post('/', backupController.crear);
router.get('/:nombre/descargar', backupController.descargar);

module.exports = router;