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
    return policyRepository.find({ where: { customer_national_code: nationalCode }, relations: ['customer'] });
  }

  async create(policy) {
    const policyRepository = dataSource.getRepository(Policy);

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
      const installmentAmount = policyWithRelations.premium / policy.installment_count;
      let [sy, sm, sd] = policyWithRelations.start_date.split("/").map(Number);
      if (!sy || !sm || !sd) throw new Error("Invalid start_date format")
      if (sy < 1300) sy += 620;

      for (let i = 0; i < policy.installment_count; i++) {
        let { y, m, d } = addJalaaliMonth({ y: sy, m: sm, d: sd }, i);

        // due_date as Jalaali string
        let due_date = `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;

        // Calculate status based on current date
        const now = new Date();
        const nowJalaali = jalaali.toJalaali(now);
        let status = "آینده";
        if (y < nowJalaali.jy || (y === nowJalaali.jy && m < nowJalaali.jm) || (y === nowJalaali.jy && m === nowJalaali.jm && d < nowJalaali.jd)) {
          status = "معوق";
        }

        await installmentsService.create({
          customer_id: policyWithRelations.customer.id,
          policy_id: policyWithRelations.id,
          installment_number: i + 1,
          amount: installmentAmount,
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
        const installmentAmount = policy.premium / policy.installment_count;
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
          const dueDateJalaali = addJalaaliMonth({ y: startYear, m: startMonth, d: startDay }, i); // First installment at start date
          const due_date = `${dueDateJalaali.y}/${String(dueDateJalaali.m).padStart(2, "0")}/${String(dueDateJalaali.d).padStart(2, "0")}`;

          // Convert Jalaali to Gregorian for status check
          const gregorian = jalaali.toGregorian(dueDateJalaali.y, dueDateJalaali.m, dueDateJalaali.d);
          const dueDateGregorian = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
          let status = 'آینده';
          if (dueDateGregorian < now) {
            status = 'معوق';
          }
          allInstallments.push({
            id: `${policy.id}-${i + 1}`,
            customerName: policy.customer ? policy.customer.full_name : 'Unknown',
            customerNationalCode: policy.customer ? policy.customer.national_code : '',
            policyType: policy.insurance_type,
            amount: installmentAmount.toString(),
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
}

export default new PoliciesService();