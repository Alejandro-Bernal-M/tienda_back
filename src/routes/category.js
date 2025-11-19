const express = require('express');
const router = express.Router();
const {getAllCategories, createCategory, updateCategory, deleteCategory} = require('../controllers/category');
const {requireSignin, requireAdmin} = require('../common-middlewares');
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

router.get('/categories', getAllCategories);
router.post('/categories', requireSignin, requireAdmin, upload.single('categoryImage'), createCategory);
router.put('/categories/:id', requireSignin, requireAdmin,upload.single('categoryImage'), updateCategory);
router.delete('/categories/:id', requireSignin, requireAdmin, deleteCategory);

module.exports = router;