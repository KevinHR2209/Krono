function parseWeight(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Pesos: historial 60, distancia 40
const DEFAULT_WEIGHTS = {
  w1: parseWeight(process.env.W1, 0.6),
  w2: parseWeight(process.env.W2, 0.4)
};

// Implementación de la fórmula de Haversine
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 15; // Penalización máxima si faltan datos

  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function enrichCandidates(waitlist, shopLat, shopLon, customWeights = DEFAULT_WEIGHTS) {
  const MAX_DISTANCE_KM = 15; // Distancia límite para puntuar

  return waitlist.map((candidate) => {
    const historialAsistenciaNormalizado = Number(candidate.attendance_history.toFixed(5));

    // Calcular distancia real
    const distanceKm = haversineDistance(shopLat, shopLon, candidate.latitud, candidate.longitud);

    // Normalizar: 0km = 1.0 pt, 15km o más = 0.0 pts
    let distanciaNormalizada = 1 - (distanceKm / MAX_DISTANCE_KM);
    if (distanciaNormalizada < 0) distanciaNormalizada = 0;
    distanciaNormalizada = Number(distanciaNormalizada.toFixed(5));

    const puntajePrioridad = Number(
        (
            (customWeights.w1 * historialAsistenciaNormalizado) +
            (customWeights.w2 * distanciaNormalizada)
        ).toFixed(5)
    );

    return {
      ...candidate,
      distancia_km: Number(distanceKm.toFixed(2)),
      historial_asistencia_normalizado: historialAsistenciaNormalizado,
      distancia_normalizada: distanciaNormalizada,
      puntaje_prioridad: puntajePrioridad
    };
  });
}

function rankCandidates(waitlist, shopLat, shopLon, customWeights = DEFAULT_WEIGHTS) {
  return enrichCandidates(waitlist, shopLat, shopLon, customWeights)
      .sort((a, b) => b.puntaje_prioridad - a.puntaje_prioridad)
      .map((candidate, index) => ({
        ...candidate,
        posicion_ranking: index + 1
      }));
}

function selectTopCandidates(waitlist, shopLat, shopLon, limit = 5, customWeights = DEFAULT_WEIGHTS) {
  return rankCandidates(waitlist, shopLat, shopLon, customWeights).slice(0, limit);
}

module.exports = {
  DEFAULT_WEIGHTS,
  haversineDistance,
  enrichCandidates,
  rankCandidates,
  selectTopCandidates
};