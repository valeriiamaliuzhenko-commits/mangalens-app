const _jobs = {};
const _listeners = new Set();

export function getBulkJob(mangaId) {
  return _jobs[String(mangaId)] || null;
}

export function setBulkJob(mangaId, job) {
  _jobs[String(mangaId)] = job;
  _listeners.forEach(fn => fn());
}

export function subscribeBulkJobs(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}