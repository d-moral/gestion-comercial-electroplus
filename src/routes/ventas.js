const express = require('express');
const router = express.Router();
const ventaController = require('../controllers/ventaController');

router.get('/', ventaController.listar);
router.post('/', ventaController.crear);
router.get('/:id', ventaController.obtenerUna);
router.get('/:id/remito', ventaController.remito);
router.patch('/:id/anular', ventaController.anular);

module.exports = router;