import { APP_CONFIG, STATUS_LABELS } from "./config.js";

export function createTagEventPayload(tagId, status) {
  if (!Number.isFinite(Number(tagId))) {
    throw new Error("Некорректный ID AprilTag.");
  }

  if (!STATUS_LABELS[status]) {
    throw new Error(`Неизвестный статус: ${status}`);
  }

  return {
    tagId: Number(tagId),
    status,
    timestamp: new Date().toISOString(),
    source: APP_CONFIG.source
  };
}

export async function sendTagStatus(tagId, status) {
  const payload = createTagEventPayload(tagId, status);

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
