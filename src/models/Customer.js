import { EntitySchema } from 'typeorm';

const Customer = new EntitySchema({
  name: 'Customer',
  tableName: 'customers',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    full_name: {
      type: 'varchar',
      length: 255,
    },
    national_code: {
      type: 'varchar',
      length: 20,
      unique: true,
    },
    insurance_code: {
      type: 'varchar',
      length: 50,
    },
    phone: {
      type: 'varchar',
      length: 20,
    },
    birth_date: {
      type: 'varchar',
      length: 20,
      nullable: true,
    },
    score: {
      type: 'enum',
      enum: ['A', 'B', 'C', 'D'],
    },
    role: {
      type: 'enum',
      enum: ['customer', 'admin'],
      default: 'customer',
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
});

export default Customer;