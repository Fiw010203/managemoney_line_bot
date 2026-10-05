const CONFIRM_TTL_MS = 5 * 60 * 1000;
const pendingConfirmations = new Map();

function getPending(userId) {
  const entry = pendingConfirmations.get(userId);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    pendingConfirmations.delete(userId);
    return null;
  }

  return {
    type: entry.type || 'TRANSACTION',
    data: entry.data,
  };
}

function setPending(userId, data, type = 'TRANSACTION') {
  pendingConfirmations.set(userId, {
    data,
    type,
    expiresAt: Date.now() + CONFIRM_TTL_MS,
  });
}

function clearPending(userId) {
  pendingConfirmations.delete(userId);
}

module.exports = {
  clearPending,
  getPending,
  setPending,
};
