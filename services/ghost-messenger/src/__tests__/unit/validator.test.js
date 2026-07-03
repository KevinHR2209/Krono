function isValidJob(data) {
  return !!(data?.auction_id && data?.appointment_id && data?.slot && Array.isArray(data?.candidates) && data.candidates.length > 0);
}

describe('isValidJob', () => {
  test('retorna true con payload válido', () => {
    expect(isValidJob({ auction_id: 'a', appointment_id: 'b', slot: {}, candidates: [{}] })).toBe(true);
  });

  test('retorna false sin slot', () => {
    expect(isValidJob({ auction_id: 'a', appointment_id: 'b', candidates: [{}] })).toBe(false);
  });

  test('retorna false sin candidatos', () => {
    expect(isValidJob({ auction_id: 'a', appointment_id: 'b', slot: {} })).toBe(false);
  });
});