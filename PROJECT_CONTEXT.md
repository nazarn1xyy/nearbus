# Bus Tracker — Контекст проєкту для Gemini

## Опис
Демо-додаток для хакатону: відстеження міських автобусів Могилева-Подільського в реальному часі. GPS не використовується — рух автобусів симулюється на бекенді. Користувач відкриває сайт, дає доступ до геолокації, бачить найближчий автобус на карті та ETA (час прибуття).

## Технічний стек
- **Backend:** Python (asyncio + websockets), порт 3001
- **Frontend:** Vanilla JS + Leaflet.js 1.9.4, без фреймворків
- **Карта:** CARTO Voyager tiles (світлі, як Apple Maps)
- **PWA:** manifest.json + service worker (sw.js) для оффлайн-кешу
- **Деплой:** Vercel (планується), поки локально

## Структура
```
SmartCityHackathon/
  backend-python/
    server.py        — WebSocket сервер, порт 3001, оновлення кожну секунду
    routes.py        — 5 маршрутів (№1, №2, №3, №5, №7), 10 автобусів, зупинки з координатами
    simulation.py    — Симуляція руху: Bus клас, інтерполяція між зупинками
    geo.py           — Haversine distance, interpolate
  frontend/
    index.html       — Full-screen map, top bar, bottom sheet, FAB, geo prompt
    style.css        — Apple Maps style: SF Pro шрифт, glass effect, dark/light theme, без градиентов
    app.js           — WebSocket client, геолокація, nearest bus, bottom sheet зі свайпами
    manifest.json    — PWA manifest
    sw.js            — Service worker (кеш shell + tiles)
    icon-192.svg     — PWA іконка
    icon-512.svg     — PWA іконка
  .agent/skills/     — Skills з GitHub (frontend-design, mobile-design, performance-optimization, progressive-web-app, ui-ux-pro-max)
```

## Вимоги
- **Mobile-first, нативний iOS вигляд** (як Apple Maps)
- **Оптимізація під поганий інтернет:** PWA, service worker кеш, WebSocket reconnect з exponential backoff, мінімальний payload
- **Без градиентів, без slop, чистий дизайн**
- **Геолокація:** navigator.geolocation.watchPosition → найближчий автобус (Haversine) → ETA в bottom sheet
- **Bottom sheet:** свайп вверх/вниз для розкриття/закриття, тап по handle
- **Маркери:** автобуси — круглі капсули з номером маршруту, найближчий — з голубим свіченням
- **Лінії маршрутів:** подвійні (біла обводка + кольорова лінія), як в iOS Maps
- **Тёмна/світла тема:** авто через prefers-color-scheme (але карта завжди світла CARTO Voyager)

## Формат WebSocket повідомлень
### Init (при підключенні):
```json
{
  "type": "init",
  "routes": [
    { "id": "1", "name": "№1 Автовокзал — Центр — Лікарня", "color": "#e63946",
      "stops": [{"name": "Автовокзал", "lat": 48.4522, "lon": 27.7887}, ...] }
  ]
}
```
### Update (кожну секунду):
```json
{
  "type": "update",
  "buses": [
    { "id": "1-1", "routeId": "1", "lat": 48.4510, "lon": 27.7900,
      "nextStopName": "Центр", "etaMinutes": 3 }
  ]
}
```

## Запуск
```bash
# Backend
cd backend-python && python3 server.py

# Frontend
cd frontend && python3 -m http.server 8080

# Доступ з телефону (в тій же Wi-Fi мережі):
# http://<IP>:8080
```

## Поточний стан
- ✅ 5 маршрутів, 10 автобусів
- ✅ Apple Maps стиль (CARTO Voyager tiles, glass effect, SF Pro)
- ✅ Геолокація + найближчий автобус + ETA
- ✅ Bottom sheet зі свайпами
- ✅ PWA (manifest + service worker)
- ✅ WebSocket reconnect
- ✅ Dark/light theme
- ⬜ Vercel деплой
- ⬜ Тестування на реальних пристроях

## Ключові рішення
1. **Vanilla JS без фреймворків** — мінімальний розмір, швидка загрузка
2. **CARTO Voyager tiles** — чистий, сучасний вигляд як Apple Maps
3. **Карта завжди світла** — навіть в dark mode (текст UI адаптується, карта ні)
4. **Service worker v2** — кешує shell + tiles, версіонується для інвалідації
5. **WebSocket URL** — авто визначення по location.hostname (працює і локально, і на деплої)

## Що можна покращити
- Реальні координати зупинок (зараз наближені)
- Інтерактивний вибір маршруту (фільтр на карті)
- Push-сповіщення коли автобус наближається
- Збереження останньої геолокації в localStorage
- Кастомні іконки автобусів (SVG замість div)
- Анімація руху маркерів плавніша (requestAnimationFrame інтерполяція)
