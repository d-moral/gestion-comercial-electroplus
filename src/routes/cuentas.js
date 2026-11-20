const express = require('express');
const router = express.Router();
const cuentaController = require('../controllers/cuentaController');

router.get('/cliente/:id', cuentaController.obtenerPorCliente);

module.exports = router;