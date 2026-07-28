const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Database Initialization
let db;
(async () => {
  try {
    db = await open({
      filename: './telemetry.db',
      driver: sqlite3.Database
    });
    await db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        temperature REAL,
        pressure REAL,
        status TEXT,
        timestamp TEXT
      )
    `);
    console.log('Connected to SQLite database and ensured telemetry table exists.');
  } catch (err) {
    console.error('Failed to initialize SQLite database:', err);
  }
})();

// Simple API status route
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    mqttBroker: 'broker.hivemq.com',
    topic: 'factory/boiler/data',
    connections: io.engine.clientsCount
  });
});

// History API Endpoint
app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    if (!db) {
      return res.status(503).json({ error: 'Database not initialized yet.' });
    }
    const data = await db.all('SELECT * FROM telemetry ORDER BY id DESC LIMIT ?', [limit]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MQTT Configuration
const MQTT_BROKER = 'mqtt://broker.hivemq.com';
const MQTT_TOPIC = 'factory/boiler/data';

console.log(`Connecting to MQTT broker at ${MQTT_BROKER}...`);
const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
  console.log('Connected to MQTT Broker successfully.');
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error(`Subscribing to ${MQTT_TOPIC} failed:`, err);
    } else {
      console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
    }
  });
});

mqttClient.on('message', (topic, message) => {
  let parsedPayload = null;
  const rawString = message.toString();

  try {
    parsedPayload = JSON.parse(rawString);
  } catch (e) {
    // If not JSON, create a structured object with raw data
    parsedPayload = {
      raw: rawString,
      timestamp: new Date().toISOString()
    };
  }

  // Inject server timestamp if not present
  if (!parsedPayload.timestamp) {
    parsedPayload.timestamp = new Date().toISOString();
  }

  // Save to database
  if (db && parsedPayload.deviceId) {
    db.run(
      'INSERT INTO telemetry (device_id, temperature, pressure, status, timestamp) VALUES (?, ?, ?, ?, ?)',
      [
        parsedPayload.deviceId,
        parsedPayload.temperature,
        parsedPayload.pressure,
        parsedPayload.status,
        parsedPayload.timestamp
      ]
    ).catch(err => console.error('Database Insert Error:', err));
  }

  // Stream data to all connected Socket.io clients
  io.emit('telemetry', parsedPayload);
});

mqttClient.on('error', (err) => {
  console.error('MQTT Client Connection Error:', err);
});

mqttClient.on('close', () => {
  console.log('MQTT Client Connection closed.');
});

// WebSocket Connection Management
io.on('connection', (socket) => {
  console.log(`Frontend client connected: ${socket.id}`);
  
  // Send current status immediately
  socket.emit('status_change', { status: 'connected', time: new Date().toISOString() });

  socket.on('disconnect', () => {
    console.log(`Frontend client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Industrial Digital Twin backend server listening on http://localhost:${PORT}`);
});
