/*
  Real-Time Digital Twin - ESP32 Hardware Simulator for Wokwi
  
  This C++ sketch connects an ESP32 micro-controller to the public HiveMQ MQTT broker
  and publishes simulated Temperature and Pressure telemetry to the topic "factory/boiler/data".
  
  To run in Wokwi (https://wokwi.com/):
  1. Add an ESP32 Board.
  2. Add the "PubSubClient" library (by Nick O'Leary) and "ArduinoJson" library (by Benoit Blanchon) 
     in the Library Manager tab of Wokwi.
  3. Paste this code into diagram's main ino file.
  4. Run the simulation. It will connect to the virtual Wi-Fi "Wokwi-GUEST" and start publishing!
*/

#include <WiFi.h>
#include <PubSubClient.h> // Library for MQTT communications
#include <ArduinoJson.h>  // Library for parsing and constructing JSON

// --- WiFi Credentials ---
// Wokwi provides a virtual open access point named "Wokwi-GUEST"
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// --- MQTT Configuration ---
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* mqtt_topic = "factory/boiler/data";

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0;
const unsigned long interval = 1000; // Publish interval (1 second)

// Initial values for mock telemetry
float current_temp = 100.0;
float current_pressure = 3.5;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to WiFi network: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected successfully!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  // Loop until we're reconnected to MQTT broker
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection to broker.hivemq.com...");
    
    // Generate a random Client ID to prevent connection collisions on public broker
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    // Attempt to connect
    if (client.connect(clientId.c_str())) {
      Serial.println(" connected!");
    } else {
      Serial.print(" failed, rc=");
      Serial.print(client.state());
      Serial.println(" - Retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  
  // Set MQTT server parameters
  client.setServer(mqtt_server, mqtt_port);
  
  // Initialize random seed for telemetry generation
  randomSeed(analogRead(0));
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastMsg > interval) {
    lastMsg = now;

    // --- Mock Sensor Telemetry Simulation ---
    // Temperature: fluctuates between 80°C and 140°C
    float tempDrift = (110.0 - current_temp) * 0.05; // attract back to center
    float tempChange = (random(-40, 41) / 10.0) + tempDrift; // step between -4.0 and +4.0 plus drift
    current_temp += tempChange;
    if (current_temp < 80.0) current_temp = 80.0;
    if (current_temp > 140.0) current_temp = 140.0;

    // Pressure: fluctuates between 2.0 and 6.0 bar
    // Correlate with temperature (approximate ideal gas behavior)
    float basePressure = 2.0 + ((current_temp - 80.0) / 60.0) * 3.5;
    float pressureNoise = (random(-30, 31) / 100.0);
    current_pressure = basePressure + pressureNoise;
    if (current_pressure < 2.0) current_pressure = 2.0;
    if (current_pressure > 6.0) current_pressure = 6.0;

    // Determine status alert string
    String status = "NORMAL";
    if (current_temp > 120.0) {
      status = "CRITICAL";
    } else if (current_temp > 110.0) {
      status = "WARNING";
    }

    // --- Prepare JSON Payload ---
    // Use StaticJsonDocument to construct the structure
    StaticJsonDocument<256> doc;
    doc["deviceId"] = "esp32-boiler-twin";
    doc["temperature"] = serialized(String(current_temp, 2));
    doc["pressure"] = serialized(String(current_pressure, 2));
    doc["status"] = status;
    doc["timestamp"] = "ESP32_MOCK_TIME"; // The backend will inject real server timestamp if required

    char jsonBuffer[256];
    serializeJson(doc, jsonBuffer);

    // --- Publish to Topic ---
    Serial.print("Publishing telemetry payload: ");
    Serial.println(jsonBuffer);
    
    if (client.publish(mqtt_topic, jsonBuffer)) {
      Serial.println("MQTT Publish: Success");
    } else {
      Serial.println("MQTT Publish: FAILED");
    }
  }
}
