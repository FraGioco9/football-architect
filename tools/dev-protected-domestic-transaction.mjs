// I03 pure reversible transaction coordinator. Never updates live source on import.
export function prepareProtectedDomesticTransaction(payload, presenter) {
  if (!payload || payload.clubs?.length !== 16 ||
      payload.standings?.length !== 16 || payload.fixtures?.length !== 240) {
    throw new Error("Invalid protected domestic snapshot");
  }
  if (typeof presenter?.prepare !== "function") throw new Error("Shared presenter is unavailable");
  const transaction = presenter.prepare(payload);
  if (typeof transaction?.commit !== "function" ||
      typeof transaction?.rollback !== "function") throw new Error("Presenter must support rollback");
  let used = false;
  return Object.freeze({
    commit() {
      if (used) throw new Error("Already committed");
      used = true;
      try { transaction.commit(); }
      catch (error) { transaction.rollback(); throw error; }
    },
    rollback() { transaction.rollback(); }
  });
}
