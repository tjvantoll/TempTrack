#ifndef CONFIG_H
#define CONFIG_H

#include <Notecard.h>

#define STRINGIFY(x) STRINGIFY_(x)
#define STRINGIFY_(x) #x

// Definitions used by firmware update
#define PRODUCT_ORG_NAME      "Blues"
#define PRODUCT_DISPLAY_NAME  "TempTrack"
#define PRODUCT_FIRMWARE_ID   "temptrack"
#define PRODUCT_DESC          "Asset tracker w/temperature-based alerting"
#define PRODUCT_MAJOR         0
#define PRODUCT_MINOR         1
#define PRODUCT_PATCH         0
#define PRODUCT_BUILD         0
#define PRODUCT_BUILT         __DATE__ " " __TIME__
#define PRODUCT_BUILDER       "TJ VanToll"
#define PRODUCT_VERSION       STRINGIFY(PRODUCT_MAJOR) "." STRINGIFY(PRODUCT_MINOR) "." STRINGIFY(PRODUCT_PATCH)

// This is a product configuration JSON structure that enables the Notehub to recognize this
// firmware when it's uploaded, to help keep track of versions and so we only ever download
// firmware builds that are appropriate for this device.
#define QUOTE(x) "\"" x "\""
#define FIRMWARE_VERSION_HEADER "firmware::info:"
#define FIRMWARE_VERSION FIRMWARE_VERSION_HEADER       \
  "{" QUOTE("org") ":" QUOTE(PRODUCT_ORG_NAME)         \
  "," QUOTE("product") ":" QUOTE(PRODUCT_DISPLAY_NAME) \
  "," QUOTE("description") ":" QUOTE(PRODUCT_DESC)     \
  "," QUOTE("firmware") ":" QUOTE(PRODUCT_FIRMWARE_ID) \
  "," QUOTE("version") ":" QUOTE(PRODUCT_VERSION)      \
  "," QUOTE("built") ":" QUOTE(PRODUCT_BUILT)          \
  "," QUOTE("ver_major") ":" STRINGIFY(PRODUCT_MAJOR)  \
  "," QUOTE("ver_minor") ":" STRINGIFY(PRODUCT_MINOR)  \
  "," QUOTE("ver_patch") ":" STRINGIFY(PRODUCT_PATCH)  \
  "," QUOTE("ver_build") ":" STRINGIFY(PRODUCT_BUILD)  \
  "," QUOTE("builder") ":" QUOTE(PRODUCT_BUILDER)      \
  "}"

extern const char* const ALERT_NOTEFILE;

const char *firmwareVersion();
void configureNotecard(Notecard &notecard, int cardMotionSeconds, int cardMotionMotion);

#endif