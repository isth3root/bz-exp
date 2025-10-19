import express from 'express';
const router = express.Router();
import dataSource from '../config/database.js';
import ServerStatus from '../models/ServerStatus.js';

// Broadcast function to send data to all connected WebSocket clients
const broadcastToClients = (data) => {
  if (global.wsClients) {
    global.wsClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(data));
      }
    });
  }
};

// POST /server-status - Store server status data
router.post('/server-status', async (req, res) => {
  try {
    const { status, responseTime, timestamp } = req.body;

    if (!status || !responseTime || !timestamp) {
      return res.status(400).json({ message: 'Missing required fields: status, responseTime, timestamp' });
    }

    const serverStatusRepository = dataSource.getRepository(ServerStatus);
    const newStatus = serverStatusRepository.create({
      status,
      responseTime: parseInt(responseTime),
      timestamp: new Date(timestamp)
    });

    await serverStatusRepository.save(newStatus);

    // Broadcast the new status to all connected WebSocket clients
    broadcastToClients({
      type: 'server_status_update',
      data: {
        id: newStatus.id,
        status: newStatus.status,
        responseTime: newStatus.responseTime,
        timestamp: newStatus.timestamp
      }
    });

    res.status(201).json({ message: 'Server status saved successfully' });
  } catch (error) {
    console.error('Error saving server status:', error);
    res.status(500).json({ message: 'Error saving server status' });
  }
});

// GET /server-status - Retrieve server status data (optional, for frontend chart)
router.get('/server-status', async (req, res) => {
  try {
    const serverStatusRepository = dataSource.getRepository(ServerStatus);
    const statuses = await serverStatusRepository.find({
      order: { timestamp: 'DESC' },
      take: 100 // Limit to last 100 entries
    });
    res.json(statuses);
  } catch (error) {
    console.error('Error fetching server status:', error);
    res.status(500).json({ message: 'Error fetching server status' });
  }
});

export default router;