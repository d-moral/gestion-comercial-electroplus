const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');

router.post('/', pagoController.crear);
router.patch('/:id/anular', pagoController.anular);

module.exports = router;