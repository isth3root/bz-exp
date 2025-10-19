import express from 'express';
// import cors from "cors";
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cron from 'node-cron';
import { LessThan, Not } from 'typeorm';
import passport from 'passport';
import passportConfig from './src/config/passport.js';
import dataSource from './src/config/database.js';
import Policy from './src/models/Policy.js';
import authRoutes from './src/routes/auth.js';
import blogsRoutes from './src/routes/blogs.js';
import customersRoutes from './src/routes/customers.js';
import installmentsRoutes from './src/routes/installments.js';
import policiesRoutes from './src/routes/policies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// app.use(cors({
//   origin: "http://localhost:5173",
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
// }));

// Middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(cookieParser());
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

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Cron job to delete old PDFs
cron.schedule('0 0 * * *', async () => {
  try {
    const policyRepository = dataSource.getRepository(Policy);
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const oldPolicies = await policyRepository.find({
      where: {
        created_at: LessThan(oneYearAgo),
        pdf_path: Not(null)
      }
    });

    for (const policy of oldPolicies) {
      if (policy.pdf_path) {
        let filePath = path.join(__dirname, policy.pdf_path.substring(1));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        } else {
          // Try legacy path without subfolder
          const parts = policy.pdf_path.split('/');
          if (parts.length >= 4) {
            const filename = parts[parts.length - 1];
            const altPath = path.join(__dirname, 'uploads', 'policies', filename);
            if (fs.existsSync(altPath)) {
              fs.unlinkSync(altPath);
            }
          }
        }
        await policyRepository.update(policy.id, { pdf_path: null });
      }
    }
    console.log('Old PDFs deleted');
  } catch (error) {
    console.error('Error deleting old PDFs:', error);
  }
});

export default app;