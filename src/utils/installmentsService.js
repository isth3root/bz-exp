import { LessThan, Between, Not, MoreThan } from 'typeorm';
import dataSource from '../config/database.js';
import Installment from '../models/Installment.js';
import jalaali from "jalaali-js";

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

    // Get the current installment before update
    const currentInstallment = await this.findOne(id);
    if (!currentInstallment) {
      throw new Error('Installment not found');
    }

    const oldAmount = parseFloat(currentInstallment.amount);
    const newAmount = parseFloat(installment.amount);
    const difference = newAmount - oldAmount;

    // If amount increased, set status to paid and subtract the difference from subsequent installments
    if (difference > 0) {
      installment.status = 'پرداخت شده';
    }

    // Update the current installment
    await installmentRepository.update(id, installment);

    // If amount increased, subtract the difference from subsequent installments
    if (difference > 0) {
      let remainingDifference = difference;

      // Find subsequent installments for the same policy, ordered by installment_number
      const subsequentInstallments = await installmentRepository.find({
        where: {
          policy_id: currentInstallment.policy_id,
          installment_number: MoreThan(currentInstallment.installment_number)
        },
        order: {
          installment_number: 'ASC'
        }
      });

      for (const subInst of subsequentInstallments) {
        if (remainingDifference <= 0) break;

        const subAmount = parseFloat(subInst.amount);
        const newSubAmount = subAmount - remainingDifference;

        if (newSubAmount <= 0) {
          // Set to paid and continue with remaining difference
          await installmentRepository.update(subInst.id, {
            amount: 0,
            status: 'پرداخت شده'
          });
          remainingDifference = -newSubAmount; // remaining difference becomes positive again
        } else {
          // Just subtract the difference
          await installmentRepository.update(subInst.id, {
            amount: newSubAmount
          });
          remainingDifference = 0;
        }
      }
    }

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
    const installments = await installmentRepository.find({
      where: { status: 'معوق' },
    });
    const now = new Date();
    return installments.filter(inst => {
      const [jy, jm, jd] = inst.due_date.split('/').map(Number);
      const gregorian = jalaali.toGregorian(jy, jm, jd);
      const dueDate = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
      return dueDate < now;
    }).length;
  }

  async getNearExpiryCount() {
    const installmentRepository = dataSource.getRepository(Installment);
    const installments = await installmentRepository.find({
      where: { status: Not('پرداخت شده') },
    });
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(now.getMonth() + 1);

    return installments.filter(inst => {
      const [jy, jm, jd] = inst.due_date.split('/').map(Number);
      const gregorian = jalaali.toGregorian(jy, jm, jd);
      const dueDate = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
      return dueDate >= now && dueDate <= oneMonthFromNow;
    }).length;
  }

  async existsByPolicyIdAndInstallmentNumber(policyId, installmentNumber) {
    const installmentRepository = dataSource.getRepository(Installment);
    const count = await installmentRepository.count({
      where: { policy_id: policyId, installment_number: installmentNumber }
    });
    return count > 0;
  }
}

export default new InstallmentsService();