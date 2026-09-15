export const APP_CONFIG = Object.freeze({
  // Вставьте адрес API (например, "/api/tag-events" или полный HTTPS URL).
  // Пустая строка — режим отладки: JSON только в консоли, без отправки.
  apiEndpoint: "",
  processingWidth: 640,
  scanIntervalMs: 150,
  duplicateCooldownMs: 2000,
  source: "APRILTAG_WEB_SCANNER"
});

export const STATUS_LABELS = Object.freeze({
  ARRIVED_ON_SITE: "Прибыло на объект",
  INSTALLED: "Смонтировано",
  DEFECT: "Брак"
});
