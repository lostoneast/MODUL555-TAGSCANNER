// Запрашиваем координаты только при подтверждении статуса.
export function getCurrentLocation() {
  return new Promise((resolve) => {
    if (!globalThis.navigator?.geolocation) {
      console.warn("Геолокация недоступна: статус будет передан без координат.");
      resolve(null);
      return;
    }

    const onError = (error) => {
      console.warn("Не удалось получить геолокацию:", error.message);
      resolve(null);
    };

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString()
        }),
        onError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (error) {
      onError(error);
    }
  });
}
