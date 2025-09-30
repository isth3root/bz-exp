import dataSource from '../config/database.js';
import Customer from '../models/Customer.js';
import Policy from '../models/Policy.js';

class CustomersService {
  async findAll() {
    const customerRepository = dataSource.getRepository(Customer);
    return customerRepository.find();
  }

  async findOne(id) {
    console.log('Service findOne id:', id, typeof id);
    const customerRepository = dataSource.getRepository(Customer);
    const result = await customerRepository.findOne({ where: { id: id } });
    console.log('Service findOne result:', result);
    return result;
  }

  async create(customer) {
    const customerRepository = dataSource.getRepository(Customer);
    const newCustomer = customerRepository.create(customer);
    return customerRepository.save(newCustomer);
  }

  async update(id, customer) {
    console.log('Service update id:', id, 'customer:', customer);
    const customerRepository = dataSource.getRepository(Customer);
    const policyRepository = dataSource.getRepository(Policy);

    return await dataSource.transaction(async (manager) => {
      const existingCustomer = await manager.findOne(Customer, { where: { id: id } });
      if (!existingCustomer) {
        throw new Error('Customer not found');
      }

      const oldNationalCode = existingCustomer.national_code;
      const newNationalCode = customer.national_code;

      if (newNationalCode && newNationalCode !== oldNationalCode) {
        // Update all policies with the old national_code to the new one
        await manager.update(Policy, { customer_national_code: oldNationalCode }, { customer_national_code: newNationalCode });
      }

      // Update the customer
      await manager.update(Customer, id, customer);
      console.log('Update result: success');

      return this.findOne(id);
    });
  }

  async remove(id) {
    console.log('Service remove id:', id);
    const customerRepository = dataSource.getRepository(Customer);
    const deleteResult = await customerRepository.delete(id);
    console.log('Delete result:', deleteResult);
  }

  async getCount() {
    const customerRepository = dataSource.getRepository(Customer);
    return customerRepository.count();
  }

  async findByNationalCode(nationalCode) {
    console.log('Service findByNationalCode:', nationalCode);
    const customerRepository = dataSource.getRepository(Customer);
    const result = await customerRepository.findOne({ where: { national_code: nationalCode } });
    console.log('findByNationalCode result:', result);
    return result;
  }

  async findByName(name) {
    const customerRepository = dataSource.getRepository(Customer);
    return customerRepository
      .createQueryBuilder('customer')
      .where('customer.full_name LIKE :name', { name: `%${name}%` })
      .getMany();
  }
}

export default new CustomersService();