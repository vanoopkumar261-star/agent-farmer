// FRIDAY sensor kit — ESP32 gateway firmware (BLE version).
//
// The Arduino UNO reads the three sensors and sends them to this ESP32 over
// UART2 as a CSV line "temperature,humidity,soil\n". This sketch parses that
// line (UNCHANGED from the WiFi version) and, instead of uploading to
// ThingSpeak over WiFi, advertises the reading over Bluetooth Low Energy so the
// farmer's phone (the Agent Farmer app) can read it directly — no WiFi, no cloud.
//
// BLE contract (the mobile app must match these):
//   device name : FRIDAY-Sensor
//   service     : f1a70001-5b3c-4b7e-9d2a-9a6f6d0c1a01
//   reading char: f1a70002-5b3c-4b7e-9d2a-9a6f6d0c1a01  (READ + NOTIFY)
//                 value = JSON {"temp_c":34.1,"humidity":40.0,"moisture":22.0}
//
// Build note: the BLE stack is large. In Arduino IDE pick a partition scheme
// with enough app space (Tools -> Partition Scheme -> "Huge APP" or
// "Minimal SPIFFS") if the sketch is too big to upload. NimBLE-Arduino is a
// lighter alternative if flash is tight.

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// =================================
// BLE identifiers  (must match the mobile app)
// =================================
#define DEVICE_NAME        "FRIDAY-Sensor"
#define SERVICE_UUID       "f1a70001-5b3c-4b7e-9d2a-9a6f6d0c1a01"
#define READINGS_CHAR_UUID "f1a70002-5b3c-4b7e-9d2a-9a6f6d0c1a01"

// =================================
// ESP32 UART2  (data comes from the Arduino UNO sensor board)
// =================================
#define RXD2 16
#define TXD2 17

// =================================
// Sensor variables
// =================================
float temperature = 0;
float humidity = 0;
float soilMoisture = 0;

String receivedData = "";

// =================================
// BLE state
// =================================
BLECharacteristic* readingsChar = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Re-send the latest values on a timer too, as a heartbeat.
unsigned long lastNotifyTime = 0;
const unsigned long notifyInterval = 15000;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s) override    { deviceConnected = true; }
  void onDisconnect(BLEServer* s) override { deviceConnected = false; }
};

// Same field names the mobile app and the friday box expect.
String buildJson() {
  String j = "{";
  j += "\"temp_c\":"   + String(temperature, 1)  + ",";
  j += "\"humidity\":" + String(humidity, 1)     + ",";
  j += "\"moisture\":" + String(soilMoisture, 1);
  j += "}";
  return j;
}

void publishReading() {
  if (readingsChar == nullptr) return;
  String json = buildJson();
  readingsChar->setValue(json.c_str());   // readable on demand
  if (deviceConnected) {
    readingsChar->notify();                // push to the phone
    Serial.print("Notified: ");
    Serial.println(json);
  }
}

// =================================
// Setup
// =================================
void setup() {
  Serial.begin(115200);

  // UNO -> ESP32  (unchanged)
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);

  Serial.println();
  Serial.println("==============================");
  Serial.println("FRIDAY Sensor - BLE");
  Serial.println("==============================");

  // ---- BLE server ----
  BLEDevice::init(DEVICE_NAME);
  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService* service = server->createService(SERVICE_UUID);
  readingsChar = service->createCharacteristic(
    READINGS_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  readingsChar->addDescriptor(new BLE2902());   // lets the client subscribe
  readingsChar->setValue("{}");
  service->start(); 

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);
  adv->setMaxPreferred(0x12);

  BLEDevice::startAdvertising();

  Serial.println("BLE advertising as " DEVICE_NAME);
  Serial.println("Waiting for UNO data...");
}

// =================================
// Main loop
// =================================
void loop() {

  // ---- Receive CSV from the UNO: "temperature,humidity,soil\n"  (unchanged) ----
  while (Serial2.available()) {
    char c = Serial2.read();

    if (c == '\n') {
      receivedData.trim();

      if (receivedData.length() > 0) {
        Serial.print("Received from UNO: ");
        Serial.println(receivedData);

        int comma1 = receivedData.indexOf(',');
        int comma2 = receivedData.indexOf(',', comma1 + 1);

        if (comma1 > 0 && comma2 > comma1) {
          temperature  = receivedData.substring(0, comma1).toFloat();
          humidity     = receivedData.substring(comma1 + 1, comma2).toFloat();
          soilMoisture = receivedData.substring(comma2 + 1).toFloat();

          Serial.println("-------------------------");
          Serial.print("Temperature: ");  Serial.print(temperature);  Serial.println(" C");
          Serial.print("Humidity: ");     Serial.print(humidity);     Serial.println(" %");
          Serial.print("Soil Moisture: ");Serial.print(soilMoisture); Serial.println(" %");
          Serial.println("-------------------------");

          // Fresh reading -> push it to the phone immediately.
          publishReading();
          lastNotifyTime = millis();
        }
      }
      receivedData = "";
    }
    else {
      receivedData += c;
    }
  }

  // ---- Heartbeat: re-send the latest values every 15 s ----
  if (millis() - lastNotifyTime >= notifyInterval) {
    if (temperature != 0 || humidity != 0 || soilMoisture != 0) {
      publishReading();
    }
    lastNotifyTime = millis();
  }

  // ---- Keep advertising after a client disconnects, so the phone can reconnect ----
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    BLEDevice::startAdvertising();
    Serial.println("Client disconnected; advertising again.");
    oldDeviceConnected = false;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = true;
    Serial.println("Client connected.");
  }
}
