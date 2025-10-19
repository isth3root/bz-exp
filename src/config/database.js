import 'reflect-metadata';
import { DataSource } from 'typeorm';
import Blog from '../models/Blog.js';
import Customer from '../models/Customer.js';
import Policy from '../models/Policy.js';
import Installment from '../models/Installment.js';
import ServerStatus from '../models/ServerStatus.js';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [Blog, Customer, Policy, Installment, ServerStatus],
  synchronize: true,
});

export default dataSource;