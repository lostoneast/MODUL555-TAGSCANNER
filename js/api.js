import { APP_CONFIG, STATUS_LABELS } from "./config.js";

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
    source: APP_CONFIG.source
  };
}

export async function sendTagStatus(pair, status) {
  const payload = createTagEventPayload(pair, status);

  const mockRequest = {
    method: "POST",
    url: APP_CONFIG.apiEndpoint,
    headers: {
      "Content-Type": "application/json"
    },
    body: payload
  };

  console.group("Mock API request");
  console.log(mockRequest.method, mockRequest.url);
  console.log(JSON.stringify(mockRequest.body, null, 2));
  console.groupEnd();

  await new Promise((resolve) => setTimeout(resolve, 180));

  return {
    ok: true,
    mock: true,
    request: mockRequest
  };
}

/*
Когда backend будет готов:

const response = await fetch(APP_CONFIG.apiEndpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

if (!response.ok) throw new Error(`HTTP ${response.status}`);
return await response.json();
*/
