const multer = require('multer');
const express = require('express');
const path = require('path');
const shortid = require('shortid');
const router = express.Router();
const { createHomeSection, getHomeSections, updateHomeSection, deleteHomeSection } = require('../controllers/homeSection');
const { requireSignin, requireAdmin } = require('../common-middlewares');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(path.dirname(__dirname), 'uploads'))
  },
  filename: function (req, file, cb) {
    cb(null, shortid.generate() + '-' + file.originalname)
  }
})

const upload = multer({ storage: storage });

router.post('/homeSection/create', requireSignin, requireAdmin, upload.single('image'), createHomeSection);
router.get('/homeSections', getHomeSections);
router.put('/homeSection/update/:id', requireSignin, requireAdmin, upload.single('image'), updateHomeSection);
router.delete('/homeSection/delete/:id', requireSignin, requireAdmin, deleteHomeSection);

module.exports = router;