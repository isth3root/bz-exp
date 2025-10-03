import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport';
import passportConfig from './src/config/passport.js';
import authRoutes from './src/routes/auth.js';
import blogsRoutes from './src/routes/blogs.js';
import customersRoutes from './src/routes/customers.js';
import installmentsRoutes from './src/routes/installments.js';
import policiesRoutes from './src/routes/policies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
app.use(cors({
  origin: ['https://www.bimerz.ir', 'https://bimerz.ir', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Passport
passportConfig(passport);
app.use(passport.initialize());

// Routes
app.use('/auth', authRoutes);
app.use('/', blogsRoutes);
app.use('/', customersRoutes);
app.use('/', installmentsRoutes);
app.use('/', policiesRoutes);

export default app;