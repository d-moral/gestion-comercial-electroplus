const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compraController');

router.post('/', compraController.crear);
router.put('/:id', compraController.actualizar);
router.patch('/:id/pagada', compraController.marcarPagada);
router.delete('/:id', compraController.eliminar);

module.exports = router;