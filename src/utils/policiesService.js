import { Between } from 'typeorm';
import dataSource from '../config/database.js';
import Policy from '../models/Policy.js';
import installmentsService from './installmentsService.js';

class PoliciesService {
  async findAll() {
    const policyRepository = dataSource.getRepository(Policy);
    const policies = await policyRepository.find({ relations: ['customer'] });
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(now.getMonth() + 1);

    return policies.map(policy => {
      let status = policy.status;
      if (policy.end_date) {
        const endDate = new Date(policy.end_date);
        if (endDate < now) {
          status = 'منقضی';
        } else if (endDate <= oneMonthFromNow) {
          status = 'نزدیک انقضا';
        }
      }
      return { ...policy, status };
    });
  }

  async findOne(id) {
    const policyRepository = dataSource.getRepository(Policy);
    return policyRepository.findOne({ where: { id }, relations: ['customer'] });
  }

  async findByCustomerNationalCode(nationalCode) {
    const policyRepository = dataSource.getRepository(Policy);
    return policyRepository.find({ where: { customer_national_code: nationalCode }, relations: ['customer'] });
  }

  async create(policy) {
    const policyRepository = dataSource.getRepository(Policy);

    // Calculate status based on dates if not provided
    let status = policy.status || 'فعال';
    if (!policy.status && policy.end_date) {
      const now = new Date();
      const endDate = new Date(policy.end_date);
      if (endDate < now) {
        status = 'منقضی';
      }
    }

    const newPolicy = policyRepository.create({
      ...policy,
      customer_national_code: policy.customer_national_code,
      premium: +(policy.premium || 0),
      installment_count: +(policy.installment_count || 0),
      status,
      payment_id: policy.payment_id || null,
    });
    const savedPolicy = await policyRepository.save(newPolicy);

    // Fetch the saved policy with relations
    const policyWithRelations = await this.findOne(savedPolicy.id);
    if (!policyWithRelations) {
      throw new Error('Failed to retrieve saved policy');
    }

    // Create installments if payment type is اقساطی
    if (policy.payment_type === 'اقساطی' && policy.installment_count && policy.installment_count > 0 && policyWithRelations.premium) {
      const installmentAmount = policyWithRelations.premium / policy.installment_count;
      const startDate = policyWithRelations.start_date ? new Date(policyWithRelations.start_date) : new Date();
      const startDay = startDate.getDate();

      for (let i = 1; i <= policy.installment_count; i++) {
        const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const lastDayOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
        dueDate.setDate(Math.min(startDay, lastDayOfMonth));

        await installmentsService.create({
          customer_id: policyWithRelations.customer.id,
          policy_id: policyWithRelations.id,
          installment_number: i,
          amount: installmentAmount,
          due_date: dueDate,
          status: 'معوق',
          pay_link: policyWithRelations.payment_link,
        });
      }
    }

    return policyWithRelations;
  }

  async update(id, policy) {
    const policyRepository = dataSource.getRepository(Policy);
    await policyRepository.update(id, policy);
    const updatedPolicy = await this.findOne(id);

    if (updatedPolicy && policy.payment_link) {
      const installments = await installmentsService.findByPolicyId(id);
      for (const installment of installments) {
        if (installment.status !== 'پرداخت شده') {
          await installmentsService.update(installment.id, { pay_link: policy.payment_link });
        }
      }
    }
    return updatedPolicy;
  }

  async remove(id) {
    // First delete all associated installments
    await installmentsService.removeByPolicyId(id);
    // Then delete the policy
    const policyRepository = dataSource.getRepository(Policy);
    await policyRepository.delete(id);
  }

  async getCount() {
    const policyRepository = dataSource.getRepository(Policy);
    return policyRepository.count();
  }

  async getNearExpiryCount() {
    const policyRepository = dataSource.getRepository(Policy);
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(now.getMonth() + 1);

    return policyRepository.count({
      where: {
        end_date: Between(now, oneMonthFromNow),
      },
    });
  }

  async getAllInstallments() {
    const policies = await this.findAll();
    const allInstallments = [];
    const now = new Date();
    for (const policy of policies) {
      if (policy.payment_type === 'اقساطی' && policy.installment_count && policy.installment_count > 0 && policy.premium) {
        const installmentAmount = policy.premium / policy.installment_count;
        const startDate = policy.start_date ? new Date(policy.start_date) : new Date();
        for (let i = 1; i <= policy.installment_count; i++) {
          const dueDate = new Date(startDate);
          dueDate.setMonth(startDate.getMonth() + i - 1);
          let status = 'آینده';
          if (dueDate < now) {
            status = 'معوق';
          }
          allInstallments.push({
            id: `${policy.id}-${i}`,
            customerName: policy.customer ? policy.customer.full_name : 'Unknown',
            customerNationalCode: policy.customer ? policy.customer.national_code : '',
            policyType: policy.insurance_type,
            amount: installmentAmount.toString(),
            dueDate: dueDate.toISOString().split('T')[0], // YYYY-MM-DD
            status,
            policyId: policy.id,
            installmentNumber: i,
          });
        }
      }
    }
    return allInstallments;
  }
}

export default new PoliciesService();