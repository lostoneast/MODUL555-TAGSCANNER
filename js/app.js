import { CameraController } from "./camera.js";
import { AprilTagScanner } from "./scanner.js";
import { sendTagStatus } from "./api.js";

const dom = {
  video: document.getElementById("video"),
  overlay: document.getElementById("overlay"),
  systemStatus: document.getElementById("systemStatus"),
  scanHint: document.getElementById("scanHint"),
  tagPanel: document.getElementById("tagPanel"),
  statusButtons: [...document.querySelectorAll(".status-button")],
  submitButton: document.getElementById("submitButton"),

  rescanButton: document.getElementById("rescanButton"),
  errorPanel: document.getElementById("errorPanel"),
  errorText: document.getElementById("errorText"),
  retryButton: document.getElementById("retryButton")
};

let currentPair = null;
let selectedStatus = null;
let scannerInitialized = false;
let submitting = false;

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

    await camera.start();

    setSystemStatus("Сканирование", "ready", true);
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

function handleTagDetected(pair) {
  currentPair = {
    objectTagId: Number(pair.objectTag.id),
    itemTagId: Number(pair.itemTag.id)
  };

  selectedStatus = null;

  dom.tagPanel.classList.remove("hidden");
  dom.errorPanel.classList.add("hidden");

  clearStatusSelection();
  dom.submitButton.disabled = true;

  dom.scanHint.textContent =
    `Метка ID ${currentPair.itemTagId} обнаружена`;

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
    if (submitting) return;
    clearStatusSelection();

    button.classList.add("selected");
    selectedStatus = button.dataset.status;
    dom.submitButton.disabled = false;
  });
}

dom.submitButton.addEventListener("click", async () => {
  if (submitting || currentPair === null || !selectedStatus) return;

  submitting = true;
  dom.rescanButton.disabled = true;
  for (const button of dom.statusButtons) button.disabled = true;

  dom.submitButton.disabled = true;
  dom.submitButton.textContent = "Обработка…";

  try {
    await sendTagStatus(currentPair, selectedStatus);

    restartScanning();
  } catch (error) {
    console.error(error);
    alert(`Не удалось передать статус: ${error.message}`);
    dom.submitButton.disabled = false;
  } finally {
    submitting = false;
    dom.rescanButton.disabled = false;
    for (const button of dom.statusButtons) button.disabled = false;
    dom.submitButton.textContent = "Подтвердить статус";
  }
});

dom.rescanButton.addEventListener("click", () => {
  if (!submitting) restartScanning();
});

function restartScanning() {
  currentPair = null;
  selectedStatus = null;

  dom.tagPanel.classList.add("hidden");

  clearStatusSelection();
  dom.submitButton.disabled = true;

  dom.scanHint.textContent = "Наведите камеру на AprilTag";
  setSystemStatus("Сканирование", "ready", true);

  scanner.resume();
}

dom.retryButton.addEventListener("click", async () => {
  dom.errorPanel.classList.add("hidden");
  await init();
});

function resetPanels() {
  dom.tagPanel.classList.add("hidden");
  dom.errorPanel.classList.add("hidden");
}

function setSystemStatus(text, state = "", scanning = false) {
  dom.systemStatus.textContent = text;
  dom.systemStatus.className = scanning ? "scanning-indicator" : "visually-hidden";

  if (state) {
    dom.systemStatus.classList.add(state);
  }
}

window.addEventListener("beforeunload", () => {
  scanner.destroy();
  camera.stop();
});

init();
