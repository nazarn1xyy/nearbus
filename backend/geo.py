# geo.py
# Прості геометричні функції для роботи з координатами.

import math

EARTH_RADIUS_M = 6371000  # радіус Землі в метрах


def distance_meters(lat1, lon1, lat2, lon2):
    """Відстань між двома точками в метрах (формула Haversine)."""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_M * c


def interpolate(lat1, lon1, lat2, lon2, fraction):
    """Проміжна точка між двома координатами (лінійна інтерполяція,
    для невеликих відстаней в межах міста цього достатньо)."""
    lat = lat1 + (lat2 - lat1) * fraction
    lon = lon1 + (lon2 - lon1) * fraction
    return lat, lon
