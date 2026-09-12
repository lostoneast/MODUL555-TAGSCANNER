export const APP_CONFIG = Object.freeze({
  apiEndpoint: "/api/tag-events",
  processingWidth: 640,
  scanIntervalMs: 250,
  duplicateCooldownMs: 2000,
  source: "APRILTAG_WEB_SCANNER"
});

export const STATUS_LABELS = Object.freeze({
  ARRIVED_ON_SITE: "Прибыло на объект",
  INSTALLED: "Смонтировано",
  DEFECT: "Брак"
});
