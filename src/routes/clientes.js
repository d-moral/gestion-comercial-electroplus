const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');

router.get('/', clienteController.listar);
router.post('/', clienteController.crear);
router.get('/:id', clienteController.obtenerUno);
router.put('/:id', clienteController.actualizar);
router.delete('/:id', clienteController.eliminar);

module.exports = router;