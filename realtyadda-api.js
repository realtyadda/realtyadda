/* Public reads only: short-lived cache, shared requests and navigation preloading. */
(function () {
'use strict';
const url = 'https://script.google.com/macros/s/AKfycbx5bibvXrCBKZ9LsSdIHEaLD5u7UH5m4FPf7IH9nOijFNlEOPVYbFVH-AZu9oxLyT6u/exec';
const prefix = 'ra-public-v3:';
const ttl = 60000;
const memory = new Map(), pending = new Map();
const copy = value => JSON.parse(JSON.stringify(value));
function key(params) {
  return prefix + JSON.stringify(Object.entries(params).filter(([, v]) => v !== '' && v != null).map(([k,v]) => [k,String(v)]).sort(([a],[b]) => a.localeCompare(b)));
}
function cacheable(params) { return ['listings','property','cover'].includes(params.action); }
function peek(params) {
  if (!cacheable(params)) return null;
  const id = key(params);
  try {
    const entry = memory.get(id) || JSON.parse(sessionStorage.getItem(id) || 'null');
    if (entry && Date.now() >= entry.at && Date.now() - entry.at < ttl) return copy(entry.data);
    memory.delete(id); sessionStorage.removeItem(id);
  } catch (_) { /* Storage can be disabled or full. Network reads still work. */ }
  return null;
}
function remember(params, data) {
  if (!cacheable(params) || !data || data.status !== 'success') return;
  const id = key(params), entry = {at: Date.now(), data: copy(data)};
  memory.set(id, entry);
  if (memory.size > 30) memory.delete(memory.keys().next().value);
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const name = sessionStorage.key(i);
      if (name && name.startsWith(prefix)) {
        const saved = JSON.parse(sessionStorage.getItem(name) || 'null');
        if (!saved || Date.now() - saved.at >= ttl) sessionStorage.removeItem(name);
      }
    }
    sessionStorage.setItem(id, JSON.stringify(entry));
  } catch (_) { /* Keep in-memory cache when the browser storage quota is reached. */ }
}
function request(params, timeout) {
  return new Promise((resolve, reject) => {
    const callback = 'ra_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let timer, settled = false;
    function finish(error, data) {
      if (settled) return;
      settled = true; clearTimeout(timer); script.remove();
      window[callback] = () => {};
      setTimeout(() => { delete window[callback]; }, 120000);
      if (error) reject(error); else resolve(data);
    }
    window[callback] = data => finish(null, data);
    script.onerror = () => finish(new Error('Connection failed. Please retry.'));
    const target = new URL(url);
    Object.entries(params).forEach(([k,v]) => target.searchParams.set(k,v));
    target.searchParams.set('callback',callback);
    target.searchParams.set('_',Date.now());
    timer = setTimeout(() => finish(new Error('Connection timed out. Please retry.')),timeout);
    script.src = target.toString(); document.head.appendChild(script);
  });
}
function read(params, timeout = 35000, options = {}) {
  const cached = !options.fresh && peek(params);
  if (cached) return Promise.resolve(cached);
  const id = key(params);
  if (!pending.has(id)) {
    pending.set(id, request(params,timeout).then(data => {
      if (data && data.status === 'not_found') {
        memory.delete(id);
        try { sessionStorage.removeItem(id); } catch (_) {}
      }
      remember(params,data); return data;
    }).finally(() => pending.delete(id)));
  }
  return pending.get(id).then(copy);
}
function prefetch(params) {
  if (navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(navigator.connection.effectiveType || ''))) return;
  return read(params).catch(() => null);
}
window.RealtyAddaAPI = Object.freeze({url,read,peek,prefetch});
})();
