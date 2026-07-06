# simulation.py
# Тут імітується рух автобусів. Реального GPS немає, тому будуємо
# "шлях" автобуса як багато проміжних точок між зупинками і просто
# рухаємо автобус по цих точках по колу (маршрут закільцьований).

import random

from geo import distance_meters, interpolate

# Скільки проміжних точок робити між двома сусідніми зупинками.
# Чим більше - тим плавніший рух.
STEPS_BETWEEN_STOPS = 40

# Середня швидкість автобуса в місті, метрів за секунду (~25 км/год)
AVERAGE_SPEED_MPS = 7


def build_path(stops):
    """Будує для одного маршруту список точок шляху.
    Кожна точка містить координати, індекс зупинки, до якої вона веде
    (next_stop_index), і скільки метрів залишилось їхати до неї."""
    path = []
    stops_count = len(stops)

    for i in range(stops_count):
        current_stop = stops[i]
        next_stop = stops[(i + 1) % stops_count]

        segment_length = distance_meters(
            current_stop["lat"], current_stop["lon"],
            next_stop["lat"], next_stop["lon"],
        )

        for step in range(STEPS_BETWEEN_STOPS):
            fraction = step / STEPS_BETWEEN_STOPS
            lat, lon = interpolate(
                current_stop["lat"], current_stop["lon"],
                next_stop["lat"], next_stop["lon"],
                fraction,
            )

            path.append({
                "lat": lat,
                "lon": lon,
                "next_stop_index": (i + 1) % stops_count,
                "distance_to_next_stop": segment_length * (1 - fraction),
            })

    return path


class Bus:
    def __init__(self, bus_id, route):
        self.id = bus_id
        self.route = route
        self.path = build_path(route["stops"])
        # Кожен автобус стартує з випадкової точки на своєму шляху,
        # щоб вони не їхали купкою один за одним
        self.path_index = random.randrange(len(self.path))

    def move(self):
        """Просуваємо автобус на один 'тік' симуляції вперед."""
        self.path_index = (self.path_index + 1) % len(self.path)

    def to_payload(self):
        """Готуємо дані про автобус для відправки на фронт."""
        point = self.path[self.path_index]
        next_stop = self.route["stops"][point["next_stop_index"]]
        eta_seconds = point["distance_to_next_stop"] / AVERAGE_SPEED_MPS

        return {
            "id": self.id,
            "routeId": self.route["id"],
            "lat": point["lat"],
            "lon": point["lon"],
            "nextStopName": next_stop["name"],
            "etaMinutes": max(0, round(eta_seconds / 60)),
        }
