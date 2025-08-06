#include <Arduino.h>
#include <Notecard.h>
#include <Wire.h>
#include <Adafruit_BME280.h>

// Project configuration
#define PRODUCT_UID "com.blues.tvantoll:temptrack"
#define ALERT_NOTEFILE "alert.qo"

// STLINK serial for debug output
#define SERIAL_BAUD 115200
HardwareSerial serial_debug(PIN_VCP_RX, PIN_VCP_TX);

const int DEFAULT_TEMP_MIN = 0;
const int DEFAULT_TEMP_MAX = 100;

// Uncomment the following line to disable all logging output
// #define RELEASE

Notecard notecard;
Adafruit_BME280 bme;
bool bmeInitialized = false;

bool initializeBME280() {
  if (bme.begin(0x76) || bme.begin(0x77)) {
#ifndef RELEASE
    serial_debug.println(F("BME280 sensor initialized successfully"));
#endif
    return true;
  } else {
#ifndef RELEASE
    serial_debug.println(F("Could not find BME280 sensor"));
#endif
    return false;
  }
}

int getEnvVarIntValue(char *varName, int defaultValue) {
  J *envReq = notecard.newRequest("env.get");
  if (envReq != NULL) {
    JAddStringToObject(envReq, "name", varName);
    J *envRsp = notecard.requestAndResponse(envReq);
    if (envRsp != NULL) {
      if (JHasObjectItem(envRsp, "text")) {
        const char* intervalStr = JGetString(envRsp, "text");
        if (intervalStr != NULL) {
          int intervalMins = (int)atoi(intervalStr);
#ifndef RELEASE
          serial_debug.print(F("\nFound environment variable: "));
          serial_debug.print(varName);
          serial_debug.print(F(" with value: "));
          serial_debug.println(intervalMins);
#endif
          return intervalMins;
        }
      }
    
      notecard.deleteResponse(envRsp);
    }
  }
  return defaultValue;
}

void setup() {
  // Initialize STLINK serial communication with timeout
#ifndef RELEASE
  serial_debug.begin(SERIAL_BAUD);
  const size_t usb_timeout_ms = 3000;
  for (const size_t start_ms = millis(); !serial_debug && (millis() - start_ms) < usb_timeout_ms;);
  serial_debug.println(F("TempTrack startup"));
  serial_debug.println(F("Initializing Notecard..."));
#endif

  notecard.begin();

#ifndef RELEASE
  notecard.setDebugOutputStream(serial_debug);
#endif

  J *motionReq = notecard.newRequest("card.motion.mode");
  if (motionReq != NULL) {
    JAddBoolToObject(motionReq, "start", true);
    JAddNumberToObject(motionReq, "seconds", 60);
    JAddNumberToObject(motionReq, "motion", 10);
    notecard.sendRequest(motionReq);
  }
}

void loop() {
  if (!bmeInitialized) {
    bmeInitialized = initializeBME280();
    if (!bmeInitialized) {
#ifndef RELEASE
      serial_debug.println(F("BME280 initialization failed, skipping temperature check"));
#endif
      delay(30000);
      return;
    }
  }

  J *motionReq = notecard.newRequest("card.motion");
  bool isMoving = false;
  if (motionReq != NULL) {
    J *motionRsp = notecard.requestAndResponse(motionReq);
    if (motionRsp != NULL) {
      const char *mode = JGetString(motionRsp, "mode");
#ifndef RELEASE
      serial_debug.print(F("Motion status: "));
      serial_debug.println(mode);
#endif

      isMoving = (strcmp(mode, "moving") == 0);
      notecard.deleteResponse(motionRsp);
    }
  }

  if (!isMoving) {
#ifndef RELEASE
    serial_debug.println(F("Device not moving, skipping temperature check"));
#endif
    delay(30000);
    return;
  }

  float temperature = bme.readTemperature();
  int temp_min = getEnvVarIntValue((char*)"temp_min", DEFAULT_TEMP_MIN);
  int temp_max = getEnvVarIntValue((char*)"temp_max", DEFAULT_TEMP_MAX);

#ifndef RELEASE
  serial_debug.print(F("\nTemperature: "));
  serial_debug.print(temperature);
  serial_debug.print(F("C"));
  serial_debug.print(F("\nTemperature monitoring range: "));
  serial_debug.print(temp_min);
  serial_debug.print(F("C to "));
  serial_debug.print(temp_max);
  serial_debug.print(F("C"));
#endif

  if (temperature > temp_max || temperature < temp_min) {
#ifndef RELEASE
    serial_debug.println(F("\nTemperature threshold exceeded! Sending alert..."));
#endif

    J *req = notecard.newRequest("note.add");
    if (req != NULL) {
      JAddStringToObject(req, "file", ALERT_NOTEFILE);
      JAddBoolToObject(req, "sync", true);

      J *body = JCreateObject();
      if (body != NULL) {
        JAddNumberToObject(body, "temp", temperature);
        JAddNumberToObject(body, "temp_min", temp_min);
        JAddNumberToObject(body, "temp_max", temp_max);
        JAddItemToObject(req, "body", body);
      }

      notecard.sendRequest(req);
    }
  }

  // TODO: this should be an env var?
  delay(300000); // 5 minutes
}