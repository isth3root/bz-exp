import { EntitySchema } from 'typeorm';

const ServerStatus = new EntitySchema({
  name: 'ServerStatus',
  tableName: 'server_status',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    status: {
      type: 'varchar',
      length: 50,
    },
    responseTime: {
      type: 'int',
    },
    timestamp: {
      type: 'datetime',
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

export default ServerStatus;