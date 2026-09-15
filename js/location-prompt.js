// null означает закрытие окна без подтверждения отправки (например, Escape).
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
