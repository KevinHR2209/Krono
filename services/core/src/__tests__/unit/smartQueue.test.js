const {
  haversineDistance,
  enrichCandidates,
  rankCandidates,
  selectTopCandidates,
  DEFAULT_WEIGHTS
} = require('../../services/smartQueue');

// ─── Fixtures ─────────────────────────────────────────────────
const SHOP_LAT = -33.4489; // Santiago centro
const SHOP_LON = -70.6693;

const makeCandidates = (overrides = []) =>
  overrides.map((o, i) => ({
    patient_id: `patient-${i + 1}`,
    display_name: `Paciente ${i + 1}`,
    phone: `+5699900000${i}`,
    attendance_history: 0.5,
    latitud: null,
    longitud: null,
    ...o
  }));

// ─── haversineDistance ─────────────────────────────────────────
describe('haversineDistance', () => {
  test('calcula distancia real Santiago ↔ Valparaíso (~110 km)', () => {
    const dist = haversineDistance(-33.4489, -70.6693, -33.0472, -71.6127);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });

  test('retorna 15 (penalización máxima) si lat1 es null', () => {
    expect(haversineDistance(null, -70.6693, -33.0472, -71.6127)).toBe(15);
  });

  test('retorna 15 si lon2 es null', () => {
    expect(haversineDistance(-33.4489, -70.6693, -33.0472, null)).toBe(15);
  });

  test('retorna 15 si todos los argumentos son null', () => {
    expect(haversineDistance(null, null, null, null)).toBe(15);
  });

  test('retorna 0 si los dos puntos son idénticos', () => {
    expect(haversineDistance(-33.4489, -70.6693, -33.4489, -70.6693)).toBeCloseTo(0, 3);
  });

  test('distancia es siempre positiva', () => {
    const dist = haversineDistance(-33.4489, -70.6693, -22.9068, -43.1729);
    expect(dist).toBeGreaterThan(0);
  });
});

// ─── enrichCandidates ─────────────────────────────────────────
describe('enrichCandidates', () => {
  test('candidato a 0km → distancia_normalizada = 1.0', () => {
    const candidates = makeCandidates([
      { latitud: SHOP_LAT, longitud: SHOP_LON, attendance_history: 0.8 }
    ]);
    const [result] = enrichCandidates(candidates, SHOP_LAT, SHOP_LON);
    expect(result.distancia_normalizada).toBeCloseTo(1.0, 2);
  });

  test('candidato con lat/lon null → distancia_normalizada = 0.0 (penalización)', () => {
    const candidates = makeCandidates([
      { latitud: null, longitud: null, attendance_history: 0.5 }
    ]);
    const [result] = enrichCandidates(candidates, SHOP_LAT, SHOP_LON);
    expect(result.distancia_normalizada).toBe(0);
  });

  test('candidato a 30km → distancia_normalizada = 0.0 (no negativo)', () => {
    // lat/lon aprox 30km de Santiago
    const candidates = makeCandidates([
      { latitud: -33.7184, longitud: -70.6693, attendance_history: 0.5 }
    ]);
    const [result] = enrichCandidates(candidates, SHOP_LAT, SHOP_LON);
    expect(result.distancia_normalizada).toBe(0);
  });

  test('puntaje_prioridad = w1*historial + w2*distancia', () => {
    const candidates = makeCandidates([
      { latitud: SHOP_LAT, longitud: SHOP_LON, attendance_history: 1.0 }
    ]);
    const [result] = enrichCandidates(candidates, SHOP_LAT, SHOP_LON, { w1: 0.6, w2: 0.4 });
    const expected = Number((0.6 * 1.0 + 0.4 * 1.0).toFixed(5));
    expect(result.puntaje_prioridad).toBeCloseTo(expected, 4);
  });

  test('agrega campos distancia_km, historial_asistencia_normalizado, distancia_normalizada, puntaje_prioridad', () => {
    const candidates = makeCandidates([{ attendance_history: 0.5 }]);
    const [result] = enrichCandidates(candidates, SHOP_LAT, SHOP_LON);
    expect(result).toHaveProperty('distancia_km');
    expect(result).toHaveProperty('historial_asistencia_normalizado');
    expect(result).toHaveProperty('distancia_normalizada');
    expect(result).toHaveProperty('puntaje_prioridad');
  });

  test('no muta el array original', () => {
    const candidates = makeCandidates([{ attendance_history: 0.5 }]);
    const original = JSON.stringify(candidates);
    enrichCandidates(candidates, SHOP_LAT, SHOP_LON);
    expect(JSON.stringify(candidates)).toBe(original);
  });
});

