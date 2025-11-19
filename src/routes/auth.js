const express = require('express');
const router = express.Router();
const {signup, signin} = require('../controllers/auth')
const multer = require('multer');
const shortid = require('shortid');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(path.dirname(__dirname), 'uploads'))
  },
  filename: function (req, file, cb) {
    cb(null, shortid.generate() + '-' + file.originalname)
  }
})

const upload = multer({ storage: storage })

router.post('/signin', signin);
router.post('/signup', upload.single('profileImage'), signup);


module.exports = router;