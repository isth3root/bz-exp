import { EntitySchema } from 'typeorm';

const Blog = new EntitySchema({
  name: 'Blog',
  tableName: 'blogs',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    title: {
      type: 'varchar',
      length: 255,
    },
    summary: {
      type: 'text',
    },
    content: {
      type: 'text',
    },
    category: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    image_path: {
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
});

export default Blog;