import 'dotenv/config';
import 'reflect-metadata';
import app from './app.js';
import dataSource from './src/config/database.js';

async function startServer() {
  try {
    await dataSource.initialize();
    console.log('Database connected');
  } catch (error) {
    console.error('Database connection failed', error);
  }

  const port = process.env.PORT;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();