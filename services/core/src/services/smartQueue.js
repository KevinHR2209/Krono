function parseWeight(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const DEFAULT_WEIGHTS = {
  w1: parseWeight(process.env.W1, 0.4),
  w2: parseWeight(process.env.W2, 0.3),
  w3: parseWeight(process.env.W3, 0.3)
};

function normalizeRange(value, min, max) {
  if (max === min) {
    return 1;
  }

  return (value - min) / (max - min);
}

function enrichCandidates(waitlist, customWeights = DEFAULT_WEIGHTS) {
  const waitingDaysValues = waitlist.map((candidate) => candidate.waiting_days);
  const maxWaitingDays = Math.max(...waitingDaysValues);
  const minWaitingDays = Math.min(...waitingDaysValues);

  return waitlist.map((candidate) => {
    const historialAsistenciaNormalizado = Number(candidate.attendance_history.toFixed(5));
    const diasEsperaNormalizado = Number(
      normalizeRange(candidate.waiting_days, minWaitingDays, maxWaitingDays).toFixed(5)
    );
    const nivelUrgenciaNormalizado = Number(
      ((candidate.urgency_level - 1) / 3).toFixed(5)
    );

    const puntajePrioridad = Number(
      (
        (customWeights.w1 * historialAsistenciaNormalizado) +
        (customWeights.w2 * diasEsperaNormalizado) +
        (customWeights.w3 * nivelUrgenciaNormalizado)
      ).toFixed(5)
    );

    return {
      ...candidate,
      historial_asistencia_normalizado: historialAsistenciaNormalizado,
      dias_espera_normalizado: diasEsperaNormalizado,
      nivel_urgencia_normalizado: nivelUrgenciaNormalizado,
      puntaje_prioridad: puntajePrioridad
    };
  });
}

function rankCandidates(waitlist, customWeights = DEFAULT_WEIGHTS) {
  return enrichCandidates(waitlist, customWeights)
    .sort((a, b) => b.puntaje_prioridad - a.puntaje_prioridad)
    .map((candidate, index) => ({
      ...candidate,
      posicion_ranking: index + 1
    }));
}

function selectTopCandidates(waitlist, limit = 5, customWeights = DEFAULT_WEIGHTS) {
  return rankCandidates(waitlist, customWeights).slice(0, limit);
}

module.exports = {
  DEFAULT_WEIGHTS,
  enrichCandidates,
  rankCandidates,
  selectTopCandidates
};