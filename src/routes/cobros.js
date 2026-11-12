const express = require('express');
const router = express.Router();
const cobroController = require('../controllers/cobroController');

router.get('/agenda', cobroController.agenda);
router.get('/deudores', cobroController.deudores);

module.exports = router;