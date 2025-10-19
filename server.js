import 'dotenv/config';
import 'reflect-metadata';
import app from './app.js';
import dataSource from './src/config/database.js';
import { WebSocketServer } from 'ws';
import http from 'http';

async function startServer() {
  try {
    await dataSource.initialize();
    console.log('Database connected');
  } catch (error) {
    console.error('Database connection failed', error);
  }

  const port = process.env.PORT;

  // Create HTTP server
  const server = http.createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ server });

  // Store connected clients
  const clients = new Set();

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    clients.add(ws);

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Make WebSocket server available globally for broadcasting
  global.wss = wss;
  global.wsClients = clients;

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();