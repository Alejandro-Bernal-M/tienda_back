const express = require('express');
const router = express.Router();
const { createSession } = require('../controllers/stripe');

router.post('/stripe/create-session', createSession);

module.exports = router;