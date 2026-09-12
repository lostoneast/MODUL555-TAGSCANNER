import { CameraController } from "./camera.js";
import { AprilTagScanner } from "./scanner.js";
import { sendTagStatus } from "./api.js";
import { STATUS_LABELS } from "./config.js";

const dom = {
  video: document.getElementById("video"),
  overlay: document.getElementById("overlay"),
  cameraView: document.getElementById("cameraView"),
  systemStatus: document.getElementById("systemStatus"),
  scanHint: document.getElementById("scanHint"),

  tagPanel: document.getElementById("tagPanel"),
  tagId: document.getElementById("tagId"),
  statusButtons: [...document.querySelectorAll(".status-button")],
  submitButton: document.getElementById("submitButton"),

  jsonPanel: document.getElementById("jsonPanel"),
  jsonOutput: document.getElementById("jsonOutput"),
  scanAgainButton: document.getElementById("scanAgainButton"),

  errorPanel: document.getElementById("errorPanel"),
  errorText: document.getElementById("errorText"),
  retryButton: document.getElementById("retryButton")
};

let currentTagId = null;
let selectedStatus = null;
let scannerInitialized = false;

const camera = new CameraController(dom.video);

const scanner = new AprilTagScanner(
  dom.video,
  dom.overlay,
  handleTagDetected
);

async function init() {
  resetPanels();
  setSystemStatus("Детектор…", "busy");
  dom.scanHint.textContent = "Загрузка AprilTag WASM…";

  try {
    if (!scannerInitialized) {
      await scanner.init();
      scannerInitialized = true;
    }

    setSystemStatus("Камера…", "busy");
    dom.scanHint.textContent = "Запрос доступа к камере…";

    const cameraInfo = await camera.start();

    dom.cameraView.style.aspectRatio =
      `${cameraInfo.width} / ${cameraInfo.height}`;

    setSystemStatus("Сканирование", "ready");
    dom.scanHint.textContent = "Наведите камеру на AprilTag";

    scanner.start();
  } catch (error) {
    console.error(error);
    scanner.stop();
    camera.stop();

    setSystemStatus("Ошибка", "error");
    dom.scanHint.textContent = "Сканер остановлен";

    dom.errorText.textContent =
      error?.message || "Неизвестная ошибка запуска.";

    dom.errorPanel.classList.remove("hidden");
  }
}

function handleTagDetected(detection) {
  currentTagId = Number(detection.id);
  selectedStatus = null;

  dom.tagId.textContent = String(currentTagId);
  dom.tagPanel.classList.remove("hidden");
  dom.jsonPanel.classList.add("hidden");
  dom.errorPanel.classList.add("hidden");

  clearStatusSelection();
  dom.submitButton.disabled = true;

  dom.scanHint.textContent = `Метка ID ${currentTagId} обнаружена`;
  setSystemStatus("Метка найдена", "ready");

  if (navigator.vibrate) {
    navigator.vibrate(80);
  }
}

function clearStatusSelection() {
  for (const button of dom.statusButtons) {
    button.classList.remove("selected");
  }
}

for (const button of dom.statusButtons) {
  button.addEventListener("click", () => {
    clearStatusSelection();

    button.classList.add("selected");
    selectedStatus = button.dataset.status;
    dom.submitButton.disabled = false;
  });
}

dom.submitButton.addEventListener("click", async () => {
  if (currentTagId === null || !selectedStatus) return;

  dom.submitButton.disabled = true;
  dom.submitButton.textContent = "Формирование запроса…";

  try {
    const result = await sendTagStatus(currentTagId, selectedStatus);

    const displayData = {
      endpoint: result.request.url,
      method: result.request.method,
      payload: result.request.body,
      statusLabel: STATUS_LABELS[selectedStatus]
    };

    dom.jsonOutput.textContent = JSON.stringify(displayData, null, 2);

    dom.tagPanel.classList.add("hidden");
    dom.jsonPanel.classList.remove("hidden");

    dom.scanHint.textContent = "Статус зафиксирован";
    setSystemStatus("Готово", "ready");
  } catch (error) {
    console.error(error);
    alert(`Ошибка формирования запроса: ${error.message}`);
    dom.submitButton.disabled = false;
  } finally {
    dom.submitButton.textContent = "Подтвердить статус";
  }
});

dom.scanAgainButton.addEventListener("click", () => {
  currentTagId = null;
  selectedStatus = null;

  dom.jsonOutput.textContent = "";
  dom.jsonPanel.classList.add("hidden");
  dom.tagPanel.classList.add("hidden");

  clearStatusSelection();
  dom.submitButton.disabled = true;

  dom.scanHint.textContent = "Наведите камеру на AprilTag";
  setSystemStatus("Сканирование", "ready");

  scanner.resume();
});

dom.retryButton.addEventListener("click", async () => {
  dom.errorPanel.classList.add("hidden");
  await init();
});

function resetPanels() {
  dom.tagPanel.classList.add("hidden");
  dom.jsonPanel.classList.add("hidden");
  dom.errorPanel.classList.add("hidden");
}

function setSystemStatus(text, state = "") {
  dom.systemStatus.textContent = text;
  dom.systemStatus.className = "system-status";

  if (state) {
    dom.systemStatus.classList.add(state);
  }
}

window.addEventListener("beforeunload", () => {
  scanner.destroy();
  camera.stop();
});

init();
