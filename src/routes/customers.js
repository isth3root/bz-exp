import express from 'express';
const router = express.Router();
import { jwtAuth } from '../middleware/auth.js';
import customersService from '../utils/customersService.js';
import policiesService from '../utils/policiesService.js';
import installmentsService from '../utils/installmentsService.js';
import blogsService from '../utils/blogsService.js';
import dataSource from '../config/database.js';
import Customer from '../models/Customer.js';
import speakeasy from 'speakeasy';

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

// BACKUP FILTERED DATA
router.post('/admin/backup', jwtAuth, async (req, res) => {
  try {
    // Only allow admin role to access backup
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { customers: includeCustomers, policies: includePolicies, installments: includeInstallments, blogs: includeBlogs, totp_code } = req.body;

    // Verify TOTP
    if (!totp_code) {
      return res.status(400).json({ message: 'TOTP code required' });
    }

    const customerRepository = dataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({ where: { id: req.user.userId } });

    if (!customer || !customer.two_factor_secret) {
      return res.status(400).json({ message: '2FA not configured' });
    }

    const speakeasy = (await import('speakeasy')).default;
    const verified = speakeasy.totp.verify({
      secret: customer.two_factor_secret,
      encoding: 'base32',
      token: totp_code,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ message: 'Invalid TOTP code' });
    }

    const backupData = {
      timestamp: new Date().toISOString(),
    };

    if (includeCustomers) {
      backupData.customers = await customersService.findAll();
    }
    if (includePolicies) {
      backupData.policies = await policiesService.findAll();
    }
    if (includeInstallments) {
      backupData.installments = await installmentsService.findAll();
    }
    if (includeBlogs) {
      backupData.blogs = await blogsService.findAll();
    }

    const jsonData = JSON.stringify(backupData, null, 2);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="backup.json"');
    res.send(jsonData);
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ message: 'Error creating backup' });
  }
});

// RESTORE FROM BACKUP
router.post('/admin/restore', jwtAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { backup_data, totp_code } = req.body;

    if (!totp_code) {
      return res.status(400).json({ message: 'TOTP code required' });
    }

    const customerRepository = dataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({ where: { id: req.user.userId } });

    if (!customer || !customer.two_factor_secret) {
      return res.status(400).json({ message: '2FA not configured' });
    }

    const speakeasy = (await import('speakeasy')).default;
    const verified = speakeasy.totp.verify({
      secret: customer.two_factor_secret,
      encoding: 'base32',
      token: totp_code,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ message: 'Invalid TOTP code' });
    }

    if (!backup_data) {
      return res.status(400).json({ message: 'Backup data is required' });
    }

    console.log('🔄 Starting database restore...');

    const customersService = (await import('../utils/customersService.js')).default;
    const policiesService = (await import('../utils/policiesService.js')).default;
    const installmentsService = (await import('../utils/installmentsService.js')).default;
    const blogsService = (await import('../utils/blogsService.js')).default;

    let restoredCount = {
      customers: 0,
      policies: 0,
      installments: 0,
      blogs: 0
    };

    // Restore customers
    if (backup_data.customers && Array.isArray(backup_data.customers)) {
      console.log('👥 Restoring customers...');
      for (const customerData of backup_data.customers) {
        try {
          // Remove ID to avoid conflicts (let database generate new IDs)
          const { id, ...customerWithoutId } = customerData;
          await customersService.create(customerWithoutId);
          restoredCount.customers++;
        } catch (error) {
          console.error('Error restoring customer:', customerData.national_code, error);
        }
      }
    }

    // Restore policies
    if (backup_data.policies && Array.isArray(backup_data.policies)) {
      console.log('📄 Restoring policies...');
      for (const policyData of backup_data.policies) {
        try {
          const { id, ...policyWithoutId } = policyData;
          await policiesService.create(policyWithoutId);
          restoredCount.policies++;
        } catch (error) {
          console.error('Error restoring policy:', policyData.policy_number, error);
        }
      }
    }

    // Restore installments
    if (backup_data.installments && Array.isArray(backup_data.installments)) {
      console.log('💰 Restoring installments...');
      for (const installmentData of backup_data.installments) {
        try {
          const { id, ...installmentWithoutId } = installmentData;
          await installmentsService.create(installmentWithoutId);
          restoredCount.installments++;
        } catch (error) {
          console.error('Error restoring installment:', installmentData.id, error);
        }
      }
    }

    // Restore blogs
    if (backup_data.blogs && Array.isArray(backup_data.blogs)) {
      console.log('📰 Restoring blogs...');
      for (const blogData of backup_data.blogs) {
        try {
          const { id, ...blogWithoutId } = blogData;
          await blogsService.create(blogWithoutId);
          restoredCount.blogs++;
        } catch (error) {
          console.error('Error restoring blog:', blogData.title, error);
        }
      }
    }

    console.log('✅ Database restore completed:', restoredCount);

    res.json({
      message: 'Database restored successfully',
      restored: restoredCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error during database restore:', error);
    res.status(500).json({ message: 'Error restoring database' });
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