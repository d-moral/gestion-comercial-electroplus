const express = require('express');
const router = express.Router();
const gastoController = require('../controllers/gastoController');

router.get('/', gastoController.listar);
router.post('/', gastoController.crear);
router.put('/:id', gastoController.actualizar);
router.delete('/:id', gastoController.eliminar);

module.exports = router;