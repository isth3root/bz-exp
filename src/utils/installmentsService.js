import { LessThan, Between, Not } from 'typeorm';
import dataSource from '../config/database.js';
import Installment from '../models/Installment.js';

class InstallmentsService {
  async findAll() {
    const installmentRepository = dataSource.getRepository(Installment);
    return installmentRepository.find({ relations: ['customer', 'policy'] });
  }

  async findOne(id) {
    const installmentRepository = dataSource.getRepository(Installment);
    return installmentRepository.findOne({ where: { id }, relations: ['customer', 'policy'] });
  }

  async findAllByCustomer(customerId) {
    const installmentRepository = dataSource.getRepository(Installment);
    return installmentRepository.find({
      where: { customer_id: customerId },
      relations: ['customer', 'policy'],
    });
  }

  async findByPolicyId(policyId) {
    const installmentRepository = dataSource.getRepository(Installment);
    return installmentRepository.find({
      where: { policy_id: policyId },
    });
  }

  async create(installment) {
    const installmentRepository = dataSource.getRepository(Installment);
    const newInstallment = installmentRepository.create(installment);
    return installmentRepository.save(newInstallment);
  }

  async update(id, installment) {
    const installmentRepository = dataSource.getRepository(Installment);
    await installmentRepository.update(id, installment);
    return this.findOne(id);
  }

  async remove(id) {
    const installmentRepository = dataSource.getRepository(Installment);
    await installmentRepository.delete(id);
  }

  async removeByPolicyId(policyId) {
    const installmentRepository = dataSource.getRepository(Installment);
    await installmentRepository.delete({ policy_id: policyId });
  }

  async getOverdueCount() {
    const installmentRepository = dataSource.getRepository(Installment);
    const now = new Date();
    const count = await installmentRepository.count({
      where: {
        status: 'معوق',
        due_date: LessThan(now),
      },
    });
    return count;
  }

  async getNearExpiryCount() {
    const installmentRepository = dataSource.getRepository(Installment);
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(now.getMonth() + 1);

    return installmentRepository.count({
      where: {
        due_date: Between(now, oneMonthFromNow),
        status: Not('پرداخت شده'),
      },
    });
  }
}

export default new InstallmentsService();