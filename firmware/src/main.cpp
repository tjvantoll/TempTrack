#include <Arduino.h>
#include <Notecard.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include "version.h"

// Project configuration
#define ALERT_NOTEFILE "alert.qo"
#define TEMP_MIN_ENV_VAR "alert_temp_min_c"
#define TEMP_MAX_ENV_VAR "alert_temp_max_c"
#define ALERT_RECHECK_ENV_VAR "alert_recheck_interval_min"
#define CARD_MOTION_MOTION_ENV_VAR "card_motion_motion"
#define CARD_MOTION_SECONDS_ENV_VAR "card_motion_seconds"

// STLINK serial for debug output
#define SERIAL_BAUD 115200
HardwareSerial serialDebug(PIN_VCP_RX, PIN_VCP_TX);

#define DEFAULT_TEMP_MIN -999
#define DEFAULT_TEMP_MAX 999
#define DEFAULT_ALERT_RECHECK_INTERVAL_MIN 10
#define DEFAULT_CARD_MOTION_MOTION 10
#define DEFAULT_CARD_MOTION_SECONDS 60

#define SENSOR_ERROR_RETRY_INTERVAL_MS (5 * 1000) // 5 seconds

// Uncomment the following line to disable all logging output
// #define RELEASE

Notecard notecard;
Adafruit_BME280 bme;

bool initializeBME280() {
  if (bme.begin(0x76) || bme.begin(0x77)) {
#ifndef RELEASE
    serialDebug.println(F("BME280 sensor initialized successfully"));
#endif
    return true;
  } else {
#ifndef RELEASE
    serialDebug.println(F("Could not find BME280 sensor"));
#endif
    return false;
  }
}

int getEnvVarIntValue(char *varName, int defaultValue) {
  int result = defaultValue;
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
          serialDebug.print(F("\nFound environment variable: "));
          serialDebug.print(varName);
          serialDebug.print(F(" with value: "));
          serialDebug.println(intervalMins);
#endif
          result = intervalMins;
        }
      }
    
      notecard.deleteResponse(envRsp);
    }
  }
  return result;
}

void setup() {
#ifndef RELEASE
  // Turn on the Swan’s LED for debugging
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);

  // Initialize STLINK serial communication with timeout
  serialDebug.begin(SERIAL_BAUD);
  const size_t usb_timeout_ms = 3000;
  for (const size_t start_ms = millis(); !serialDebug && (millis() - start_ms) < usb_timeout_ms;);
  serialDebug.println(F("TempTrack startup"));
  serialDebug.println(F("Initializing Notecard..."));
#endif

  notecard.begin();

#ifndef RELEASE
  notecard.setDebugOutputStream(serialDebug);
#endif

  J *dfuReq = notecard.newRequest("dfu.status");
  if (dfuReq != NULL) {
    JAddStringToObject(dfuReq, "version", firmwareVersion());
    notecard.sendRequest(dfuReq);
  }

  int seconds = getEnvVarIntValue((char*)CARD_MOTION_SECONDS_ENV_VAR, DEFAULT_CARD_MOTION_SECONDS);
  int motion = getEnvVarIntValue((char*)CARD_MOTION_MOTION_ENV_VAR, DEFAULT_CARD_MOTION_MOTION);
  J *motionReq = notecard.newRequest("card.motion.mode");
  if (motionReq != NULL) {
    JAddBoolToObject(motionReq, "start", true);
    JAddNumberToObject(motionReq, "seconds", seconds);
    JAddNumberToObject(motionReq, "motion", motion);
    notecard.sendRequest(motionReq);
  }

#ifndef RELEASE
  serialDebug.println(F("Initializing BME280 sensor..."));
#endif

  bool bmeInitialized = false;
  while (!bmeInitialized) {
    bmeInitialized = initializeBME280();
    if (!bmeInitialized) {
#ifndef RELEASE
      serialDebug.println(F("BME280 initialization failed, retrying..."));
#endif
      delay(SENSOR_ERROR_RETRY_INTERVAL_MS);
    }
  }

#ifndef RELEASE
  serialDebug.println(F("BME280 initialized successfully"));
#endif
}

void loop() {
  J *motionReq = notecard.newRequest("card.motion");
  bool isMoving = false;
  if (motionReq != NULL) {
    J *motionRsp = notecard.requestAndResponse(motionReq);
    if (motionRsp != NULL) {
      const char *mode = JGetString(motionRsp, "mode");
#ifndef RELEASE
      serialDebug.print(F("Motion status: "));
      serialDebug.println(mode);
#endif

      isMoving = (mode && strcmp(mode, "moving") == 0);
      notecard.deleteResponse(motionRsp);
    }
  }

  if (!isMoving) {
#ifndef RELEASE
    serialDebug.println(F("Device not moving, skipping temperature check, sleeping..."));
#endif
    J *attnReq = notecard.newCommand("card.attn");
    if (attnReq != NULL) {
      JAddStringToObject(attnReq, "mode", "arm,motionchange,sleep");
      JAddNumberToObject(attnReq, "seconds", 60 * 60 * 24); // 24 hours
      notecard.sendRequest(attnReq);
    }

    // We shouldn’t never get here, but just in case
    return;
  }

  float temperature = bme.readTemperature();
  int temp_min = getEnvVarIntValue((char*)TEMP_MIN_ENV_VAR, DEFAULT_TEMP_MIN);
  int temp_max = getEnvVarIntValue((char*)TEMP_MAX_ENV_VAR, DEFAULT_TEMP_MAX);

#ifndef RELEASE
  serialDebug.print(F("\nTemperature: "));
  serialDebug.print(temperature);
  serialDebug.print(F("C"));
  serialDebug.print(F("\nTemperature monitoring range: "));
  serialDebug.print(temp_min);
  serialDebug.print(F("C to "));
  serialDebug.print(temp_max);
  serialDebug.print(F("C"));
#endif

  if (temperature > temp_max || temperature < temp_min) {
#ifndef RELEASE
    serialDebug.println(F("\nTemperature threshold exceeded! Sending alert..."));
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

    int alertRecheckInterval = getEnvVarIntValue((char*)ALERT_RECHECK_ENV_VAR, DEFAULT_ALERT_RECHECK_INTERVAL_MIN);

  #ifndef RELEASE
    serialDebug.println(F("Alert sent. Rechecking in "));
    serialDebug.print(alertRecheckInterval);
    serialDebug.print(F(" minutes."));
  #endif

    // In this condition we sleep for the specified interval and do _not_ wake
    // on motion, as there’s no need to check the temperature until the interval
    // has passed. Notecard will still track in the meantime.
    J *attnReq = notecard.newCommand("card.attn");
    if (attnReq != NULL) {
      JAddStringToObject(attnReq, "mode", "sleep");
      JAddNumberToObject(attnReq, "seconds", alertRecheckInterval * 60);
      notecard.sendRequest(attnReq);
    }
  }

  // Temperature in range. Wait one minute before checking again.
  delay(60000);
}
