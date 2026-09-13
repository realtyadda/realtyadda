/* Published catalogue; private contact fields are never requested. */
(function () {
'use strict';
const form = document.getElementById('listingFilters');
const list = document.getElementById('propertyList');
const status = document.getElementById('listingStatus');
const retry = document.getElementById('retryLoad');
const prev = document.getElementById('previousPage');
const next = document.getElementById('nextPage');
const purpose = document.body.dataset.purpose;
let page = 1, generation = 0, activeFilters = {};
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function matchesPurpose(item) {
  return item && item.purpose === purpose && /^[A-Za-z0-9_-]{20,100}$/.test(item.id) &&
    Number.isFinite(Number(item.price)) && Number(item.price) > 0;
}
function card(item) {
  const article = node('article', 'property');
  const media = node('div', 'property-image');
  const placeholder = node('div', 'image-placeholder', item.hasPhoto ? 'Loading photo…' : 'No photo provided');
  const badge = node('span', 'tag', purpose === 'Rent' ? 'FOR RENT' : 'FOR SALE');
  media.append(placeholder, badge);
  const content = node('div', 'property-content');
  content.append(node('h3', '', item.title), node('p', 'location', item.location));
  content.append(node('p', 'details', [item.bhk, item.type, item.area ? Number(item.area).toLocaleString('en-IN') + ' sq.ft.' : ''].filter(Boolean).join(' • ')));
  content.append(node('p', 'price', '₹' + Number(item.price).toLocaleString('en-IN') + (purpose === 'Rent' ? ' / Month' : '')));
  const view = node('a', 'view-btn', 'View Property');
  view.href = 'property.html?id=' + encodeURIComponent(item.id);
  content.append(view);
  article.append(media, content);
  list.append(article);
  return {item, media, placeholder};
}
async function loadCover(job, token) {
  try {
    const result = await RealtyAddaAPI.read({action: 'cover', id: job.item.id}, 45000);
    if (token !== generation) return;
    if (result.status === 'not_found') { job.placeholder.textContent = 'Listing unavailable'; return; }
    if (result.status !== 'success' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(result.image || '') || result.image.length > 334000) throw new Error('No cover');
    const img = node('img');
    img.alt = job.item.title + ' — cover photo';
    img.loading = 'lazy';
    img.addEventListener('error', () => { img.remove(); job.placeholder.textContent = 'Photo unavailable'; job.placeholder.hidden = false; });
    img.src = result.image;
    job.placeholder.hidden = true;
    job.media.prepend(img);
  } catch (_) { if (token === generation) job.placeholder.textContent = 'Photo unavailable — open property to retry'; }
}
async function load() {
  const token = ++generation;
  status.textContent = 'Loading properties…';
  retry.hidden = true; prev.disabled = true; next.disabled = true;
  list.replaceChildren(); list.setAttribute('aria-busy', 'true');
  try {
    const result = await RealtyAddaAPI.read(Object.assign({action: 'listings', purpose, page}, activeFilters), 45000);
    if (token !== generation) return;
    if (result.status !== 'success' || !Array.isArray(result.listings) || !Number.isInteger(result.total) || result.total < 0 || !Number.isInteger(result.pageSize) || result.pageSize < 1) throw new Error('Catalogue unavailable');
    if (page > 1 && !result.listings.length) { page = 1; return load(); }
    const jobs = result.listings.filter(matchesPurpose).map(card).filter(job => job.item.hasPhoto);
    status.textContent = result.total ? result.total + (result.total === 1 ? ' property' : ' properties') + ' · Page ' + page + ' of ' + Math.ceil(result.total / result.pageSize)
      : (Object.values(activeFilters).some(Boolean) ? 'No properties match these filters. Try Reset.' : 'No published properties available yet. Please check back soon.');
    prev.disabled = page <= 1; next.disabled = page * result.pageSize >= result.total;
    list.setAttribute('aria-busy', 'false');
    // Limit simultaneous Apps Script executions when loading private cover photos.
    async function worker() { while (jobs.length && token === generation) await loadCover(jobs.shift(), token); }
    await Promise.all([worker(), worker(), worker()]);
  } catch (_) {
    if (token !== generation) return;
    status.textContent = 'Properties could not be loaded. Please try again or contact RealtyAdda.';
    retry.hidden = false;
  } finally { if (token === generation) list.setAttribute('aria-busy', 'false'); }
}
form.addEventListener('submit', event => {
  event.preventDefault(); activeFilters = Object.fromEntries(new FormData(form)); page = 1; load();
});
document.getElementById('resetFilters').addEventListener('click', () => { form.reset(); activeFilters = {}; page = 1; load(); });
prev.addEventListener('click', () => { if (page > 1) { page--; load(); } });
next.addEventListener('click', () => { page++; load(); });
retry.addEventListener('click', load);
load();
})();