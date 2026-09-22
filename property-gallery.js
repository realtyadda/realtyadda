'use strict';
const propertyId = new URLSearchParams(location.search).get('id') || '';
const aliases = {'buy-2bhk-greater-noida-west': 'buy1', 'buy-3bhk-noida': 'buy2', 'buy-3bhk-greater-noida': 'buy3'};
let property = null, currentImage = 0;
const galleryStatus = document.getElementById('galleryStatus');
const photoDialog = document.getElementById('galleryDialog');
const mainImage = document.getElementById('mainPropertyImage');
const retryProperty = document.createElement('button');
retryProperty.id = 'retryProperty';
retryProperty.type = 'button';
retryProperty.className = 'back-btn';
retryProperty.textContent = 'Try again';
retryProperty.hidden = true;
retryProperty.style.cssText = 'border:0;cursor:pointer;margin-top:16px';
document.getElementById('pageMessage').after(retryProperty);
let propertyLoading = false;

function setText(id, text) { document.getElementById(id).textContent = text == null || text === '' ? 'Not provided' : text; }
function showPageMessage(text) {
  document.getElementById('pageMessage').textContent = text;
  document.querySelectorAll('.property-grid, .section-box, .cta').forEach(el => { el.hidden = true; });
  document.getElementById('backButton').href = 'buy.html';
}
function renderProperty(value) {
  property = value; currentImage = 0;
  document.getElementById('pageMessage').textContent = '';
  document.querySelectorAll('.property-grid, .section-box, .cta').forEach(el => { el.hidden = false; });
  document.title = property.title + ' | RealtyAdda';
  const map = {propertyTitle: 'title', propertyLocation: 'location', propertyPrice: 'price', propertyType: 'type', propertyBhk: 'bhk', propertyArea: 'area', propertyFloor: 'floor', propertyParking: 'parking', propertyFurnishing: 'furnishing', propertyDescription: 'description', locationText: 'location'};
  Object.entries(map).forEach(([id, key]) => setText(id, property[key]));
  const renting = property.purpose === 'Rent' || propertyId.startsWith('rent');
  setText('breadcrumb', 'Home / ' + (renting ? 'Rent' : 'Buy') + ' / Property Details');
  document.getElementById('backButton').href = renting ? 'rent.html' : 'buy.html';
  const returnTo = new URLSearchParams(location.search).get('returnTo');
  if (returnTo) {
    try {
    const back = new URL(returnTo, location.href);
    const expected = new URL(renting ? 'rent.html' : 'buy.html', location.href);
    if (back.origin === expected.origin && back.pathname === expected.pathname) {
      document.getElementById('backButton').href = back.href;
    }
    } catch (_) { /* Keep the default catalogue link for invalid URLs. */ }
  }
  document.getElementById('backButton').textContent = renting ? '← Back to rental properties' : '← Back to properties for sale';
  const mapLink = document.getElementById('mapLink');
  mapLink.hidden = !property.location;
  if (property.location) mapLink.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(property.location);
  const amenities = document.getElementById('amenitiesList'); amenities.replaceChildren();
  (property.amenities || []).forEach(text => { const el = document.createElement('div'); el.className = 'amenity'; el.textContent = text; amenities.appendChild(el); });
  amenities.closest('.section-box').hidden = !(property.amenities || []).length;
  document.getElementById('whatsappButton').href = 'https://wa.me/919540205941?text=' + encodeURIComponent('Hello RealtyAdda, I am interested in ' + property.title + ' at ' + property.location + '. ' + location.href);
  const thumbnails = document.getElementById('thumbnails'); thumbnails.replaceChildren();
  property.images.forEach((image, index) => {
    const thumb = document.createElement('button'); thumb.type = 'button'; thumb.className = 'thumbnail';
    thumb.setAttribute('aria-label', 'Show property photo ' + (index + 1));
    const img = document.createElement('img'); img.src = image; img.alt = ''; img.loading = 'lazy';
    thumb.appendChild(img); thumb.addEventListener('click', () => { currentImage = index; updateGallery(); });
    thumbnails.appendChild(thumb);
  });
  updateGallery();
}
function updateGallery() {
  if (!property) return;
  const count = property.images.length;
  mainImage.hidden = !count;
  document.getElementById('openGallery').hidden = !count;
  document.querySelectorAll('.gallery-btn, .lightbox-nav').forEach(el => { el.hidden = count < 2; });
  galleryStatus.textContent = count ? '' : 'No photos provided for this property.';
  if (count) {
    mainImage.src = property.images[currentImage];
    mainImage.alt = property.title + ' — photo ' + (currentImage + 1);
    document.getElementById('largeGalleryImage').src = property.images[currentImage];
    document.getElementById('largeGalleryImage').alt = mainImage.alt;
  } else { mainImage.removeAttribute('src'); }
  setText('imageCounter', count ? (currentImage + 1) + ' / ' + count : '0 photos');
  setText('galleryCaption', count ? 'Photo ' + (currentImage + 1) + ' of ' + count : 'No photos');
  document.querySelectorAll('.thumbnail').forEach((el, index) => {
    el.classList.toggle('active', index === currentImage);
    el.setAttribute('aria-pressed', String(index === currentImage));
  });
}
function nextImage() { if (property && property.images.length) { currentImage = (currentImage + 1) % property.images.length; updateGallery(); } }
function previousImage() { if (property && property.images.length) { currentImage = (currentImage + property.images.length - 1) % property.images.length; updateGallery(); } }
document.querySelector('.prev-btn').addEventListener('click', previousImage);
document.querySelector('.next-btn').addEventListener('click', nextImage);
mainImage.addEventListener('error', () => { galleryStatus.textContent = 'This photo could not load. Please try another photo or reload the page.'; });
mainImage.addEventListener('load', () => { galleryStatus.textContent = ''; });
document.getElementById('openGallery').addEventListener('click', () => photoDialog.showModal());
document.getElementById('closeGallery').addEventListener('click', () => photoDialog.close());
document.getElementById('lightboxPrevious').addEventListener('click', previousImage);
document.getElementById('lightboxNext').addEventListener('click', nextImage);
photoDialog.addEventListener('click', event => { if (event.target === photoDialog) photoDialog.close(); });
document.addEventListener('keydown', event => {
  if (!photoDialog.open && !event.target.closest('.gallery')) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); nextImage(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); previousImage(); }
});
for (const el of [mainImage, document.getElementById('largeGalleryImage')]) {
  let start;
  el.addEventListener('touchstart', event => { start = {x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY}; }, {passive: true});
  el.addEventListener('touchend', event => {
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? nextImage() : previousImage();
    start = null;
  }, {passive: true});
}
async function readProperty() {
  // Retry only read-only requests. A temporary timeout must not strand the visitor.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await RealtyAddaAPI.read(
        {action: 'property', id: propertyId}, attempt === 0 ? 20000 : 40000
      );
      if (!result || result.status === 'error') throw new Error('Property unavailable.');
      return result;
    } catch (error) {
      if (attempt === 1) throw error;
      showPageMessage('The connection is taking longer than usual. Trying again…');
    }
  }
}

