# AprilTag Scanner — прототип

Простой статический веб-интерфейс без React, npm и сборщика.

## Что делает

1. Открывает основную камеру устройства.
2. Ищет AprilTag семейства `tag36h11`.
3. После обнаружения останавливает сканирование и показывает ID метки.
4. Оператор выбирает статус:
   - `ARRIVED_ON_SITE` — прибыло на объект;
   - `INSTALLED` — смонтировано;
   - `DEFECT` — брак.
5. Формируется mock POST-запрос на `/api/tag-events`.
6. JSON выводится на экран и в консоль браузера.
7. По кнопке начинается сканирование следующего изделия.

## Запуск

Не открывайте `index.html` через `file://`.

Из папки проекта:

```powershell
py -m http.server 8080
```

После этого:

```text
http://localhost:8080
```

`localhost` считается безопасным контекстом и позволяет запросить камеру.

## Смартфон

При открытии по локальному IP через обычный HTTP камера обычно будет заблокирована.
Для телефона используйте HTTPS.

## Детектор

Прототип использует WASM-детектор `arenaxr/apriltag-js-standalone`,
загружаемый через jsDelivr.

Семейство: `tag36h11`.

Для полностью автономной работы позднее можно сохранить локально:

- `apriltag.js`
- `apriltag_wasm.js`
- `apriltag_wasm.wasm`

и заменить CDN-пути в `index.html` локальными.

## Будущий API

```text
POST /api/tag-events
```

Пример payload:

```json
{
  "tagId": 143,
  "status": "INSTALLED",
  "timestamp": "2026-09-12T21:44:12.582Z",
  "source": "APRILTAG_WEB_SCANNER"
}
```

В `js/api.js` уже подготовлен вариант реального `fetch()`.

## Структура

```text
apriltag-scanner/
├─ index.html
├─ styles.css
├─ README.md
└─ js/
   ├─ app.js
   ├─ api.js
   ├─ camera.js
   ├─ config.js
   └─ scanner.js
```
