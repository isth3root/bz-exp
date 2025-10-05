import { EntitySchema } from 'typeorm';
import Customer from './Customer.js';

const Policy = new EntitySchema({
  name: 'Policy',
  tableName: 'policies',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    customer_national_code: {
      type: 'varchar',
      length: 20,
    },
    insurance_type: {
      type: 'enum',
      enum: ['ثالث', 'بدنه', 'آتش‌سوزی', 'حوادث', 'مسئولیت', 'زندگی'],
      nullable: false,
    },
    details: {
      type: 'text',
      nullable: true,
    },
    start_date: {
      type: 'varchar',
      length: 10,
      nullable: false,
    },
    end_date: {
      type: 'varchar',
      length: 10,
      nullable: true,
    },
    premium: {
      type: 'decimal',
      precision: 20,
      scale: 2,
      nullable: false,
    },
    payment_type: {
      type: 'enum',
      enum: ['نقدی', 'اقساطی'],
      nullable: false,
    },
    installment_count: {
      type: 'int',
      nullable: false,
    },
    installment_type: {
      type: 'enum',
      enum: ['تمام قسط', 'پیش پرداخت'],
      nullable: false,
    },
    first_installment_amount: {
      type: 'decimal',
      precision: 20,
      scale: 2,
      nullable: true,
    },
    payment_id: {
      type: 'varchar',
      length: 50,
      nullable: true,
    },
    payment_link: {
      type: 'varchar',
      length: 500,
      nullable: true,
    },
    pdf_path: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    policy_number: {
      type: 'varchar',
      length: 50,
      nullable: true,
    },
    status: {
      type: 'enum',
      enum: ['فعال', 'نزدیک انقضا', 'منقضی'],
      default: 'فعال',
    },
    created_at: {
      type: 'timestamp',
      createDate: true,
    },
    updated_at: {
      type: 'timestamp',
      updateDate: true,
    },
  },
  relations: {
   customer: {
     type: 'many-to-one',
     target: 'Customer',
     joinColumn: {
       name: 'customer_national_code',
       referencedColumnName: 'national_code',
     },
     onDelete: 'CASCADE',
   },
 },
});

export default Policy;