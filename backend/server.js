const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Simple API status route
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    mqttBroker: 'broker.hivemq.com',
    topic: 'factory/boiler/data',
    connections: io.engine.clientsCount
  });
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
