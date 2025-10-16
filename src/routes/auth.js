import express from 'express';
const router = express.Router();
import { localAuth } from '../middleware/auth.js';
import authService from '../utils/authService.js';
import speakeasy from 'speakeasy';
import dataSource from '../config/database.js';
import Customer from '../models/Customer.js';
import { jwtAuth } from '../middleware/auth.js';

router.post('/login', localAuth, async (req, res) => {
  try {
    if (req.user.status === 'غیرفعال') {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    // Check if user is admin
    if (req.user.role.startsWith('admin')) {
      // If admin doesn't have 2FA secret, generate one
      if (!req.user.two_factor_secret) {
        const secret = speakeasy.generateSecret({
          name: `Bimeh Admin (${req.user.national_code})`,
          issuer: 'Bimeh App'
        });
        req.user.two_factor_secret = secret.base32;
        const customerRepository = dataSource.getRepository(Customer);
        await customerRepository.save(req.user);
        console.log('2FA Secret generated for admin:', secret.otpauth_url);
        return res.json({
          requires_setup: true,
          secret: secret.base32,
          otpauth_url: secret.otpauth_url,
          userId: req.user.id,
          role: req.user.role,
          message: '2FA setup required'
        });
      } else {
        // Admin has 2FA secret, require verification
        return res.json({
          requires_2fa: true,
          userId: req.user.id,
          role: req.user.role,
          message: '2FA required'
        });
      }
    }

    const result = await authService.login(req.user);
    res.cookie('token', result.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: req.user.role === 'admin' ? 15 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ username: req.user.national_code, role: req.user.role });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

// Generate 2FA secret for admin
router.post('/generate-2fa', jwtAuth, async (req, res) => {
  try {
    if (!req.user.role.startsWith('admin')) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const customerRepository = dataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({ where: { id: req.user.userId } });

    if (!customer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const secret = speakeasy.generateSecret({
      name: `Bimeh Admin (${customer.national_code})`,
      issuer: 'Bimeh App'
    });

    customer.two_factor_secret = secret.base32;
    await customerRepository.save(customer);

    console.log('2FA Secret for admin:', secret.otpauth_url);

    res.json({
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
      message: '2FA secret generated. Check console for QR code URL.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate 2FA secret' });
  }
});

// Verify 2FA code
router.post('/verify-2fa', async (req, res) => {
  try {
    const { userId, code } = req.body;

    const customerRepository = dataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({ where: { id: userId } });

    if (!customer || !customer.two_factor_secret) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const verified = speakeasy.totp.verify({
      secret: customer.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ message: 'Invalid 2FA code' });
    }

    const result = await authService.login(customer);
    res.cookie('token', result.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: customer.role === 'admin' ? 15 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ username: customer.national_code, role: customer.role });
  } catch (error) {
    res.status(500).json({ message: '2FA verification failed' });
  }
});

router.get('/verify', jwtAuth, (req, res) => {
  console.log('✅ Auth verify SUCCESS - user:', req.user);
  res.json({
    authenticated: true,
    user: {
      username: req.user.username,
      role: req.user.role
    }
  })
})

// Logout route
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

export default router;