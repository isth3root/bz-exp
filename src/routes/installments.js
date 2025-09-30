import express from 'express';
const router = express.Router();
import { jwtAuth } from '../middleware/auth.js';
import installmentsService from '../utils/installmentsService.js';

router.get('/installments/admin', jwtAuth, async (req, res) => {
  try {
    const installments = await installmentsService.findAll();
    res.json(installments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching installments' });
  }
});

router.get('/installments/customer', jwtAuth, async (req, res) => {
  try {
    const installments = await installmentsService.findAllByCustomer(req.user.userId);
    res.json(installments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching installments' });
  }
});

router.get('/installments/overdue/count', jwtAuth, async (req, res) => {
  try {
    const count = await installmentsService.getOverdueCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error getting overdue count' });
  }
});

router.get('/installments/near-expiry/count', jwtAuth, async (req, res) => {
  try {
    const count = await installmentsService.getNearExpiryCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error getting near expiry count' });
  }
});

router.get('/installments/:id', jwtAuth, async (req, res) => {
  try {
    const installment = await installmentsService.findOne(req.params.id);
    if (!installment) return res.status(404).json({ message: 'Installment not found' });
    res.json(installment);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching installment' });
  }
});

router.post('/installments', jwtAuth, async (req, res) => {
  try {
    const installment = await installmentsService.create(req.body);
    res.json(installment);
  } catch (error) {
    res.status(500).json({ message: 'Error creating installment' });
  }
});

router.put('/installments/:id', jwtAuth, async (req, res) => {
  try {
    const updatedInstallment = await installmentsService.update(req.params.id, req.body);
    if (!updatedInstallment) return res.status(404).json({ message: 'Installment not found' });
    res.json(updatedInstallment);
  } catch (error) {
    res.status(500).json({ message: 'Error updating installment' });
  }
});

router.delete('/installments/:id', jwtAuth, async (req, res) => {
  try {
    await installmentsService.remove(req.params.id);
    res.json({ message: 'Installment deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting installment' });
  }
});

export default router;