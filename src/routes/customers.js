import express from 'express';
const router = express.Router();
import { jwtAuth } from '../middleware/auth.js';
import customersService from '../utils/customersService.js';

// CREATE CUSTOMER
router.post('/admin/customers', jwtAuth, async (req, res) => {
  try {
    const customer = await customersService.create(req.body);
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error creating customer' });
  }
});

// GET ALL CUSTOMERS
router.get('/admin/customers', jwtAuth, async (req, res) => {
  try {
    const customers = await customersService.findAll();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers' });
  }
});

// CUSTOMERS COUNT
router.get('/admin/customers/count', jwtAuth, async (req, res) => {
  try {
    const count = await customersService.getCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error getting count' });
  }
});

// GET CUSTOMER BY NATIONAL ID
router.get('/admin/customers/by-national/:nationalCode', jwtAuth, async (req, res) => {
  console.log('Get by national route hit, nationalCode:', req.params.nationalCode);
  try {
    console.log('Fetching customer by national code:', req.params.nationalCode);
    const customer = await customersService.findByNationalCode(req.params.nationalCode);
    console.log('Customer found:', customer);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer by national code:', error);
    res.status(500).json({ message: 'Error fetching customer' });
  }
});

// GET SINGLE CUSTOMER
router.get('/admin/customers/:id', jwtAuth, async (req, res) => {
  console.log('Get single customer route hit, id:', req.params.id);
  try {
    const id = parseInt(req.params.id);
    console.log('Fetching customer id:', id);
    const customer = await customersService.findOne(id);
    console.log('Customer:', customer);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ message: 'Error fetching customer' });
  }
});

// UPDATE CUSTOMER
router.put('/admin/customers/:id', jwtAuth, async (req, res) => {
  console.log('Update customer route hit, id:', req.params.id);
  try {
    const id = parseInt(req.params.id);
    console.log('Updating customer id:', id, 'body:', req.body);
    const updatedCustomer = await customersService.update(id, req.body);
    console.log('Updated customer:', updatedCustomer);
    if (!updatedCustomer) return res.status(404).json({ message: 'Customer not found' });
    res.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ message: 'Error updating customer' });
  }
});

// DELETE CUSTOMER
router.delete('/admin/customers/:id', jwtAuth, async (req, res) => {
  console.log('Delete customer route hit, id:', req.params.id);
  try {
    const id = parseInt(req.params.id);
    console.log('Deleting customer id:', id);
    await customersService.remove(id);
    console.log('Customer deleted');
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ message: 'Error deleting customer' });
  }
});

export default router;