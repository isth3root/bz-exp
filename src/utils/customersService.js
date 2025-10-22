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
    const policyRepository = dataSource.getRepository(Policy);

    // Find the customer to get national_code
    const customer = await customerRepository.findOne({ where: { id } });
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Find all policies for this customer
    const policies = await policyRepository.find({ where: { customer_national_code: customer.national_code } });

    // Delete each policy (which will also delete installments and PDF files)
    for (const policy of policies) {
      await this.removePolicyAndRelated(policy.id);
    }

    // Delete the customer
    const deleteResult = await customerRepository.delete(id);
    console.log('Delete result:', deleteResult);
  }

  async removePolicyAndRelated(policyId) {
    const policyRepository = dataSource.getRepository(Policy);
    const installmentsService = (await import('./installmentsService.js')).default;

    const policy = await policyRepository.findOne({ where: { id: policyId } });

    // Delete associated PDF file if exists
    if (policy && policy.pdf_path) {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), policy.pdf_path.substring(1));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete associated installments
    await installmentsService.removeByPolicyId(policyId);

    // Delete the policy
    await policyRepository.delete(policyId);
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

  async search(query) {
    const customerRepository = dataSource.getRepository(Customer);
    return customerRepository
      .createQueryBuilder('customer')
      .where('customer.full_name LIKE :query OR customer.national_code LIKE :query', {
        query: `%${query}%`
      })
      .getMany();
  }

  async existsByNationalCode(nationalCode) {
    const customerRepository = dataSource.getRepository(Customer);
    const count = await customerRepository.count({ where: { national_code: nationalCode } });
    return count > 0;
  }
}

export default new CustomersService();