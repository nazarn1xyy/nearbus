# server.py
# Простий WebSocket сервер на asyncio.
# При підключенні клієнта - надсилаємо йому список маршрутів і зупинок.
# Потім кожну секунду надсилаємо всім клієнтам оновлені позиції автобусів.

import asyncio
import json
import logging

import websockets

from routes import ROUTES
from simulation import Bus

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

HOST = "0.0.0.0"
PORT = 3001
TICK_INTERVAL_SECONDS = 1  # раз в секунду рухаємо автобуси і шлемо оновлення

# Всі підключені зараз клієнти
connected_clients = set()

# Створюємо по 2 автобуси на кожен маршрут
buses = []
for route in ROUTES:
    buses.append(Bus(f"{route['id']}-1", route))
    buses.append(Bus(f"{route['id']}-2", route))


def build_init_message():
    """Статичні дані для клієнта одразу після підключення:
    самі маршрути (для малювання ліній і зупинок на карті)."""
    return json.dumps({
        "type": "init",
        "routes": [
            {
                "id": route["id"],
                "name": route["name"],
                "color": route["color"],
                "stops": route["stops"],
            }
            for route in ROUTES
        ],
    })


async def handle_client(websocket):
    connected_clients.add(websocket)
    logger.info("Новий клієнт підключився. Всього клієнтів: %s", len(connected_clients))

    try:
        await websocket.send(build_init_message())

        # Нам не треба нічого отримувати від клієнта, просто тримаємо
        # з'єднання відкритим, поки клієнт сам його не закриє
        async for _ in websocket:
            pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        logger.info("Клієнт відключився. Всього клієнтів: %s", len(connected_clients))


async def broadcast_loop():
    """Головний цикл симуляції: рухаємо всі автобуси і розсилаємо
    оновлення всім підключеним клієнтам."""
    while True:
        await asyncio.sleep(TICK_INTERVAL_SECONDS)

        if not connected_clients:
            # Якщо ніхто не підключений, все одно рухаємо автобуси,
            # щоб при підключенні клієнт одразу побачив "живий" рух
            for bus in buses:
                bus.move()
            continue

        for bus in buses:
            bus.move()

        update_message = json.dumps({
            "type": "update",
            "buses": [bus.to_payload() for bus in buses],
        })

        # Розсилаємо всім клієнтам, ігноруючи тих, хто вже відключився
        disconnected = set()
        for client in connected_clients:
            try:
                await client.send(update_message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)

        connected_clients.difference_update(disconnected)


async def main():
    async with websockets.serve(handle_client, HOST, PORT):
        logger.info("WebSocket сервер запущено на порту %s", PORT)
        await broadcast_loop()


if __name__ == "__main__":
    asyncio.run(main())
