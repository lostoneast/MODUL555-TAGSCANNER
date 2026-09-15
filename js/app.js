import { CameraController } from "./camera.js";
import { AprilTagScanner } from "./scanner.js";
import { sendTagStatus } from "./api.js";
import { initializeLocationPermission } from "./location-prompt.js";

const dom = {
  successToast: document.getElementById("successToast"),
  successToastText: document.getElementById("successToastText"),
  startup: document.getElementById("startup"),
  startupText: document.getElementById("startupText"),
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
let includeLocation = false;
let locationPermissionTask = null;
let successToastTimer = null;

const camera = new CameraController(dom.video);

const scanner = new AprilTagScanner(
  dom.video,
  dom.overlay,
  handleTagDetected
);

async function init() {
  resetPanels();
  dom.startup.classList.remove("hidden");
  dom.startupText.textContent = "Подготовка камеры…";
  setSystemStatus("Запуск…", "busy");

  try {
    // Видео не ждёт загрузки WASM или определения координат.
    const cameraTask = camera.start().then(() => {
      dom.startupText.textContent = "Подготовка сканера…";
    });
    const detectorTask = scannerInitialized ? Promise.resolve() :
      scanner.init().then(() => { scannerInitialized = true; });
    locationPermissionTask ??= initializeLocationPermission();

    // Дожидаемся завершения задач перед очисткой при ошибке:
    // поздний запуск камеры не должен оставлять активный поток.
    const results = await Promise.allSettled([
      cameraTask, detectorTask, locationPermissionTask
    ]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
    includeLocation = results[2].value;
    dom.startup.classList.add("hidden");

    setSystemStatus("Сканирование", "ready", true);
    dom.scanHint.textContent = "Наведите камеру на AprilTag";

    scanner.start();
  } catch (error) {
    console.error(error);
    dom.startup.classList.add("hidden");
    if (!scannerInitialized) scanner.destroy();
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
    await sendTagStatus(currentPair, selectedStatus, { includeLocation });

    restartScanning();
    showSuccessToast();
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

function showSuccessToast() {
  window.clearTimeout(successToastTimer);
  dom.successToast.classList.remove("visible");
  // Перезапускаем анимацию, если следующий статус подтверждён очень быстро.
  void dom.successToast.offsetWidth;
  dom.successToastText.textContent = "Статус подтверждён";
  dom.successToast.classList.add("visible");
  successToastTimer = window.setTimeout(() => {
    dom.successToast.classList.remove("visible");
    dom.successToastText.textContent = "";
    successToastTimer = null;
  }, 1800);
}

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