function setPropertySEO(sample) {
  let robots = document.querySelector('meta[name="robots"]');
  if (sample) { if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots); } robots.content = 'noindex, follow'; return; }
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = 'https://www.realtyadda.in/property.html?id=' + encodeURIComponent(propertyId);
  document.querySelector('meta[name="description"]').content = (property.title + ' in ' + property.location + '. ' + property.price + '. View supplied property details and photos; contact RealtyAdda to confirm availability.').slice(0, 300);
}

async function loadProperty() {
  if (propertyLoading) return;
  retryProperty.hidden = true;
  const key = aliases[propertyId] || propertyId;
  if (Object.prototype.hasOwnProperty.call(properties, key)) { renderProperty(properties[key]); setPropertySEO(true); document.getElementById('sampleNotice').hidden = false; return; }
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(propertyId)) { setPropertySEO(true); showPageMessage('Property not found. Please return to Buy or Rent.'); return; }
  propertyLoading = true;
  showPageMessage('Loading property and photos…');
  try {
    const result = await readProperty();
    if (result.status === 'not_found') { setPropertySEO(true); showPageMessage('This property is not published or is no longer available.'); return; }
    if (result.status !== 'success' || !result.property) throw new Error('Property unavailable.');
    const value = result.property;
    if (!Array.isArray(value.images) || value.images.length > 10 || value.images.some(url => !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(url))) throw new Error('Gallery unavailable.');
    value.price = '₹' + Number(value.price).toLocaleString('en-IN') + (value.purpose === 'Rent' ? ' / Month' : '');
    value.area = value.area ? Number(value.area).toLocaleString('en-IN') + ' sq.ft.' : '';
    value.amenities = [];
    renderProperty(value);
    setPropertySEO(false);
  } catch (_) {
    showPageMessage('We could not load this property. Please try again.');
    retryProperty.hidden = false;
  } finally { propertyLoading = false; }
}
retryProperty.addEventListener('click', loadProperty);
loadProperty();


