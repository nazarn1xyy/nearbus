// app.js
// Bus tracker — Apple Maps style, mobile-first, PWA-ready
// Standalone JS Simulation Demo

(function () {
  'use strict';

  // --- Analytics Stub (Task: metrics-definition) ---
  window.trackEvent = function(eventName, properties) {
    // This can later be wired up to PostHog or Google Analytics
    console.log('[Analytics] ' + eventName, properties || {});
  };

  var MAP_CENTER = [48.4483, 27.7940];
  
  // --- Simulation Data ---


  var state = {
    routes: {},
    busMarkers: {},
    stopMarkers: {},
    latestBusData: {},
    userLat: null,
    userLon: null,
    userMarker: null,
    nearestBusId: null,
    sheetExpanded: false,
    selectedRouteId: null,
    searchQuery: '',
    expandedBusId: null,
    watchId: null,
    simBuses: [],
    lightMapLayer: null,
    darkMapLayer: null
  };

  // --- Map setup ---
  var bounds = L.latLngBounds(L.latLng(48.35, 27.70), L.latLng(48.55, 27.90));
  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true,
    maxBounds: bounds,
    maxBoundsViscosity: 1.0
  });
  
  // Start zoomed out slightly for the landing effect (Task 22)
  map.setView([48.4485, 27.7944], 12); 
  setTimeout(function() {
    map.flyTo([48.4485, 27.7944], 14, { duration: 1.5, easeLinearity: 0.25 });
  }, 400);

  var lightUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  var darkUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png';

  state.lightMapLayer = L.tileLayer(lightUrl, {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19, keepBuffer: 4, subdomains: 'abcd'
  });
  state.darkMapLayer = L.tileLayer(darkUrl, {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19, keepBuffer: 4, subdomains: 'abcd'
  });

  function updateMapTheme(e) {
    var isDark = e.matches;
    if (isDark) {
      map.removeLayer(state.lightMapLayer);
      state.darkMapLayer.addTo(map);
    } else {
      map.removeLayer(state.darkMapLayer);
      state.lightMapLayer.addTo(map);
    }

    var outlineColor = isDark ? '#1c1c1e' : '#ffffff';
    
    Object.keys(state.routes).forEach(function(id) {
      var r = state.routes[id];
      if (r.polylineBg) {
        r.polylineBg.setStyle({ color: outlineColor });
      }
    });

    Object.keys(state.stopMarkers).forEach(function(key) {
      var sm = state.stopMarkers[key];
      if (sm.marker) {
        sm.marker.setStyle({ fillColor: outlineColor });
      }
    });
  }

  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  prefersDark.addEventListener('change', updateMapTheme);
  updateMapTheme(prefersDark);

  // --- Simulation Engine ---
  var STEPS_BETWEEN_STOPS = 40;
  var AVERAGE_SPEED_MPS = 7;

  function calculateBearing(lat1, lon1, lat2, lon2) {
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var l1 = lat1 * Math.PI / 180, l2 = lat2 * Math.PI / 180;
    var y = Math.sin(dLon) * Math.cos(l2);
    var x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function interpolate(lat1, lon1, lat2, lon2, fraction) {
    return {
      lat: lat1 + (lat2 - lat1) * fraction,
      lon: lon1 + (lon2 - lon1) * fraction
    };
  }

  function buildPath(route) {
    var path = [];
    var count = route.stops.length;
    
    // Fallback: use pathGeometry (road-following path) or straight lines between stops
    if (!route.legs || route.legs.length === 0) {
      // If we have pathGeometry, use it to build a smooth path
      if (route.pathGeometry && route.pathGeometry.length > 1) {
        var totalPathDist = 0;
        for (var j = 0; j < route.pathGeometry.length - 1; j++) {
          totalPathDist += distanceMeters(route.pathGeometry[j].lat, route.pathGeometry[j].lon, route.pathGeometry[j+1].lat, route.pathGeometry[j+1].lon);
        }
        
        // Find which stop each path point is closest to (for nextStopIndex)
        var stopDistances = [0];
        var accDist = 0;
        for (var si = 1; si < count; si++) {
          accDist += distanceMeters(route.stops[si-1].lat, route.stops[si-1].lon, route.stops[si].lat, route.stops[si].lon);
          stopDistances.push(accDist);
        }
        var totalStopDist = accDist;
        
        var pathAccDist = 0;
        for (var pi = 0; pi < route.pathGeometry.length; pi++) {
          if (pi > 0) {
            pathAccDist += distanceMeters(route.pathGeometry[pi-1].lat, route.pathGeometry[pi-1].lon, route.pathGeometry[pi].lat, route.pathGeometry[pi].lon);
          }
          var pathFrac = totalPathDist > 0 ? (pathAccDist / totalPathDist) : 0;
          var mappedDist = pathFrac * totalStopDist;
          
          var nextStopIdx = 0;
          for (var si = 0; si < count; si++) {
            if (stopDistances[si] >= mappedDist) {
              nextStopIdx = si;
              break;
            }
            nextStopIdx = si;
          }
          
          path.push({
            lat: route.pathGeometry[pi].lat,
            lon: route.pathGeometry[pi].lon,
            nextStopIndex: nextStopIdx % count,
            distToNext: Math.max(0, totalPathDist - pathAccDist) / (count > 1 ? count : 1)
          });
        }
        return path;
      }
      
      // Ultimate fallback: straight lines
      for (var i = 0; i < count; i++) {
        var curr = route.stops[i];
        var next = route.stops[(i + 1) % count];
        var segLen = distanceMeters(curr.lat, curr.lon, next.lat, next.lon);

        for (var step = 0; step < STEPS_BETWEEN_STOPS; step++) {
          var frac = step / STEPS_BETWEEN_STOPS;
          var pos = interpolate(curr.lat, curr.lon, next.lat, next.lon, frac);
          path.push({
            lat: pos.lat,
            lon: pos.lon,
            nextStopIndex: (i + 1) % count,
            distToNext: segLen * (1 - frac)
          });
        }
      }
      return path;
    }

    // Use OSRM detailed legs
    for (var i = 0; i < route.legs.length; i++) {
      var legCoords = route.legs[i];
      var legDist = 0;
      
      // Calculate total length of this leg
      for (var j = 0; j < legCoords.length - 1; j++) {
         legDist += distanceMeters(legCoords[j].lat, legCoords[j].lon, legCoords[j+1].lat, legCoords[j+1].lon);
      }
      
      // We want to interpolate points evenly along the leg so the bus moves smoothly.
      var steps = Math.max(STEPS_BETWEEN_STOPS, Math.floor(legDist / 5)); // 1 step every 5 meters approx
      
      var distCovered = 0;
      var coordIndex = 0;
      var curDistInCoord = 0;
      var coordDist = legCoords.length > 1 ? distanceMeters(legCoords[0].lat, legCoords[0].lon, legCoords[1].lat, legCoords[1].lon) : 0;
      
      for (var step = 0; step < steps; step++) {
         var targetDist = (step / steps) * legDist;
         
         // Advance to the right segment
         while (coordIndex < legCoords.length - 2 && distCovered + coordDist < targetDist) {
            distCovered += coordDist;
            coordIndex++;
            coordDist = distanceMeters(legCoords[coordIndex].lat, legCoords[coordIndex].lon, legCoords[coordIndex+1].lat, legCoords[coordIndex+1].lon);
         }
         
         var frac = coordDist === 0 ? 0 : (targetDist - distCovered) / coordDist;
         var pos = interpolate(legCoords[coordIndex].lat, legCoords[coordIndex].lon, legCoords[coordIndex+1].lat, legCoords[coordIndex+1].lon, frac);
         
         path.push({
            lat: pos.lat,
            lon: pos.lon,
            nextStopIndex: (i + 1) % count,
            distToNext: legDist - targetDist
         });
      }
    }
    return path;
  }

  function Bus(id, route) {
    this.id = id;
    this.route = route;
    this.path = buildPath(route);
    this.pathIndex = Math.floor(Math.random() * this.path.length);
  }

  Bus.prototype.move = function() {
    this.pathIndex = (this.pathIndex + 1) % this.path.length;
  };

  Bus.prototype.toPayload = function() {
    var point = this.path[this.pathIndex];
    var nextPoint = this.path[(this.pathIndex + 1) % this.path.length];
    var bearing = calculateBearing(point.lat, point.lon, nextPoint.lat, nextPoint.lon);
    
    var nextStop = this.route.stops[point.nextStopIndex];
    var etaSec = point.distToNext / AVERAGE_SPEED_MPS;
    var currentEta = Math.max(0, Math.round(etaSec / 60));

    var upcomingStops = [];
    var count = this.route.stops.length;
    var accSec = etaSec;
    for (var i = 0; i < 4; i++) {
       var idx = (point.nextStopIndex + i) % count;
       var s = this.route.stops[idx];
       if (i > 0) {
          var prevIdx = (idx - 1 + count) % count;
          var pStop = this.route.stops[prevIdx];
          var dist = distanceMeters(pStop.lat, pStop.lon, s.lat, s.lon);
          accSec += dist / AVERAGE_SPEED_MPS;
       }
       upcomingStops.push({
          name: s.name,
          etaMinutes: Math.max(0, Math.round(accSec / 60))
       });
    }

    return {
      id: this.id,
      routeId: this.route.id,
      lat: point.lat,
      lon: point.lon,
      bearing: bearing,
      nextStopName: nextStop.name,
      etaMinutes: currentEta,
      upcomingStops: upcomingStops
    };
  };

  // --- Weather API ---
  function fetchWeather(lat, lon) {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current_weather=true')
      .then(function(response) { return response.json(); })
      .then(function(data) {
        if (data.current_weather) {
          updateWeatherWidget(data.current_weather);
        }
      })
      .catch(function(err) {
        console.error('Failed to fetch weather', err);
      });
  }

  function updateWeatherWidget(weather) {
    var widget = document.getElementById('weatherWidget');
    var tempEl = document.getElementById('weatherTemp');
    var iconEl = document.getElementById('weatherIcon');
    if (!widget || !tempEl || !iconEl) return;

    var temp = Math.round(weather.temperature);
    tempEl.textContent = temp + '°';
    
    var code = weather.weathercode;
    var icon = '☁️';
    if (code === 0) icon = weather.is_day ? '☀️' : '🌙';
    else if (code <= 3) icon = weather.is_day ? '⛅' : '☁️';
    else if (code <= 48) icon = '🌫️';
    else if (code <= 55) icon = '🌧️';
    else if (code <= 65) icon = '🌧️';
    else if (code <= 75) icon = '❄️';
    else if (code <= 77) icon = '❄️';
    else if (code <= 82) icon = '🌧️';
    else if (code <= 86) icon = '❄️';
    else if (code >= 95) icon = '⛈️';

    iconEl.textContent = icon;
    widget.hidden = false;
  }

  // --- Air Raid Alert System ---
  var airRaidActive = false;

  function setAirRaidAlert(active, regionName) {
    airRaidActive = active;
    var pill = document.getElementById('alertPill');
    var card = document.getElementById('alertCard');
    var timeEl = document.getElementById('alertTime');

    if (active) {
      pill.hidden = false;
      card.hidden = false;
      document.body.classList.add('air-raid-active');
      if (timeEl) {
        var now = new Date();
        var hh = String(now.getHours()).padStart(2, '0');
        var mm = String(now.getMinutes()).padStart(2, '0');
        timeEl.textContent = 'Оновлено о ' + hh + ':' + mm;
      }
      if (regionName) {
        var bodyEl = card.querySelector('.alert-card__body');
        if (bodyEl) bodyEl.textContent = regionName + ' — автобуси можуть бути затримані. Залишайтеся в укритті.';
      }
    } else {
      pill.hidden = true;
      card.hidden = true;
      document.body.classList.remove('air-raid-active');
    }
  }

  function fetchAirRaidStatus() {
    fetch('/api/alerts')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.alerts) {
        var isAlertActive = data.alerts.some(function(a) {
          return a.location_oblast === 'Вінницька область' || a.location_title === 'Вінницька область';
        });
        setAirRaidAlert(isAlertActive, 'Вінницька область');
      }
    })
    .catch(function(e) { console.error('Alert API error', e); });
  }

  // Expose for testing from browser console: window.setAirRaidAlert = setAirRaidAlert;
  window.setAirRaidAlert = setAirRaidAlert;

  // --- Alerts History ---
  var btnLastAlert = document.getElementById('btnLastAlert');
  if (btnLastAlert) {
    btnLastAlert.addEventListener('click', function() {
      var originalText = btnLastAlert.innerHTML;
      btnLastAlert.innerHTML = '<span class="spinner" style="width:12px;height:12px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin 1s linear infinite;margin-right:4px;"></span> Завантаження...';
      
      // UID 4 = Vinnytsia Oblast on alerts.in.ua API
      fetch('/api/alertsHistory')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btnLastAlert.innerHTML = originalText;
        if (data && data.length > 0) {
          data.sort(function(a,b) { return new Date(b.started_at) - new Date(a.started_at); });
          var lastAlert = data[0];
          
          var startDate = new Date(lastAlert.started_at);
          var endDate = lastAlert.finished_at ? new Date(lastAlert.finished_at) : null;
          
          var msg = "Остання тривога у " + (lastAlert.location_title || "Вінницькій області") + ":\n\n";
          msg += "Початок: " + startDate.toLocaleString('uk-UA');
          if (endDate) {
            msg += "\nВідбій: " + endDate.toLocaleString('uk-UA');
            var diffMins = Math.round((endDate - startDate) / 60000);
            msg += "\nТривалість: " + diffMins + " хв.";
          } else {
            msg += "\nСтатус: Триває зараз!";
          }
          alert(msg);
        } else if (data.message) {
          alert("Ой, сервери відповіли з помилкою: " + data.message + "\n\nСпробуйте трохи пізніше або зазирніть на alerts.in.ua");
        } else {
          alert("Зараз немає даних про тривоги. Сподіваємось, небо чисте! ☀️");
        }
      })
      .catch(function(e) {
        btnLastAlert.innerHTML = originalText;
        alert("Ой, здається зв'язок втрачено 📡 Перевірте інтернет та спробуйте ще раз.");
      });
    });
  }

  function startSimulation() {
    fetchWeather(MAP_CENTER[0], MAP_CENTER[1]);
    fetchAirRaidStatus();
    // Re-check alert status every 30 seconds
    setInterval(fetchAirRaidStatus, 30000);
    // Init buses
    SIM_ROUTES.forEach(function(r) {
      state.simBuses.push(new Bus(r.id + '-1', r));
      state.simBuses.push(new Bus(r.id + '-2', r));
    });

    handleInit(SIM_ROUTES);

    setInterval(function() {
      var payloads = state.simBuses.map(function(b) {
        b.move();
        return b.toPayload();
      });
      handleUpdate(payloads);
    }, 1000);
  }

  // --- Init handler: draw routes and stops ---
  function handleInit(routes) {
    renderRouteFilters(routes);

    routes.forEach(function (route) {
      state.routes[route.id] = route;

      // Route casing (white border underneath) — Apple Maps style
      var latLngs = route.pathGeometry ? route.pathGeometry.map(function(c) { return [c.lat, c.lon]; }) : route.stops.map(function (s) { return [s.lat, s.lon]; });
      
      var outlineColor = prefersDark.matches ? '#1c1c1e' : '#ffffff';

      route.polylineBg = L.polyline(latLngs, { color: outlineColor, weight: 8, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      route.polyline = L.polyline(latLngs, { color: route.color, weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);

      // Stop markers
      route.stops.forEach(function (stop, index) {
        var key = route.id + '__' + stop.name + '__' + index;
        if (state.stopMarkers[key]) return;

        var marker = L.circleMarker([stop.lat, stop.lon], {
          radius: 6,
          color: route.color,
          fillColor: outlineColor,
          fillOpacity: 1,
          weight: 3,
        }).addTo(map);

        marker.on('click', function () {
          marker.bindPopup(buildStopPopup(route, stop)).openPopup();
        });

        state.stopMarkers[key] = { marker: marker, route: route, stop: stop };
      });
    });
    updateMapVisibility();
  }

  function renderRouteFilters(routes) {
    var container = document.getElementById('routeFilter');
    if (!container) return;
    
    var html = '<div class="place-item ' + (!state.selectedRouteId ? 'place-item--active' : '') + '" data-route-id="">';
    html += '<div class="place-icon" style="background: var(--blue-500)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></div>';
    html += '<div class="place-name">Всі маршрути</div>';
    html += '</div>';

    routes.forEach(function (r) {
      var active = state.selectedRouteId === r.id ? 'place-item--active' : '';
      html += '<div class="place-item ' + active + '" data-route-id="' + esc(r.id) + '">';
      html += '<div class="place-icon" style="background: ' + r.color + '">' + esc(r.id) + '</div>';
      html += '<div class="place-name">' + esc(r.name) + '</div>';
      html += '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.place-item').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.selectedRouteId = this.getAttribute('data-route-id') || null;
        renderRouteFilters(routes);
        updateMapVisibility();
        updateNearestBus();
        
        if (state.selectedRouteId && state.routes[state.selectedRouteId] && state.routes[state.selectedRouteId].polyline) {
          var bounds = state.routes[state.selectedRouteId].polyline.getBounds();
          var paddingBottom = state.sheetExpanded ? document.getElementById('sheet').offsetHeight + 20 : 120;
          map.flyToBounds(bounds, { paddingBottomRight: [0, paddingBottom], paddingTopLeft: [20, 20], duration: 0.8 });
        }
      });
    });
  }

  function updateMapVisibility() {
    Object.keys(state.routes).forEach(function (id) {
      var rData = state.routes[id];
      var visible = !state.selectedRouteId || state.selectedRouteId === id;
      if (rData.polyline) {
         if (visible && !map.hasLayer(rData.polyline)) map.addLayer(rData.polyline);
         if (!visible && map.hasLayer(rData.polyline)) map.removeLayer(rData.polyline);
      }
      if (rData.polylineBg) {
         if (visible && !map.hasLayer(rData.polylineBg)) map.addLayer(rData.polylineBg);
         if (!visible && map.hasLayer(rData.polylineBg)) map.removeLayer(rData.polylineBg);
      }
    });

    Object.keys(state.busMarkers).forEach(function (id) {
       var bus = state.latestBusData[id];
       if (!bus) return;
       var marker = state.busMarkers[id];
       var visible = !state.selectedRouteId || state.selectedRouteId === bus.routeId;
       if (visible && !map.hasLayer(marker)) map.addLayer(marker);
       if (!visible && map.hasLayer(marker)) map.removeLayer(marker);
    });

    Object.keys(state.stopMarkers).forEach(function (key) {
      var m = state.stopMarkers[key];
      var visible = !state.selectedRouteId || state.selectedRouteId === m.route.id;
      if (visible && !map.hasLayer(m.marker)) map.addLayer(m.marker);
      if (!visible && map.hasLayer(m.marker)) map.removeLayer(m.marker);
    });
  }

  function buildStopPopup(route, stop) {
    var arriving = Object.values(state.latestBusData).filter(function (b) {
      return b.routeId === route.id && b.nextStopName === stop.name;
    });

    var html = '<div class="popup-title">' + esc(stop.name) + '</div>';
    html += '<div class="popup-route">' + esc(route.name) + '</div>';

    if (arriving.length > 0) {
      html += '<div class="popup-eta">';
      arriving.forEach(function (b) {
        html += 'Автобус №' + esc(route.id) + ': <strong>~' + b.etaMinutes + ' хв</strong><br>';
      });
      html += '</div>';
    } else {
      html += '<div class="popup-eta">Найближчих автобусів немає</div>';
    }

    return html;
  }

  // --- Update handler: move bus markers ---
  function handleUpdate(buses) {
    buses.forEach(function (bus) {
      state.latestBusData[bus.id] = bus;
      var route = state.routes[bus.routeId];
      if (!route) return;

      var marker = state.busMarkers[bus.id];
      var markerHtml = '<div class="bus-marker" style="background:' + route.color + '">' + 
          '<svg class="marker-direction" style="transform: rotate(' + bus.bearing + 'deg)" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L24 22L12 17L0 22L12 2Z"/></svg>' +
          esc(route.id) + '</div>';

      if (!marker) {
        var icon = L.divIcon({
          className: '',
          html: markerHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        marker = L.marker([bus.lat, bus.lon], { icon: icon }).addTo(map);
        marker.bindPopup(buildBusPopup(bus, route));
        state.busMarkers[bus.id] = marker;
      } else {
        marker.setLatLng([bus.lat, bus.lon]);
        marker.setIcon(L.divIcon({ className: '', html: markerHtml, iconSize: [28, 28], iconAnchor: [14, 14] }));
        marker.setPopupContent(buildBusPopup(bus, route));
      }
    });
    updateMapVisibility();
    updateNearestBus();
  }

  function buildBusPopup(bus, route) {
    var html = '<div class="popup-title">Автобус №' + esc(route.id) + '</div>';
    html += '<div class="popup-route">' + esc(route.name) + '</div>';
    html += '<div class="popup-eta">Наступна зупинка: <strong>' + esc(bus.nextStopName) + '</strong><br>';
    html += 'Прибуття через ~' + bus.etaMinutes + ' хв</div>';
    return html;
  }

  // --- Geolocation ---
  function requestGeolocation() {
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      console.warn("Geolocation blocked on insecure connection. Skipping.");
      showSheetPlaceholder('Геолокація вимагає HTTPS. Виберіть зупинку вручну.');
      return;
    }
    if (!navigator.geolocation) {
      showToast('Ваш браузер не підтримує геолокацію.', 'warning');
      return;
    }

    state.watchId = navigator.geolocation.watchPosition(
      function (pos) {
        state.userLat = pos.coords.latitude;
        state.userLon = pos.coords.longitude;
        updateUserMarker();
        updateNearestBus();
      },
      function (err) {
        if (err.code === err.PERMISSION_DENIED) {
          showSheetPlaceholder('Доступ до геолокації заборонено. Найдіть найближчий автобус на карті.');
        } else {
          showSheetPlaceholder('Не вдалося визначити локацію. Перевірте інтернет з\'єднання.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  function updateUserMarker() {
    if (state.userLat === null) return;

    if (!state.userMarker) {
      var icon = L.divIcon({
        className: '',
        html: '<div style="position:relative;"><div class="user-marker__pulse"></div><div class="user-marker"></div></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      state.userMarker = L.marker([state.userLat, state.userLon], { icon: icon, zIndexOffset: 1000 }).addTo(map);
    } else {
      state.userMarker.setLatLng([state.userLat, state.userLon]);
    }
  }

  // --- Distance calculation (Haversine) ---
  function distanceMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // --- Nearest bus detection + sheet update ---
  function updateNearestBus() {
    var buses = Object.values(state.latestBusData);
    if (buses.length === 0) return;

    if (state.userLat !== null) {
      var nearest = null;
      var minDist = Infinity;

      buses.forEach(function (bus) {
        var d = distanceMeters(state.userLat, state.userLon, bus.lat, bus.lon);
        if (d < minDist) {
          minDist = d;
          nearest = bus;
        }
      });

      if (nearest) {
        state.nearestBusId = nearest.id;
        nearest._distMeters = minDist;
        renderSheet(buses, nearest);
        highlightNearestMarker();
      }
    } else {
      renderSheet(buses, null);
    }
  }

  function highlightNearestMarker() {
    Object.keys(state.busMarkers).forEach(function (id) {
      var marker = state.busMarkers[id];
      var el = marker.getElement();
      if (!el) return;
      var inner = el.querySelector('.bus-marker');
      if (!inner) return;
      if (id === state.nearestBusId) {
        inner.classList.add('bus-marker--nearest');
      } else {
        inner.classList.remove('bus-marker--nearest');
      }
    });
  }

  function renderSheet(buses, nearest) {
    var content = document.getElementById('busCardsContainer');

    if (buses.length === 0) {
      content.innerHTML = '<div class="skeleton-list">' +
        '<div class="skeleton-card"><div class="skeleton-header"><div class="skeleton-badge"></div><div class="skeleton-text"></div><div class="skeleton-text short"></div></div></div>' +
        '<div class="skeleton-card"><div class="skeleton-header"><div class="skeleton-badge"></div><div class="skeleton-text"></div><div class="skeleton-text short"></div></div></div>' +
        '<div class="skeleton-card"><div class="skeleton-header"><div class="skeleton-badge"></div><div class="skeleton-text"></div><div class="skeleton-text short"></div></div></div>' +
      '</div>';
      return;
    }

    // Filter: nearest first, then by ETA, matching route and search query
    var visibleBuses = buses.filter(function(b) {
      if (state.selectedRouteId && b.routeId !== state.selectedRouteId) return false;
      if (state.searchQuery) {
        var q = state.searchQuery.toLowerCase();
        var matches = b.upcomingStops.some(function(s) { return s.name.toLowerCase().indexOf(q) > -1; });
        if (!matches) return false;
      }
      return true;
    });

    if (visibleBuses.length === 0) {
      content.innerHTML = '<div class="sheet__placeholder">' +
        '<div class="sheet__placeholder-icon">' +
          '<i data-lucide="search-x" style="width: 32px; height: 32px;"></i>' +
        '</div>' +
        '<p>Ой, такої зупинки не знайдено 🕵️<br>Спробуйте іншу назву.</p>' +
      '</div>';
      if (window.lucide) lucide.createIcons({ root: content });
      return;
    }

    var sorted = visibleBuses.sort(function (a, b) {
      if (nearest && a.id === nearest.id) return -1;
      if (nearest && b.id === nearest.id) return 1;
      return a.etaMinutes - b.etaMinutes;
    }).slice(0, 7); // Task 30: Miller's law, max 7 items

    // 1. Remove placeholders if we have data
    var placeholder = content.querySelector('.sheet__placeholder');
    if (placeholder) placeholder.remove();

    // 2. Remove stale cards
    var validIds = sorted.map(function(b) { return String(b.id); });
    var existingCards = content.querySelectorAll('.bus-card');
    existingCards.forEach(function(card) {
      if (validIds.indexOf(card.getAttribute('data-bus-id')) === -1) {
        card.remove();
      }
    });

    // 3. Update or create cards
    sorted.forEach(function (bus) {
      var route = state.routes[bus.routeId];
      if (!route) return;

      var isNearest = nearest && bus.id === nearest.id;
      var isExpanded = state.expandedBusId === bus.id;
      var distText = bus._distMeters ? formatDistance(bus._distMeters) : '';

      var etaHtml = bus.etaMinutes < 2 
          ? '<span class="status-arriving"><span class="pulse-dot"></span> ' + (bus.etaMinutes === 0 ? 'Прибуває' : '1 хв') + '</span>'
          : '<span style="display: flex; align-items: baseline;">' + bus.etaMinutes + '<span class="bus-card__eta-unit">хв</span></span>';

      var card = content.querySelector('.bus-card[data-bus-id="' + esc(bus.id) + '"]');
      if (!card) {
        card = document.createElement('div');
        card.setAttribute('data-bus-id', bus.id);
        card.addEventListener('click', function() {
          var id = this.getAttribute('data-bus-id');
          state.expandedBusId = state.expandedBusId === id ? null : id;
          renderSheet(Object.values(state.latestBusData), state.nearestBusId ? state.latestBusData[state.nearestBusId] : null);
        });
      }
      
      // Ensure correct order in DOM
      content.appendChild(card);

      card.className = 'bus-card' + (isNearest ? ' bus-card--nearest' : '') + (isExpanded ? ' bus-card--expanded' : '');


      var innerHtml = '<div class="bus-card__content">';


      if (isNearest) {
        innerHtml += '<div class="bus-card__nearest-label">★ Найближчий автобус</div>';
      }
      innerHtml += '<div class="bus-card__header">';
      innerHtml += '<div class="bus-card__route-chip">';
      innerHtml += '<span class="bus-card__badge" style="background:' + route.color + '">' + esc(route.id) + '</span>';
      innerHtml += '<span class="bus-card__route-name">' + esc(route.name) + '</span>';
      innerHtml += '</div>';
      innerHtml += '<span class="bus-card__eta" aria-live="polite">' + etaHtml + '</span>';
      innerHtml += '<span class="bus-card__chevron"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>';
      innerHtml += '</div>';
      innerHtml += '<div class="bus-card__details">';
      innerHtml += '<span class="bus-card__detail">';
      innerHtml += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z"/></svg>';
      innerHtml += esc(bus.nextStopName);
      innerHtml += '</span>';
      if (distText) {
        innerHtml += '<span class="bus-card__detail">';
        innerHtml += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        innerHtml += distText;
        innerHtml += '</span>';
      }
      innerHtml += '</div>';
      
      innerHtml += '<div class="bus-timeline">';
      if (bus.upcomingStops) {
        bus.upcomingStops.forEach(function(s, idx) {
           var activeClass = idx === 0 ? ' timeline-node--active' : '';
           var tEta = s.etaMinutes === 0 ? 'Зараз' : s.etaMinutes + ' хв';
           innerHtml += '<div class="timeline-node' + activeClass + '">';
           innerHtml += '<span class="timeline-node__time">' + tEta + '</span>';
           innerHtml += '<span class="timeline-node__dot"></span>';
           innerHtml += '<span class="timeline-node__name">' + esc(s.name) + '</span>';
           innerHtml += '</div>';
        });
      }
      innerHtml += '</div>';

      // Only update DOM if HTML actually changed
      if (card.innerHTML !== innerHtml) {
        
      innerHtml += '</div>'; // close bus-card__content
card.innerHTML = innerHtml;
      }
    });
  }

  function formatDistance(m) {
    if (m < 1000) return Math.round(m) + ' м';
    return (m / 1000).toFixed(1) + ' км';
  }

  function showSheetPlaceholder(msg) {
    document.getElementById('busCardsContainer').innerHTML =
      '<div class="sheet__placeholder"><p>' + esc(msg) + '</p></div>';
  }

  // --- Bottom sheet interactions ---
  var sheet = document.getElementById('sheet');
  var sheetHandle = sheet.querySelector('.sheet__handle');
  var sheetContent = sheet.querySelector('.sheet__content');

  sheetHandle.addEventListener('click', function () {
    toggleSheet();
  });

  // Touch swipe support
  var touchStartY = 0;
  var touchCurrentY = 0;
  var isDragging = false;

  sheet.addEventListener('touchstart', function (e) {
    // Only start drag if touching the handle area or the sheet is collapsed
    var rect = sheet.getBoundingClientRect();
    var touchY = e.touches[0].clientY;
    var handleArea = touchY - rect.top < 60;

    if (handleArea || !state.sheetExpanded) {
      touchStartY = e.touches[0].clientY;
      isDragging = true;
      sheet.classList.add('sheet--dragging');
    }
  }, { passive: true });

  sheet.addEventListener('touchmove', function (e) {
    if (!isDragging) return;
    touchCurrentY = e.touches[0].clientY;
    var delta = touchCurrentY - touchStartY;
    var rect = sheet.getBoundingClientRect();
    var sheetHeight = rect.height;
    // Calculate the actual collapsed position dynamically based on search container height
    var safeBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0;
    if (!safeBottom) {
      // Fallback: read from env via a temp element
      var temp = document.createElement('div');
      temp.style.height = 'env(safe-area-inset-bottom, 0px)';
      document.body.appendChild(temp);
      safeBottom = temp.offsetHeight || 0;
      document.body.removeChild(temp);
    }
    var collapsedY = sheetHeight - 84 - safeBottom; 
    var currentTransform = 0;
    if (state.sheetMode === 'collapsed') currentTransform = collapsedY;
    else if (state.sheetMode === 'half') currentTransform = collapsedY / 2;
    else currentTransform = 0;
    
    var newTransform = currentTransform + delta;

    if (newTransform < 0) {
       // Add resistance when pulling up past expanded state
       newTransform = newTransform * 0.3;
    }
    if (newTransform > collapsedY) newTransform = collapsedY;

    sheet.style.transform = 'translateY(' + newTransform + 'px)';
  }, { passive: true });

  sheet.addEventListener('touchend', function (e) {
    if (!isDragging) return;
    isDragging = false;
    sheet.classList.remove('sheet--dragging');
    sheet.style.transform = '';

    var delta = touchCurrentY - touchStartY;
    var threshold = 40;

    if (delta < -threshold) {
      // Swipe up
      if (state.sheetMode === 'collapsed') setSheetMode('half');
      else if (state.sheetMode === 'half') setSheetMode('expanded');
    } else if (delta > threshold) {
      // Swipe down
      if (state.sheetMode === 'expanded') setSheetMode('half');
      else if (state.sheetMode === 'half') setSheetMode('collapsed');
    }
  }, { passive: true });

  // Default mode
  state.sheetMode = 'collapsed';
  function setSheetMode(mode) {
    if (window.innerWidth >= 768) return; // Disable on iPad/desktop
    state.sheetMode = mode;
    state.sheetExpanded = (mode === 'expanded');
    sheet.classList.remove('sheet--collapsed', 'sheet--half', 'sheet--expanded');
    sheet.classList.add('sheet--' + mode);
    window.trackEvent('sheet_mode_changed', { mode: mode });
  }

  function toggleSheet() {
    if (state.sheetMode === 'collapsed') setSheetMode('half');
    else if (state.sheetMode === 'half') setSheetMode('expanded');
    else setSheetMode('collapsed');
  }

  // --- Search Bar ---
  var stopSearch = document.getElementById('stopSearch');
  var searchClearBtn = document.getElementById('searchClearBtn');
  var recentSearchesDiv = document.getElementById('recentSearches');
  
  if (stopSearch) {
    stopSearch.addEventListener('input', function (e) {
      state.searchQuery = e.target.value;
      if (searchClearBtn) {
        if (state.searchQuery.length > 0) {
          searchClearBtn.removeAttribute('hidden');
          if (recentSearchesDiv) recentSearchesDiv.setAttribute('hidden', '');
        } else {
          searchClearBtn.setAttribute('hidden', '');
          renderRecentSearches();
        }
      }
      updateNearestBus();
    });
    
    stopSearch.addEventListener('focus', function(e) {
      if (state.searchQuery.length === 0) {
        renderRecentSearches();
      }
    });
    
    stopSearch.addEventListener('blur', function(e) {
      // Delay hiding to allow click on recent search item
      setTimeout(function() {
        if (recentSearchesDiv && !recentSearchesDiv.contains(document.activeElement)) {
          recentSearchesDiv.setAttribute('hidden', '');
        }
      }, 200);
      if (state.searchQuery.length > 0) {
        saveRecentSearch(state.searchQuery);
        window.trackEvent('search_stop', { query: state.searchQuery });
      }
    });
  }
  
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', function() {
      if (stopSearch) {
        stopSearch.value = '';
        state.searchQuery = '';
        searchClearBtn.setAttribute('hidden', '');
        updateNearestBus();
        stopSearch.focus();
        renderRecentSearches();
      }
    });
  }

  var menuBtn = document.getElementById('menuBtn');
  var menuPopup = document.getElementById('menuPopup');
  if (menuBtn && menuPopup) {
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var isHidden = menuPopup.hasAttribute('hidden');
      if (isHidden) {
        menuPopup.removeAttribute('hidden');
      } else {
        menuPopup.setAttribute('hidden', '');
      }
    });
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!menuPopup.hasAttribute('hidden') && !menuPopup.contains(e.target) && e.target !== menuBtn) {
        menuPopup.setAttribute('hidden', '');
      }
    });
  }

  // --- Locate button ---
  var fabLocate = document.getElementById('fabLocate');
  if (fabLocate) {
    fabLocate.addEventListener('click', function () {
      if (state.userLat !== null && state.userMarker) {
        map.setView([state.userLat, state.userLon], 16, { animate: true });
      } else {
        requestGeolocation();
      }
    });
  }



  // --- Utility ---
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // --- Service worker (PWA) ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // --- Start ---
  startSimulation();

  // Request native geolocation after slight delay
  setTimeout(function () {
    if (state.userLat === null) {
      requestGeolocation();
    }
  }, 800);


  // --- Toast Notifications ---
  function showToast(message, isOffline = false) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    
    var toast = document.createElement('div');
    toast.className = 'toast' + (isOffline ? ' toast--offline' : '');
    
    var iconHtml = isOffline 
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 9.86a10.94 10.94 0 0 0-2 1.4M8.56 5.56A10.94 10.94 0 0 1 12 5c3.31 0 6.28 1.48 8.3 3.82M5 5.5A10.94 10.94 0 0 0 1.7 9.32"></path></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      
    toast.innerHTML = iconHtml + '<span>' + esc(message) + '</span>';
    container.appendChild(toast);
    
    setTimeout(function() {
      toast.style.animation = 'slideUpToast 0.3s reverse forwards';
      setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
  }

  window.addEventListener('offline', function() {
    showToast('Офлайн. Показано останні збережені дані', true);
  });

  window.addEventListener('online', function() {
    showToast('Зʼєднання відновлено', false);
  });
  
  // Make it globally available for testing or other modules if needed
  window.showToast = showToast;

  // --- Onboarding (Task 67) ---
  if (!localStorage.getItem('onboarded')) {
    var handle = document.querySelector('.sheet__handle');
    if (handle) {
      var tooltip = document.createElement('div');
      tooltip.className = 'onboarding-tooltip';
      tooltip.textContent = 'Потягніть вгору';
      handle.parentNode.insertBefore(tooltip, handle.nextSibling);
      
      // Hide on first interaction
      var hideOnboarding = function() {
        tooltip.style.opacity = '0';
        setTimeout(function() { tooltip.remove(); }, 300);
        localStorage.setItem('onboarded', 'true');
        sheet.removeEventListener('touchstart', hideOnboarding);
        sheet.removeEventListener('mousedown', hideOnboarding);
      };
      
      var sheet = document.getElementById('sheet');
      sheet.addEventListener('touchstart', hideOnboarding, { once: true });
      sheet.addEventListener('mousedown', hideOnboarding, { once: true });
    }
  }

  // --- Recent Searches (Task 71) ---
  var recentSearchesDiv = document.getElementById('recentSearches');
  function getRecentSearches() {
    try {
      var arr = JSON.parse(localStorage.getItem('recentSearches'));
      return Array.isArray(arr) ? arr : [];
    } catch(e) { return []; }
  }
  function saveRecentSearch(q) {
    if (!q || q.length < 2) return;
    var arr = getRecentSearches();
    arr = arr.filter(function(item) { return item.toLowerCase() !== q.toLowerCase(); });
    arr.unshift(q);
    if (arr.length > 3) arr.pop();
    localStorage.setItem('recentSearches', JSON.stringify(arr));
  }
  function renderRecentSearches() {
    var arr = getRecentSearches();
    if (arr.length === 0) {
      recentSearchesDiv.setAttribute('hidden', '');
      return;
    }
    var html = '<div class="recent-search-title">Недавні пошуки</div>';
    arr.forEach(function(item) {
      html += '<div class="recent-search-item" data-q="' + esc(item) + '">';
      html += '<i data-lucide="clock" style="width: 14px; height: 14px; color: var(--text-secondary)"></i>';
      html += '<span>' + esc(item) + '</span></div>';
    });
    recentSearchesDiv.innerHTML = html;
    recentSearchesDiv.removeAttribute('hidden');
    if (window.lucide) lucide.createIcons({ root: recentSearchesDiv });
    
    var items = recentSearchesDiv.querySelectorAll('.recent-search-item');
    items.forEach(function(el) {
      el.addEventListener('click', function(e) {
        var q = this.getAttribute('data-q');
        var stopSearch = document.getElementById('stopSearch');
        if (stopSearch) {
           stopSearch.value = q;
           state.searchQuery = q;
           recentSearchesDiv.setAttribute('hidden', '');
           document.getElementById('searchClearBtn').removeAttribute('hidden');
           updateNearestBus();
        }
      });
    });
  }

  // --- Pull to Refresh (Task 56) ---
  var sheetContent = document.getElementById('sheetContent');
  var ptrStartY = 0;
  var ptrCurrentY = 0;
  var ptrRefreshing = false;
  var ptrThreshold = 60;
  
  if (sheetContent) {
    var ptrIndicator = document.createElement('div');
    ptrIndicator.className = 'ptr-indicator';
    ptrIndicator.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-1.45"/></svg>';
    sheetContent.parentNode.insertBefore(ptrIndicator, sheetContent);
    
    sheetContent.addEventListener('touchstart', function(e) {
      if (sheetContent.scrollTop === 0) {
        ptrStartY = e.touches[0].clientY;
      } else {
        ptrStartY = 0;
      }
    }, {passive: true});
    
    sheetContent.addEventListener('touchmove', function(e) {
      if (!ptrStartY || ptrRefreshing) return;
      var y = e.touches[0].clientY;
      var dy = y - ptrStartY;
      if (dy > 0) {
        ptrCurrentY = dy;
        ptrIndicator.style.transform = 'translateY(' + Math.min(dy, ptrThreshold) + 'px) rotate(' + (dy * 2) + 'deg)';
        ptrIndicator.style.opacity = Math.min(dy / ptrThreshold, 1);
      }
    }, {passive: true});
    
    sheetContent.addEventListener('touchend', function(e) {
      if (!ptrStartY || ptrRefreshing) return;
      if (ptrCurrentY > ptrThreshold) {
        ptrRefreshing = true;
        ptrIndicator.classList.add('ptr-refreshing');
        
        // Trigger update
        updateNearestBus();
        
        setTimeout(function() {
          ptrRefreshing = false;
          ptrIndicator.classList.remove('ptr-refreshing');
          ptrIndicator.style.transform = 'translateY(0)';
          ptrIndicator.style.opacity = '0';
          showToast('Дані оновлено');
        }, 1000);
      } else {
        ptrIndicator.style.transform = 'translateY(0)';
        ptrIndicator.style.opacity = '0';
      }
      ptrStartY = 0;
      ptrCurrentY = 0;
    });
  }




  // --- Accessibility: Escape key (Task 105) ---
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var searchInput = document.getElementById('stopSearch');
      if (document.activeElement === searchInput && searchInput.value) {
        var clearBtn = document.getElementById('searchClearBtn');
        if (clearBtn) clearBtn.click();
      } else if (state.expandedBusId) {
        state.expandedBusId = null;
        updateNearestBus();
      } else if (sheet.classList.contains('sheet--expanded')) {
        setSheetState('half');
      } else if (sheet.classList.contains('sheet--half')) {
        setSheetState('collapsed');
      }
    }
  });

  // --- Menu Buttons Logic ---
  var menuBtn3D = document.getElementById('menuBtn3D');
  var menuBtnGlobe = document.getElementById('menuBtnGlobe');
  var menuBtnAbout = document.getElementById('menuBtnAbout');
  var menuBtnFeedback = document.getElementById('menuBtnFeedback');
  var menuPopup = document.getElementById('menuPopup');
  
  var satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  var satelliteLayer = L.tileLayer(satelliteUrl, {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
  });
  var isSatellite = false;

  if (menuBtn3D) {
    menuBtn3D.addEventListener('click', function() {
      document.getElementById('map').classList.toggle('map-3d');
      var isActive = document.getElementById('map').classList.contains('map-3d');
      menuBtn3D.classList.toggle('map-btn--active', isActive);
      showToast(isActive ? '3D Режим увімкнено' : '3D Режим вимкнено');
    });
  }

  if (menuBtnGlobe) {
    menuBtnGlobe.addEventListener('click', function() {
      if (isSatellite) {
        map.removeLayer(satelliteLayer);
        isSatellite = false;
        menuBtnGlobe.classList.remove('map-btn--active');
        showToast('Переключено на Схему');
      } else {
        map.addLayer(satelliteLayer);
        isSatellite = true;
        menuBtnGlobe.classList.add('map-btn--active');
        showToast('Переключено на Супутник');
      }
    });
  }

  if (menuBtnAbout) {
    menuBtnAbout.addEventListener('click', function() {
      showToast('Вінниця Транспорт v1.0.0\\nРозроблено на Smart City Hackathon.');
      menuPopup.hidden = true;
    });
  }

  if (menuBtnFeedback) {
    menuBtnFeedback.addEventListener('click', function() {
      showToast("Відкрито форму зворотнього зв'язку");
      menuPopup.hidden = true;
    });
  }

})();