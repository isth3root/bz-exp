import jwt from 'jsonwebtoken';
import dataSource from '../config/database.js';
import Customer from '../models/Customer.js';

class AuthService {
  async validateCustomer(username, password) {
    const customerRepository = dataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({
      where: [
        { national_code: username },
        { phone: username },
      ],
    });
    if (customer && customer.phone === password) {
      const { phone, ...result } = customer;
      return result;
    }
    return null;
  }

  async login(customer) {
    const payload = { username: customer.national_code, sub: customer.id, role: customer.role };
    return {
      access_token: jwt.sign(payload, process.env.JWT_SECRET || 'secretKey'),
      userId: customer.id,
      username: customer.national_code,
      role: customer.role,
    };
  }
}

export default new AuthService();