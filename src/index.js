const express = require('express');
const mongoose = require('mongoose');
const env = require('dotenv');
const app = express();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

//routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/product');
const categoryRoutes = require('./routes/category');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/order');
const homeSectionsRoutes = require('./routes/homeSection');
const paymentRoutes = require('./routes/paymentRoutes');

//env
env.config();

// cors config
const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, "") : "";

var whitelist = [
  frontendUrl, 
  'https://mercadopago.com.co',
  'http://localhost:3000' // Opcional: Para que siga funcionando en local
];

var corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origen (como Postman o Server-to-Server)
    if (!origin) return callback(null, true);

    // LOG DE DEPURACIÓN (Míralo en los logs de Render)
    console.log("🔍 Origen recibido:", origin);

    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("❌ Bloqueado por CORS. Whitelist actual:", whitelist);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Array es mejor que string
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors()); // <--- IMPORTANTE: Habilitar Preflight

//database conection
mongoose.connect(process.env.MONGO_URI).then(() => console.log('Db connected')).catch((err) => console.log('Db connection error', err));

app.use(express.urlencoded({extended: true}));
app.use(express.json());

// files
app.use('/public',express.static(path.join(__dirname, 'uploads')));


// routes
app.use('/api', authRoutes);
app.use('/api', productRoutes);
app.use('/api', categoryRoutes);
app.use('/api', cartRoutes);
app.use('/api', orderRoutes);
app.use('/api', homeSectionsRoutes);
app.use('/api/payment', paymentRoutes);

app.listen(process.env.PORT, () => {
  console.log(`application running on Port: ${process.env.PORT}`)
})