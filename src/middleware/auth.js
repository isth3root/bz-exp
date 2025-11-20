import jwt from 'jsonwebtoken';
import passport from 'passport';
import dataSource from '../config/database.js';
import Customer from '../models/Customer.js';

const localAuth = passport.authenticate('local', { session: false });

const getJwtSecret = (role) => {
  switch (role) {
    case 'admin':
      return process.env.JWT_SECRET_ADMIN;
    case 'admin-2':
      return process.env.JWT_SECRET_ADMIN2;
    case 'admin-3':
      return process.env.JWT_SECRET_ADMIN3;
    default:
      return process.env.JWT_SECRET_CUSTOMERS;
  }
};

const jwtAuth = async (req, res, next) => {
  try {
    // console.log('🔐 JWT Auth Middleware - Checking token...');
    const token = req.cookies.token;
    // console.log('📋 Token from cookie:', token ? 'Present' : 'Missing');
    
    if (!token) {
      // console.log('❌ No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }

    // Decode token to get user ID and role
    const decoded = jwt.decode(token);
    // console.log('📄 Decoded token:', decoded);
    
    if (!decoded || !decoded.sub || !decoded.role) {
      // console.log('❌ Invalid token structure');
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get user
    const customerRepository = dataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({
      where: { id: decoded.sub },
      select: ['id', 'national_code', 'role']
    });

    // console.log('👤 Found customer:', customer ? 'Yes' : 'No');
    
    if (!customer) {
      // console.log('❌ User not found in database');
      return res.status(401).json({ message: 'User not found' });
    }

    // Verify token with role-based secret
    const secret = getJwtSecret(customer.role);
    // console.log('🔑 Using secret for role:', customer.role);
    
    jwt.verify(token, secret, (err, payload) => {
      if (err) {
        // console.log('❌ Token verification failed:', err.message);
        return res.status(401).json({ message: 'Token verification failed' });
      }
      // console.log('✅ Token verified successfully');
      req.user = { userId: payload.sub, username: payload.username, role: payload.role };
      next();
    });
  } catch (error) {
    // console.log('💥 Authentication error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};

const adminAuth = jwtAuth;

export { localAuth, jwtAuth, adminAuth };