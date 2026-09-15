import { getCurrentLocation } from "./location.js";

// Закрытие окна означает продолжение работы без координат.
export function askLocationPermission() {
  const dialog = document.getElementById("locationDialog");
  return new Promise((resolve) => {
    dialog.returnValue = "";
    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "allow" ? true :
        dialog.returnValue === "skip" ? false : null);
    }, { once: true });
    dialog.showModal();
  });
}

// Выполняется один раз при запуске, до начала сканирования.
export async function initializeLocationPermission() {
  if (!globalThis.navigator?.geolocation) return false;

  let permission;
  try {
    permission = await navigator.permissions?.query({ name: "geolocation" });
  } catch {
    // Не все браузеры поддерживают проверку разрешения на геолокацию.
  }

  if (permission?.state === "granted") return true;

  if (permission?.state === "denied") {
    document.getElementById("locationDescription").textContent =
      "Доступ к геолокации заблокирован в браузере. Чтобы передавать координаты вместе со статусом изделия, разрешите доступ в настройках сайта. Сейчас можно продолжить без координат.";
    document.querySelector('#locationDialog button[value="allow"]').hidden = true;
  }

  const allowed = await askLocationPermission();
  if (!allowed) return false;

  // Вызываем системный запрос сейчас, а не при отправке статуса.
  await getCurrentLocation();
  // Даже если координаты пока не определены, повторим попытку при отправке.
  return true;
}
