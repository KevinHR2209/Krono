process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://krono_user:krono_password@localhost:5432/krono_db';

jest.mock('pg', () => {
  // Cliente que usa auctionResolver internamente
  const mClient = {
    query:   jest.fn().mockRejectedValue(new Error('DB down')),
    release: jest.fn()
  };

  // Pool que devuelve ese cliente al hacer connect()
  const mPool = {
    connect: jest.fn().mockResolvedValue(mClient),
    end:     jest.fn(),
    on:      jest.fn() // para que config/database pueda hacer pool.on('error', ...)
  };

  return { Pool: jest.fn(() => mPool) };
});

describe('auctionResolver - fallas de BD', () => {
  test('lanza error si la BD está caída', async () => {
    jest.resetModules();
    const { resolveAuctionWinner } = require('../../services/auctionResolver');

    await expect(
      resolveAuctionWinner({
        auctionId:     'auction-001',
        patientId:     'patient-001',
        appointmentId: 'appt-001'
      })
    ).rejects.toThrow('DB down');
  });
});