// ─── rankCandidates ────────────────────────────────────────────
describe('rankCandidates', () => {
  test('ordena de mayor a menor puntaje_prioridad', () => {
    const candidates = makeCandidates([
      { attendance_history: 0.1, latitud: null, longitud: null }, // puntaje bajo
      { attendance_history: 1.0, latitud: SHOP_LAT, longitud: SHOP_LON }, // puntaje alto
      { attendance_history: 0.5, latitud: null, longitud: null } // puntaje medio
    ]);
    const ranked = rankCandidates(candidates, SHOP_LAT, SHOP_LON);
    expect(ranked[0].puntaje_prioridad).toBeGreaterThanOrEqual(ranked[1].puntaje_prioridad);
    expect(ranked[1].puntaje_prioridad).toBeGreaterThanOrEqual(ranked[2].puntaje_prioridad);
  });

  test('posicion_ranking empieza en 1', () => {
    const candidates = makeCandidates([{ attendance_history: 0.5 }]);
    const [first] = rankCandidates(candidates, SHOP_LAT, SHOP_LON);
    expect(first.posicion_ranking).toBe(1);
  });

  test('posicion_ranking es secuencial y único', () => {
    const candidates = makeCandidates([
      { attendance_history: 0.9 },
      { attendance_history: 0.5 },
      { attendance_history: 0.1 }
    ]);
    const ranked = rankCandidates(candidates, SHOP_LAT, SHOP_LON);
    const positions = ranked.map((c) => c.posicion_ranking);
    expect(positions).toEqual([1, 2, 3]);
  });

  test('lista vacía → retorna []', () => {
    expect(rankCandidates([], SHOP_LAT, SHOP_LON)).toEqual([]);
  });

  test('lista de 1 candidato → posicion_ranking = 1', () => {
    const candidates = makeCandidates([{ attendance_history: 0.8 }]);
    const [result] = rankCandidates(candidates, SHOP_LAT, SHOP_LON);
    expect(result.posicion_ranking).toBe(1);
  });
});

// ─── selectTopCandidates ──────────────────────────────────────
describe('selectTopCandidates', () => {
  test('retorna máximo 5 candidatos con limit=5', () => {
    const candidates = makeCandidates(
      Array.from({ length: 10 }, (_, i) => ({ attendance_history: i * 0.1 }))
    );
    const top = selectTopCandidates(candidates, SHOP_LAT, SHOP_LON, 5);
    expect(top).toHaveLength(5);
  });

  test('retorna todos si hay menos de 5', () => {
    const candidates = makeCandidates([
      { attendance_history: 0.9 },
      { attendance_history: 0.5 }
    ]);
    const top = selectTopCandidates(candidates, SHOP_LAT, SHOP_LON, 5);
    expect(top).toHaveLength(2);
  });

  test('el primero del top tiene el mayor puntaje', () => {
    const candidates = makeCandidates([
      { attendance_history: 0.1 },
      { attendance_history: 1.0, latitud: SHOP_LAT, longitud: SHOP_LON },
      { attendance_history: 0.5 }
    ]);
    const top = selectTopCandidates(candidates, SHOP_LAT, SHOP_LON, 3);
    expect(top[0].puntaje_prioridad).toBeGreaterThan(top[1].puntaje_prioridad);
  });

  test('respeta el límite personalizado', () => {
    const candidates = makeCandidates(
      Array.from({ length: 8 }, (_, i) => ({ attendance_history: i * 0.1 }))
    );
    const top = selectTopCandidates(candidates, SHOP_LAT, SHOP_LON, 3);
    expect(top).toHaveLength(3);
  });
});

// ─── DEFAULT_WEIGHTS ──────────────────────────────────────────
describe('DEFAULT_WEIGHTS', () => {
  test('w1 + w2 = 1.0', () => {
    expect(DEFAULT_WEIGHTS.w1 + DEFAULT_WEIGHTS.w2).toBeCloseTo(1.0, 5);
  });

  test('w1 = 0.6 y w2 = 0.4 por defecto', () => {
    expect(DEFAULT_WEIGHTS.w1).toBe(0.6);
    expect(DEFAULT_WEIGHTS.w2).toBe(0.4);
  });
});