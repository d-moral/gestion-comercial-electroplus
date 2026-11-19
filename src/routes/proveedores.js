const express = require('express');
const router = express.Router();
const proveedorController = require('../controllers/proveedorController');

router.get('/', proveedorController.listar);
router.post('/', proveedorController.crear);
router.put('/:id', proveedorController.actualizar);
router.delete('/:id', proveedorController.eliminar);
router.get('/:id/compras', proveedorController.listarCompras);

module.exports = router;