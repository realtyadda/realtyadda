'use strict';
const form = document.getElementById('propertyForm');
const fields = document.getElementById('fields');
const button = document.getElementById('submitButton');
const message = document.getElementById('message');
const purpose = document.getElementById('purpose');
const price = document.getElementById('price');
const photoInput = document.getElementById('propertyPhotos');
const previews = document.getElementById('photoPreview');
const photoMessage = document.getElementById('photoMessage');
const dialog = document.getElementById('photoDialog');
let photos = [], busy = false, preparing = false, retryId = '', retryPayload = '';

function showMessage(text, type) { message.textContent = text; message.className = type; }
function updatePriceLabel() {
  const rent = purpose.value === 'Rent';
  document.getElementById('priceLabel').textContent = rent ? 'Expected monthly rent (₹) *' : 'Expected price (₹) *';
  price.placeholder = rent ? 'Example: 22000' : 'Example: 8000000';
}
purpose.addEventListener('change', updatePriceLabel);

function previewPhoto(index) {
  document.getElementById('dialogImage').src = photos[index].url;
  document.getElementById('dialogCaption').textContent = 'Photo ' + (index + 1) + ' of ' + photos.length;
  dialog.showModal();
}
document.getElementById('closePhotoDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

function renderPhotos() {
  previews.replaceChildren();
  photos.forEach((photo, index) => {
    const card = document.createElement('div'); card.className = 'photo-card';
    const view = document.createElement('button'); view.type = 'button'; view.className = 'photo-view';
    view.setAttribute('aria-label', 'Preview photo ' + (index + 1));
    const img = document.createElement('img'); img.src = photo.url; img.alt = 'Selected property photo ' + (index + 1);
    view.appendChild(img); view.addEventListener('click', () => previewPhoto(index));
    const label = document.createElement('span'); label.textContent = index === 0 ? 'Cover photo' : 'Photo ' + (index + 1);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'photo-action';
    remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove photo ' + (index + 1));
    remove.addEventListener('click', () => { URL.revokeObjectURL(photos[index].url); photos.splice(index, 1); renderPhotos(); });
    card.append(view, label, remove);
    if (index > 0) {
      const cover = document.createElement('button'); cover.type = 'button'; cover.className = 'photo-action'; cover.textContent = 'Make cover';
      cover.addEventListener('click', () => { photos.unshift(photos.splice(index, 1)[0]); renderPhotos(); });
      card.appendChild(cover);
    }
    previews.appendChild(card);
  });
  document.getElementById('photoCount').textContent = photos.length + ' / 10 photos';
}

async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose JPG, PNG or WebP photos. Convert HEIC photos to JPG first.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Each original photo must be smaller than 12 MB.');
  const source = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('One photo could not be opened. Choose another image.')); img.src = source; });
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 60000000) throw new Error('This photo is too large. Choose a smaller version.');
    const canvas = document.createElement('canvas');
    let scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8 - attempt * 0.07));
      if (!blob) throw new Error('Could not prepare this photo.');
      if (blob.size <= 250000) {
        const dataURL = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
        return {type: 'image/jpeg', data: dataURL.split(',')[1], url: URL.createObjectURL(blob)};
      }
      scale *= 0.8;
    }
    throw new Error('Could not reduce this photo. Please choose a smaller version.');
  } finally { URL.revokeObjectURL(source); }
}

photoInput.addEventListener('change', async () => {
  if (busy || preparing || !photoServiceReady) return;
  const selected = Array.from(photoInput.files); photoInput.value = '';
  if (photos.length + selected.length > 10) { photoMessage.textContent = 'You can select up to 10 photos. Remove a photo before adding more.'; return; }
  preparing = true; fields.disabled = true; button.disabled = true;
  photoMessage.textContent = 'Preparing photos…';
  const prepared = [];
  try {
    for (const file of selected) prepared.push(await preparePhoto(file));
    photos.push(...prepared); renderPhotos(); photoMessage.textContent = 'Photos are ready. Tap a photo to preview it.';
  } catch (error) {
    prepared.forEach(photo => URL.revokeObjectURL(photo.url));
    photoMessage.textContent = error.message || 'Could not prepare these photos. Please choose them again.';
  } finally { preparing = false; fields.disabled = false; button.disabled = false; }
});

