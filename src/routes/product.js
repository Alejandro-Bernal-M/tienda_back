const express = require('express');
const router = express.Router();
const {getAllProducts, createProduct, getSpecificProducts, deleteProduct, updateProduct, addReviewToProduct} = require('../controllers/product');
const {requireSignin, requireAdmin} = require('../common-middlewares');
const multer = require('multer');
const shortid = require('shortid');
const path = require('path');
const fs = require('fs'); 

// 2. DEFINIR RUTA DE CARPETA
// path.dirname(__dirname) te saca de 'routes' y te lleva a 'src' (o la raíz de tu código)
const uploadDir = path.join(path.dirname(__dirname), 'uploads');

// 3. CREAR CARPETA SI NO EXISTE (Corrección del error ENOENT)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📂 Carpeta 'uploads' creada en:", uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, shortid.generate() + '-' + file.originalname)
  }
})

const upload = multer({ storage: storage })

router.get('/products', getAllProducts);
router.post('/products', requireSignin, requireAdmin, upload.array('productImages'), createProduct);
router.get('/product/:productId', getSpecificProducts);
router.delete('/product/:productId', requireSignin, requireAdmin, deleteProduct);
router.put('/product/:productId', requireSignin, requireAdmin, upload.array('productImages'), updateProduct);
router.put('/product/review/:productId', requireSignin, addReviewToProduct);

module.exports = router;