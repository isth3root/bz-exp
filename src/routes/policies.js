import express from 'express';
const router = express.Router();
import multer from 'multer';
const upload = multer({ dest: 'uploads/policies/' });
import { jwtAuth } from '../middleware/auth.js';
import policiesService from '../utils/policiesService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/admin/policies', jwtAuth, async (req, res) => {
  try {
    const policies = await policiesService.findAll();
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching policies' });
  }
});

router.post('/admin/policies', jwtAuth, upload.single('pdf'), async (req, res) => {
  try {
    const policy = req.body;
    if (req.file) {
      policy.pdf_path = `/uploads/policies/${req.file.filename}`;
    }
    const newPolicy = await policiesService.create(policy);
    res.json(newPolicy);
  } catch (error) {
    res.status(500).json({ message: 'Error creating policy' });
  }
});

router.get('/customer/policies', jwtAuth, async (req, res) => {
  try {
    const policies = await policiesService.findByCustomerNationalCode(req.user.username);
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching policies' });
  }
});

router.put('/admin/policies/:id', jwtAuth, async (req, res) => {
  try {
    const updatedPolicy = await policiesService.update(req.params.id, req.body);
    if (!updatedPolicy) return res.status(404).json({ message: 'Policy not found' });
    res.json(updatedPolicy);
  } catch (error) {
    res.status(500).json({ message: 'Error updating policy' });
  }
});

router.delete('/admin/policies/:id', jwtAuth, async (req, res) => {
  try {
    await policiesService.remove(req.params.id);
    res.json({ message: 'Policy deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting policy' });
  }
});

router.get('/admin/installments', jwtAuth, async (req, res) => {
  try {
    const installments = await policiesService.getAllInstallments();
    res.json(installments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching installments' });
  }
});

router.get('/count', jwtAuth, async (req, res) => {
  try {
    const count = await policiesService.getCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error getting count' });
  }
});

router.get('/admin/policies/near-expiry/count', jwtAuth, async (req, res) => {
  try {
    const count = await policiesService.getNearExpiryCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error getting near expiry count' });
  }
});

router.get('/customer/policies/:id/download', jwtAuth, async (req, res) => {
  try {
    const policy = await policiesService.findOne(req.params.id);
    if (policy && policy.pdf_path) {
      let filePath = path.join(__dirname, '..', '..', policy.pdf_path.substring(1));
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        // Try without national_code subfolder for legacy paths
        const parts = policy.pdf_path.split('/');
        if (parts.length >= 4) {
          const filename = parts[parts.length - 1];
          const altPath = path.join(__dirname, '..', '..', 'uploads', 'policies', filename);
          if (fs.existsSync(altPath)) {
            res.sendFile(altPath);
          } else {
            res.status(404).send('File not found');
          }
        } else {
          res.status(404).send('File not found');
        }
      }
    } else {
      res.status(404).send('File not found');
    }
  } catch (error) {
    res.status(500).json({ message: 'Error downloading file' });
  }
});

export default router;