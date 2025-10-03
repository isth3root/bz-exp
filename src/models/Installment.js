import { EntitySchema } from 'typeorm';
import Customer from './Customer.js';
import Policy from './Policy.js';

const Installment = new EntitySchema({
  name: 'Installment',
  tableName: 'installments',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    customer_id: {
      type: 'int',
    },
    policy_id: {
      type: 'int',
    },
    installment_number: {
      type: 'int',
    },
    amount: {
      type: 'decimal',
      precision: 10,
      scale: 2,
    },
    due_date: {
      type: 'date',
    },
    status: {
      type: 'enum',
      enum: ['معوق', 'آینده', 'پرداخت شده'],
    },
    pay_link: {
      type: 'varchar',
      length: 255,
      nullable: true,
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
       name: 'customer_id',
     },
     onDelete: 'CASCADE',
   },
   policy: {
     type: 'many-to-one',
     target: 'Policy',
     joinColumn: {
       name: 'policy_id',
     },
     onDelete: 'CASCADE',
   },
 },
});

export default Installment;