function newSubmissionId() { return 'ra-' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)); }
function pause(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || preparing || !form.reportValidity()) return;
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form)) if (typeof value === 'string') params.append(key, value.trim());
  if (!params.get('name') || !params.get('locality')) { showMessage('Please enter your name and locality.', 'error'); return; }
  const photoCount = photos.length;
  if (photoCount) params.set('photos', JSON.stringify(photos.map(({type, data}) => ({type, data}))));
  const payload = params.toString();
  if (!retryId || retryPayload !== payload) { retryId = newSubmissionId(); retryPayload = payload; }
  const id = retryId; params.set('submissionId', id);
  busy = true; fields.disabled = true; button.disabled = true; button.textContent = 'Submitting…';
  try {
    if (photoCount) {
      showMessage('Checking photo upload availability…', 'info');
      const capabilities = await RealtyAddaAPI.read({action: 'capabilities'});
      if (capabilities.apiVersion !== 2 || capabilities.photos !== true) throw new Error('Photo uploads are not available yet. Your details and photos are still here. Please try again later.');
    }
    showMessage(photoCount ? 'Uploading your details and ' + photoCount + ' photos. Please keep this page open.' : 'Sending your details. Please keep this page open.', 'info');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try { await fetch(RealtyAddaAPI.url, {method: 'POST', mode: 'no-cors', credentials: 'omit', body: params, signal: controller.signal}); }
    catch (_) { /* A missing HTTP acknowledgement is not proof of failure. Verify the saved row. */ }
    finally { clearTimeout(timer); }
    showMessage('Confirming your details' + (photoCount ? ' and photos' : '') + ' were saved…', 'info');
    let confirmed = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = await RealtyAddaAPI.read({action: 'status', submissionId: id});
        if (result.status === 'saved' && (!photoCount || (result.apiVersion === 2 && result.photoCount === photoCount))) { confirmed = true; break; }
      } catch (_) {}
      if (attempt < 3) await pause(2000);
    }
    if (!confirmed) throw new Error('We could not confirm that everything was saved. Your details and photos have been kept here. Please retry with this page open.');
    form.reset(); updatePriceLabel(); photos.forEach(photo => URL.revokeObjectURL(photo.url)); photos = []; renderPhotos(); photoMessage.textContent = '';
    retryId = ''; retryPayload = '';
    showMessage('Property submitted successfully!\nYour details' + (photoCount ? ' and ' + photoCount + ' photos' : '') + ' have been saved for review.\nReference: ' + id, 'success');
    window.alert('Property submitted successfully! Your details' + (photoCount ? ' and photos' : '') + ' have been saved for review.');
  } catch (error) { showMessage(error.message || 'Please retry.', 'error'); }
  finally { busy = false; fields.disabled = false; button.disabled = false; button.textContent = 'Submit property'; }
});
window.addEventListener('beforeunload', event => { if (busy || photos.length) { event.preventDefault(); event.returnValue = ''; } });
button.disabled = false;

let photoServiceReady = false;
async function checkPhotoAvailability() {
  const refresh = document.getElementById('checkPhotoAvailability');
  refresh.disabled = true;
  photoMessage.textContent = 'Checking photo upload availability…';
  try {
    const result = await RealtyAddaAPI.read({action: 'capabilities'}, 12000);
    photoServiceReady = result.apiVersion === 2 && result.photos === true;
    photoMessage.textContent = photoServiceReady
      ? 'Photo upload is ready. Choose your property photos.'
      : 'Photo upload is being enabled. Property details can still be submitted.';
  } catch (_) {
    photoServiceReady = false;
    photoMessage.textContent = 'Photo upload is temporarily unavailable. You can still submit your property details.';
  } finally {
    photoInput.disabled = !photoServiceReady;
    document.getElementById('photoFallback').hidden = photoServiceReady;
    refresh.disabled = false;
  }
}
document.getElementById('checkPhotoAvailability').addEventListener('click', checkPhotoAvailability);
checkPhotoAvailability();
