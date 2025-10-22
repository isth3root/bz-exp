import { Between } from 'typeorm';
import dataSource from '../config/database.js';
import Policy from '../models/Policy.js';
import installmentsService from './installmentsService.js';
import jalaali from "jalaali-js"
const {jalaaliMonthLength} = jalaali;

function addJalaaliMonth({y, m, d}, plus) {
  let newMonth = m + plus;
  let newYear = y;

  while (newMonth > 12) {
    newMonth -= 12;
    newYear++;
  }

  let maxDay = jalaaliMonthLength(newYear, newMonth);
  if (d > maxDay) d = maxDay;

  return { y: newYear, m: newMonth, d}
}

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
        const [jy, jm, jd] = policy.end_date.split('/').map(Number);
        const gregorian = jalaali.toGregorian(jy, jm, jd);
        const endDate = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
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
    const policies = await policyRepository.find({ where: { customer_national_code: nationalCode }, relations: ['customer'] });
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(now.getMonth() + 1);

    return policies.map(policy => {
      let status = policy.status;
      if (policy.end_date) {
        const [jy, jm, jd] = policy.end_date.split('/').map(Number);
        const gregorian = jalaali.toGregorian(jy, jm, jd);
        const endDate = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
        if (endDate < now) {
          status = 'منقضی';
        } else if (endDate <= oneMonthFromNow) {
          status = 'نزدیک انقضا';
        }
      }
      return { ...policy, status };
    });
  }

  async findByCustomerId(customerId) {
    const customerRepository = dataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({ where: { id: customerId } });
    if (!customer) return [];
    return this.findByCustomerNationalCode(customer.national_code);
  }

  async create(policy) {
    const policyRepository = dataSource.getRepository(Policy);

    // Calculate end_date if not provided
    if (!policy.end_date || policy.end_date.trim() === '') {
      const [jy, jm, jd] = policy.start_date.split('/').map(Number);
      const newJy = jy + 1;
      policy.end_date = `${newJy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
    }

    // Calculate status based on dates if not provided
    let status = policy.status || 'فعال';
    if (!policy.status && policy.end_date) {
      const [jy, jm, jd] = policy.end_date.split('/').map(Number);
      const gregorian = jalaali.toGregorian(jy, jm, jd);
      const endDate = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
      const now = new Date();
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
    if (!policyWithRelations.customer) {
      throw new Error('Customer not found for the policy');
    }

    // Create installments if payment type is اقساطی
    if (policy.payment_type === 'اقساطی' && policy.installment_count && policy.installment_count > 0 && policyWithRelations.premium) {
      let baseAmount, remainder, total, count;
      if (policy.installment_type === 'پیش پرداخت' && policy.first_installment_amount) {
        total = policyWithRelations.premium - policy.first_installment_amount;
        count = policy.installment_count - 1;
        baseAmount = Math.floor(total / count);
        remainder = total % count;
      } else {
        total = policyWithRelations.premium;
        count = policy.installment_count;
        baseAmount = Math.floor(total / count);
        remainder = total % count;
      }

      let [sy, sm, sd] = policyWithRelations.start_date.split("/").map(Number);
      if (!sy || !sm || !sd) throw new Error("Invalid start_date format")
      if (sy < 1300) sy += 620;

      for (let i = 0; i < policy.installment_count; i++) {
        const monthsToAdd = policy.installment_type === 'پیش پرداخت' ? i : i + 1;
        let { y, m, d } = addJalaaliMonth({ y: sy, m: sm, d: sd }, monthsToAdd);

        // due_date as Jalaali string
        let due_date = `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;

        // Calculate status based on current date
        const now = new Date();
        const nowJalaali = jalaali.toJalaali(now);
        let status = "آینده";
        if (y < nowJalaali.jy || (y === nowJalaali.jy && m < nowJalaali.jm) || (y === nowJalaali.jy && m === nowJalaali.jm && d < nowJalaali.jd)) {
          status = "معوق";
        }

        // Calculate amount without decimals, add remainder to the last installment
        let amount;
        if (policy.installment_type === 'پیش پرداخت' && i === 0 && policy.first_installment_amount) {
          amount = policy.first_installment_amount;
        } else {
          amount = baseAmount + (i === policy.installment_count - 1 ? remainder : 0);
        }

        await installmentsService.create({
          customer_id: policyWithRelations.customer.id,
          policy_id: policyWithRelations.id,
          installment_number: i + 1,
          amount,
          due_date,
          status,
          pay_link: policyWithRelations.payment_link,
        });
      }
    }

  return policyWithRelations;
}

  async update(id, policy) {
    const policyRepository = dataSource.getRepository(Policy);

    const oldPolicy = await this.findOne(id);
    if (!oldPolicy) return null;

    await policyRepository.update(id, policy);
    const updatedPolicy = await this.findOne(id);

    return updatedPolicy;
  }

  async remove(id) {
    const policyRepository = dataSource.getRepository(Policy);
    const policy = await policyRepository.findOne({ where: { id } });

    // Delete associated PDF file if exists
    if (policy && policy.pdf_path) {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), policy.pdf_path.substring(1));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // First delete all associated installments
    await installmentsService.removeByPolicyId(id);
    // Then delete the policy
    await policyRepository.delete(id);
  }

  async getCount() {
    const policyRepository = dataSource.getRepository(Policy);
    return policyRepository.count();
  }

  async getNearExpiryCount() {
    const policyRepository = dataSource.getRepository(Policy);
    const policies = await policyRepository.find();
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(now.getMonth() + 1);

    return policies.filter(policy => {
      if (!policy.end_date) return false;
      const [jy, jm, jd] = policy.end_date.split('/').map(Number);
      const gregorian = jalaali.toGregorian(jy, jm, jd);
      const endDate = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
      return endDate >= now && endDate <= oneMonthFromNow;
    }).length;
  }

  async getAllInstallments() {
    const policies = await this.findAll();
    const allInstallments = [];
    const now = new Date();
    for (const policy of policies) {
      if (policy.payment_type === 'اقساطی' && policy.installment_count && policy.installment_count > 0 && policy.premium) {
        let baseAmount, remainder, total, count;
        if (policy.installment_type === 'پیش پرداخت' && policy.first_installment_amount) {
          total = policy.premium - policy.first_installment_amount;
          count = policy.installment_count - 1;
          baseAmount = Math.floor(total / count);
          remainder = total % count;
        } else {
          total = policy.premium;
          count = policy.installment_count;
          baseAmount = Math.floor(total / count);
          remainder = total % count;
        }

        let [startYear, startMonth, startDay] = [0, 0, 0];
        if (policy.start_date) {
          [startYear, startMonth, startDay] = policy.start_date.split('/').map(Number);
          if (startYear < 1300) startYear += 620;
        } else {
          const nowJalaali = jalaali.toJalaali(now);
          startYear = nowJalaali.jy;
          startMonth = nowJalaali.jm;
          startDay = nowJalaali.jd;
        }

        for (let i = 0; i < policy.installment_count; i++) {
          const monthsToAdd = policy.installment_type === 'پیش پرداخت' ? i : i + 1;
          const dueDateJalaali = addJalaaliMonth({ y: startYear, m: startMonth, d: startDay }, monthsToAdd);
          const due_date = `${dueDateJalaali.y}/${String(dueDateJalaali.m).padStart(2, "0")}/${String(dueDateJalaali.d).padStart(2, "0")}`;

          // Convert Jalaali to Gregorian for status check
          const gregorian = jalaali.toGregorian(dueDateJalaali.y, dueDateJalaali.m, dueDateJalaali.d);
          const dueDateGregorian = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
          let status = 'آینده';
          if (dueDateGregorian < now) {
            status = 'معوق';
          }

          let amount;
          if (policy.installment_type === 'پیش پرداخت' && i === 0 && policy.first_installment_amount) {
            amount = policy.first_installment_amount;
          } else {
            amount = baseAmount + (i === policy.installment_count - 1 ? remainder : 0);
          }

          allInstallments.push({
            id: `${policy.id}-${i + 1}`,
            customerName: policy.customer ? policy.customer.full_name : 'Unknown',
            customerNationalCode: policy.customer ? policy.customer.national_code : '',
            policyType: policy.insurance_type,
            amount: amount.toString(),
            dueDate: due_date, // Jalaali format
            status,
            policyId: policy.id,
            installmentNumber: i + 1,
          });
        }
      }
    }
    return allInstallments;
  }

  async existsByPolicyNumber(policyNumber) {
    const policyRepository = dataSource.getRepository(Policy);
    const count = await policyRepository.count({ where: { policy_number: policyNumber } });
    return count > 0;
  }
}

export default new PoliciesService();