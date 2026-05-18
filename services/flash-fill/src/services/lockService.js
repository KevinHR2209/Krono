const { redis } = require('../config/redis');

const LOCK_TTL_SECONDS = 120;

function buildAuctionLockKey(auctionId) {
  return `auction:lock:${auctionId}`;
}

async function tryAcquireAuctionLock({ auctionId, patientId }) {
  const key = buildAuctionLockKey(auctionId);
  const value = JSON.stringify({
    patient_id: patientId,
    acquired_at: new Date().toISOString()
  });

  const result = await redis.set(key, value, 'NX', 'EX', LOCK_TTL_SECONDS);

  if (result === 'OK') {
    return {
      lockAcquired: true,
      lockKey: key,
      status: 'winner'
    };
  }

  const existingLockValue = await redis.get(key);

  return {
    lockAcquired: false,
    lockKey: key,
    status: 'loser',
    existingLockValue: existingLockValue ? JSON.parse(existingLockValue) : null
  };
}

module.exports = {
  tryAcquireAuctionLock,
  buildAuctionLockKey,
  LOCK_TTL_SECONDS
};