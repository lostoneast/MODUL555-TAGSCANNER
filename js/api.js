import { APP_CONFIG, STATUS_LABELS } from "./config.js";
import { getCurrentLocation } from "./location.js";

export function createTagEventPayload(pair, status) {
  const objectTagId = Number(pair?.objectTagId);
  const itemTagId = Number(pair?.itemTagId);

  if (!Number.isFinite(objectTagId)) {
    throw new Error("Некорректный ID метки объекта.");
  }

  if (!Number.isFinite(itemTagId)) {
    throw new Error("Некорректный ID метки изделия.");
  }

  if (!STATUS_LABELS[status]) {
    throw new Error(`Неизвестный статус: ${status}`);
  }

  return {
    objectTagId,
    itemTagId,
    status,
    timestamp: new Date().toISOString(),
    source: APP_CONFIG.source,
    location: null
  };
}

// Вся подготовка и отправка запроса находятся здесь; адрес — в config.js.
export async function sendTagStatus(pair, status, { includeLocation = true } = {}) {
  const payload = createTagEventPayload(pair, status);
  payload.location = includeLocation ? await getCurrentLocation() : null;
  const endpoint = APP_CONFIG.apiEndpoint.trim();
  const request = {
    method: "POST",
    url: endpoint,
    headers: { "Content-Type": "application/json" },
    body: payload
  };

  console.info(
    endpoint ? "Запрос передачи статуса:" : "Отладка: запрос не отправляется (endpoint не указан).",
    JSON.stringify({
      endpoint,
      method: request.method,
      payload,
      statusLabel: STATUS_LABELS[status]
    }, null, 2)
  );

  if (!endpoint) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    return { ok: true, mock: true, request };
  }

  const response = await fetch(endpoint, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Сервер вернул ошибку HTTP ${response.status}.`);
  }

  // Не требуем JSON в ответе: поддерживаем также пустой ответ (204).
  return { ok: true, mock: false, request, status: response.status };
}
