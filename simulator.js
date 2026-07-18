const mqtt = require('mqtt');

const MQTT_BROKER = 'mqtt://broker.hivemq.com';
const TOPIC = 'factory/boiler/data';
const CLIENT_ID = 'twin-boiler-simulator-' + Math.random().toString(16).substring(2, 10);

console.log(`Connecting simulator to MQTT broker at ${MQTT_BROKER}...`);
const client = mqtt.connect(MQTT_BROKER, { clientId: CLIENT_ID });

// Initial conditions
let temp = 100.0; // Start at 100°C
let pressure = 3.5; // Start at 3.5 bar

client.on('connect', () => {
  console.log(`Simulator connected successfully with Client ID: ${CLIENT_ID}`);
  console.log(`Starting telemetry simulation loop (every 500ms) on topic "${TOPIC}"...`);
  
  setInterval(() => {
    // Temperature: fluctuating between 80°C and 140°C
    // Use a random walk with slight attraction to center (110°C) to keep it fluctuating nicely
    const tempDrift = (110.0 - temp) * 0.05; // pull towards center
    const tempChange = (Math.random() - 0.5) * 8 + tempDrift; // step size up to 4C + drift
    temp = Math.min(Math.max(temp + tempChange, 80.0), 140.0);
    
    // Pressure: fluctuating between 2.0 and 6.0 bar
    // Pressure should correlate loosely with temperature (ideal gas law representation)
    const basePressure = 2.0 + ((temp - 80.0) / 60.0) * 3.5; // 2.0 at 80C, 5.5 at 140C
    const pressureNoise = (Math.random() - 0.5) * 0.6;
    pressure = Math.min(Math.max(basePressure + pressureNoise, 2.0), 6.0);

    const payload = {
      deviceId: 'boiler-twin-01',
      temperature: parseFloat(temp.toFixed(2)),
      pressure: parseFloat(pressure.toFixed(2)),
      status: temp > 120.0 ? 'CRITICAL' : (temp > 110.0 ? 'WARNING' : 'NORMAL'),
      timestamp: new Date().toISOString()
    };

    client.publish(TOPIC, JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) {
        console.error('Publish error:', err);
      } else {
        console.log(`[Simulator] Published telemetry -> Temp: ${payload.temperature}°C, Pressure: ${payload.pressure} bar, Status: ${payload.status}`);
      }
    });
  }, 500);
});

client.on('error', (err) => {
  console.error('Simulator MQTT Error:', err);
});
