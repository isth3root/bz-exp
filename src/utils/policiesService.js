import { Between } from 'typeorm';
import dataSource from '../config/database.js';
import Policy from '../models/Policy.js';
import Customer from '../models/Customer.js';
import Installment from '../models/Installment.js';
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
      // Normalize numbers
      const totalPremium = Number(policyWithRelations.premium);
      const installmentCount = Number(policy.installment_count);
      const isPre = policy.installment_type === 'پیش پرداخت' && policy.first_installment_amount;
      const firstAmount = isPre ? Number(policy.first_installment_amount) : 0;

      // Edge: if only 1 installment and it's prepayment, handle separately
      if (isPre && installmentCount === 1) {
        // Only one installment which is the prepayment
        // due date = month after start_date
        let [sy, sm, sd] = policyWithRelations.start_date.split("/").map(Number);
        if (!sy || !sm || !sd) throw new Error("Invalid start_date format");
        if (sy < 1300) sy += 620;

        const monthsToAdd = 1;
        const { y, m, d } = addJalaaliMonth({ y: sy, m: sm, d: sd }, monthsToAdd);
        const due_date = `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;

        const now = new Date();
        const nowJalaali = jalaali.toJalaali(now);
        let statusItem = "آینده";
        if (y < nowJalaali.jy || (y === nowJalaali.jy && m < nowJalaali.jm) || (y === nowJalaali.jy && m === nowJalaali.jm && d < nowJalaali.jd)) {
          statusItem = "معوق";
        }

        await installmentsService.create({
          customer_id: policyWithRelations.customer.id,
          policy_id: policyWithRelations.id,
          installment_number: 1,
          amount: firstAmount,
          due_date,
          status: statusItem,
          pay_link: policyWithRelations.payment_link,
        });

      } else {
        // Compute division for remaining installments
        let remainingTotal, remainingCount;
        if (isPre) {
          remainingTotal = totalPremium - firstAmount;
          remainingCount = installmentCount - 1;
        } else {
          remainingTotal = totalPremium;
          remainingCount = installmentCount;
        }

        if (remainingCount <= 0) {
          // Nothing to create (shouldn't normally happen unless bad data)
          return policyWithRelations;
        }

        const baseAmount = Math.floor(remainingTotal / remainingCount);
        const remainder = remainingTotal % remainingCount;

        // parse start date
        let [sy, sm, sd] = policyWithRelations.start_date.split("/").map(Number);
        if (!sy || !sm || !sd) throw new Error("Invalid start_date format");
        if (sy < 1300) sy += 620;

        // If prepayment: create first installment (installment_number = 1) with due_date = month after start_date
        if (isPre) {
          const monthsToAdd = 0;
          const { y, m, d } = addJalaaliMonth({ y: sy, m: sm, d: sd }, monthsToAdd);
          const due_date = `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;

          const now = new Date();
          const nowJalaali = jalaali.toJalaali(now);
          let statusItem = "آینده";
          if (y < nowJalaali.jy || (y === nowJalaali.jy && m < nowJalaali.jm) || (y === nowJalaali.jy && m === nowJalaali.jm && d < nowJalaali.jd)) {
            statusItem = "معوق";
          }

          await installmentsService.create({
            customer_id: policyWithRelations.customer.id,
            policy_id: policyWithRelations.id,
            installment_number: 1,
            amount: firstAmount,
            due_date,
            status: statusItem,
            pay_link: policyWithRelations.payment_link,
          });
        }

        // Create remaining installments
        // remaining installments should be numbered  (isPre ? 2 : 1) ... installmentCount
        const startNumber = isPre ? 2 : 1;
        for (let k = 0; k < remainingCount; k++) {
          const installmentNumber = startNumber + k;
          let monthsToAdd;
          if (isPre) {
            monthsToAdd = installmentNumber - 1;
          } else {
            monthsToAdd = installmentNumber;
          }
          const { y, m, d } = addJalaaliMonth({ y: sy, m: sm, d: sd }, monthsToAdd);
          const due_date = `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;

          const now = new Date();
          const nowJalaali = jalaali.toJalaali(now);
          let statusItem = "آینده";
          if (y < nowJalaali.jy || (y === nowJalaali.jy && m < nowJalaali.jm) || (y === nowJalaali.jy && m === nowJalaali.jm && d < nowJalaali.jd)) {
            statusItem = "معوق";
          }

          // amount: base + remainder on the last of remaining installments
          const amount = baseAmount + (k === remainingCount - 1 ? remainder : 0);

          await installmentsService.create({
            customer_id: policyWithRelations.customer.id,
            policy_id: policyWithRelations.id,
            installment_number: installmentNumber,
            amount,
            due_date,
            status: statusItem,
            pay_link: policyWithRelations.payment_link,
          });
        }
      }
    }

    return policyWithRelations;
  }


  async update(id, policy) {
    const policyRepository = dataSource.getRepository(Policy);

    const oldPolicy = await this.findOne(id);
    if (!oldPolicy) return null;

    // Check if fields that affect installments have changed
    const premiumChanged = policy.premium !== undefined && Number(policy.premium) !== Number(oldPolicy.premium);
    const countChanged = policy.installment_count !== undefined && Number(policy.installment_count) !== Number(oldPolicy.installment_count);
    const typeChanged = policy.installment_type !== undefined && policy.installment_type !== oldPolicy.installment_type;
    const firstAmountChanged = policy.first_installment_amount !== undefined && Number(policy.first_installment_amount || 0) !== Number(oldPolicy.first_installment_amount || 0);

    const needsRecalculation = premiumChanged || countChanged || typeChanged || firstAmountChanged;

    await policyRepository.update(id, policy);
    const updatedPolicy = await this.findOne(id);

    if (needsRecalculation && updatedPolicy.payment_type === 'اقساطی' && updatedPolicy.installment_count > 0 && updatedPolicy.premium) {
      await this.recalculateInstallments(updatedPolicy);
    }

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

    async recalculateInstallments(policy) {
    const installmentRepository = dataSource.getRepository(Installment);

    // Get existing installments for this policy
    const existingInstallments = await installmentRepository.find({
      where: { policy_id: policy.id },
      order: { installment_number: 'ASC' }
    });

    // Separate paid and unpaid installments
    const paidInstallments = existingInstallments.filter(inst => inst.status === 'پرداخت شده');
    const unpaidInstallments = existingInstallments.filter(inst => inst.status !== 'پرداخت شده');

    // Calculate total paid amount
    const totalPaid = paidInstallments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0);

    // Calculate remaining premium after paid installments
    const remainingPremium = Math.max(0, parseFloat(policy.premium) - totalPaid);

    // If no remaining premium, don't create new installments
    if (remainingPremium <= 0) {
      // Delete all existing unpaid installments
      for (const inst of unpaidInstallments) {
        await installmentRepository.delete(inst.id);
      }
      return;
    }

    // Check if first installment is paid
    const firstInstallmentPaid = paidInstallments.some(inst => inst.installment_number === 1);

    // Calculate new installment amounts
    let baseAmount, remainder, total, count;
    if (policy.installment_type === 'پیش پرداخت' && policy.first_installment_amount && !firstInstallmentPaid) {
      // For پیش پرداخت, the first installment is fixed, remaining is divided
      const firstAmount = parseFloat(policy.first_installment_amount);
      total = remainingPremium - firstAmount;
      count = policy.installment_count - 1;
    } else {
      // For تمام قسط or when first installment is already paid
      total = remainingPremium;
      count = policy.installment_count - paidInstallments.length;
    }

    if (count <= 0) {
      baseAmount = 0;
      remainder = 0;
    } else {
      baseAmount = Math.floor(total / count);
      remainder = total % count;
    }

    // Delete all existing unpaid installments
    for (const inst of unpaidInstallments) {
      await installmentRepository.delete(inst.id);
    }

    // Recreate installments starting from the next number after paid ones
    const startInstallmentNumber = paidInstallments.length + 1;
    const numInstallmentsToCreate = count;

    if (numInstallmentsToCreate <= 0) return;

    let [sy, sm, sd] = policy.start_date.split("/").map(Number);
    if (!sy || !sm || !sd) throw new Error("Invalid start_date format")
    if (sy < 1300) sy += 620;

    for (let i = 0; i < numInstallmentsToCreate; i++) {
      const installmentNumber = startInstallmentNumber + i;
      // monthsToAdd: installmentNumber months after start_date (so installment 1 => +1 month)
      const monthsToAdd = installmentNumber;
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

      // Calculate amount
      let amount;
      // If prepayment and this is installment 1 (and first not paid), set first amount
      if (policy.installment_type === 'پیش پرداخت' && installmentNumber === 1 && policy.first_installment_amount && !firstInstallmentPaid) {
        amount = Number(policy.first_installment_amount);
      } else {
        // i indexes newly created installments (0..numInstallmentsToCreate-1)
        // but remainder should be applied to the last of the created ones:
        const indexAmongCreated = i;
        amount = baseAmount + (indexAmongCreated === numInstallmentsToCreate - 1 ? remainder : 0);
      }

      await installmentsService.create({
        customer_id: policy.customer.id,
        policy_id: policy.id,
        installment_number: installmentNumber,
        amount,
        due_date,
        status,
        pay_link: policy.payment_link,
      });
    }
  }


  async existsByPolicyNumber(policyNumber) {
    const policyRepository = dataSource.getRepository(Policy);
    const count = await policyRepository.count({ where: { policy_number: policyNumber } });
    return count > 0;
  }
}

export default new PoliciesService();