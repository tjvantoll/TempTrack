#include "config.h"

const char* const ALERT_NOTEFILE = "alert.qo";

const char *firmwareVersion() {
  return &FIRMWARE_VERSION[sizeof(FIRMWARE_VERSION_HEADER)-1];
}

void configureNotecard(Notecard &notecard, int cardMotionSeconds, int cardMotionMotion) {
  J *hubSetReq = notecard.newRequest("hub.set");
  if (hubSetReq != NULL) {
    JAddStringToObject(hubSetReq, "product", "com.blues.tvantoll:temptrack");
    JAddStringToObject(hubSetReq, "mode", "periodic");
    JAddStringToObject(hubSetReq, "voutbound", "usb:30;high:60;normal:180;low:1440;dead:0");
    JAddStringToObject(hubSetReq, "vinbound", "usb:30;high:720;normal:1440;low:1440;dead:0");
    notecard.sendRequest(hubSetReq);
  }

  J *cardVoltageReq = notecard.newRequest("card.voltage");
  if (cardVoltageReq != NULL) {
    JAddStringToObject(cardVoltageReq, "mode", "lipo");
    notecard.sendRequest(cardVoltageReq);
  }

  J *cardLocationReq = notecard.newRequest("card.location.mode");
  if (cardLocationReq != NULL) {
    JAddStringToObject(cardLocationReq, "mode", "periodic");
    JAddNumberToObject(cardLocationReq, "seconds", 60 * 5);
    notecard.sendRequest(cardLocationReq);
  }

  J *cardLocationTrackReq = notecard.newRequest("card.location.track");
  if (cardLocationTrackReq != NULL) {
    JAddBoolToObject(cardLocationTrackReq, "start", true);
    JAddBoolToObject(cardLocationTrackReq, "heartbeat", true);
    JAddNumberToObject(cardLocationTrackReq, "hours", 24);
    notecard.sendRequest(cardLocationTrackReq);
  }

  J *cardDfuReq = notecard.newRequest("card.dfu");
  if (cardDfuReq != NULL) {
    JAddStringToObject(cardDfuReq, "name", "stm32");
    notecard.sendRequest(cardDfuReq);
  }

  J *noteTemplateReq = notecard.newRequest("note.template");
  if (noteTemplateReq != NULL) {
    JAddStringToObject(noteTemplateReq, "file", ALERT_NOTEFILE);
    J *body = JCreateObject();
    if (body != NULL) {
      JAddNumberToObject(body, "temp", 14.2);
      JAddNumberToObject(body, "temp_min", 14.1);
      JAddNumberToObject(body, "temp_max", 14.1);
      JAddItemToObject(noteTemplateReq, "body", body);
    }
    notecard.sendRequest(noteTemplateReq);
  }

  J *motionReq = notecard.newRequest("card.motion.mode");
  if (motionReq != NULL) {
    JAddBoolToObject(motionReq, "start", true);
    JAddNumberToObject(motionReq, "seconds", cardMotionSeconds);
    JAddNumberToObject(motionReq, "motion", cardMotionMotion);
    notecard.sendRequest(motionReq);
  }

  J *dfuStatusReq = notecard.newRequest("dfu.status");
  if (dfuStatusReq != NULL) {
    JAddStringToObject(dfuStatusReq, "version", firmwareVersion());
    notecard.sendRequest(dfuStatusReq);
  }
}