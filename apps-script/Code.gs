/* RealtyAdda photo upgrade. Replace Code.gs, run setup(), then update the EXISTING deployment. */
const RA = Object.freeze({
  sheetId: '1Ih9v4E5PVUKKEi3AorEzo0pGVhJ6x86fqNCpXY7rTPE',
  sheetName: 'RealtyAdda Leads',
  maxPhotos: 10,
  maxPhotoBytes: 250000,
  dailySubmissions: 50,
  headers: ['Submission ID', 'Date', 'Purpose', 'Posted By', 'Name', 'Mobile', 'City', 'Locality / Society', 'Property Type', 'BHK', 'Area (sq ft)', 'Price / Monthly Rent (INR)', 'Description', 'Photo Folder', 'Photo IDs', 'Photo Count', 'Publication Status', 'Listing URL', 'Request Hash']
});

function setup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = raSheet_();
    const actual = sheet.getRange(1, 1, 1, RA.headers.length).getValues()[0];
    RA.headers.forEach(function(header, i) {
      if (actual[i] !== '' && actual[i] !== header) {
        throw new Error('Unexpected header in column ' + (i + 1) + '. No changes made.');
      }
    });
    sheet.getRange(1, 1, 1, RA.headers.length).setValues([RA.headers]);
    sheet.setFrozenRows(1);
    sheet.getRange('Q1').setNote('New leads are Pending. Type Published in a lead row only after checking its details and photos. Change back to Pending to withdraw it.');
    sheet.getRange('N1').setNote('Private photo folder; open using the Google account that owns this script.');
    raPhotoRoot_();
    SpreadsheetApp.flush();
    return 'Ready. Update the existing web app deployment to New version.';
  } finally { lock.releaseLock(); }
}

function raSheet_() {
  const sheet = SpreadsheetApp.openById(RA.sheetId).getSheetByName(RA.sheetName);
  if (!sheet) throw new Error('Lead sheet is missing.');
  return sheet;
}

function raPhotoRoot_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('RA_PHOTO_ROOT_ID');
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder('RealtyAdda Property Photos');
  props.setProperty('RA_PHOTO_ROOT_ID', folder.getId());
  return folder;
}

function raReady_() {
  const actual = raSheet_().getRange(1, 1, 1, RA.headers.length).getValues()[0];
  return RA.headers.every(function(h, i) { return actual[i] === h; }) &&
    Boolean(PropertiesService.getScriptProperties().getProperty('RA_PHOTO_ROOT_ID'));
}

function raReply_(data, callback) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  if (callback && !/^ra_[A-Za-z0-9_]{1,90}$/.test(callback)) {
    return ContentService.createTextOutput('{"status":"error","message":"Invalid callback."}').setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(callback ? callback + '(' + json + ');' : json)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function raValidId_(id) { return /^[A-Za-z0-9_-]{20,100}$/.test(id || ''); }

function raFind_(sheet, id) {
  if (!raValidId_(id) || sheet.getLastRow() < 2) return null;
  const found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(id)
    .matchEntireCell(true).matchCase(true).useRegularExpression(false).findNext();
  return found ? sheet.getRange(found.getRow(), 1, 1, RA.headers.length).getValues()[0] : null;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'capabilities') return raReply_({status: 'success', apiVersion: 2, photos: raReady_(), maxPhotos: RA.maxPhotos}, p.callback);
    if (p.action === 'status') {
      const row = raFind_(raSheet_(), p.submissionId);
      return raReply_({status: row ? 'saved' : 'not_found', apiVersion: 2, photoCount: row ? Number(row[15] || 0) : 0}, p.callback);
    }
    if (p.action === 'property') {
      const row = raFind_(raSheet_(), p.id);
      if (!row || String(row[16]).trim() !== 'Published') return raReply_({status: 'not_found'}, p.callback);
      const ids = JSON.parse(row[14] || '[]');
      if (!Array.isArray(ids) || ids.length > RA.maxPhotos) throw new Error('Invalid gallery.');
      const images = ids.map(function(id) {
        const file = DriveApp.getFileById(id);
        if (file.isTrashed() || file.getSize() > RA.maxPhotoBytes) throw new Error('Photo unavailable.');
        const blob = file.getBlob();
        if (blob.getContentType() !== 'image/jpeg') throw new Error('Invalid photo.');
        return 'data:image/jpeg;base64,' + Utilities.base64Encode(blob.getBytes());
      });
      // Public fields only. Never return name, phone, private folder, file IDs or request hash.
      return raReply_({status: 'success', property: {
        title: [row[9], row[8]].filter(Boolean).join(' '),
        location: row[7] + ', ' + row[6], purpose: row[2], price: Number(row[11]),
        type: row[8], bhk: row[9], area: row[10], description: row[12], images: images
      }}, p.callback);
    }
    return raReply_({status: 'success', message: 'RealtyAdda Apps Script is working', apiVersion: 2}, p.callback);
  } catch (error) {
    console.error(error);
    return raReply_({status: 'error', message: 'Service temporarily unavailable. Please retry.'}, p.callback);
  }
}

function raText_(p, key, max, required) {
  const v = String(p[key] == null ? '' : p[key]).trim();
  if ((required && !v) || v.length > max) throw new Error('Invalid ' + key + '.');
  return v;
}

function raCell_(value) {
  const s = String(value == null ? '' : value);
  return /^[=+@-]/.test(s) ? "'" + s : s;
}

function raInput_(p) {
  const v = {};
  if (!raValidId_(p.submissionId)) throw new Error('Invalid reference.');
  v.id = p.submissionId;
  v.purpose = raText_(p, 'purpose', 10, true);
  v.postedBy = raText_(p, 'postedBy', 10, true);
  if (['Sale', 'Rent'].indexOf(v.purpose) < 0 || ['Owner', 'Agent', 'Builder'].indexOf(v.postedBy) < 0) throw new Error('Invalid listing options.');
  v.name = raText_(p, 'name', 100, true);
  v.mobile = raText_(p, 'mobile', 10, true);
  if (!/^[6-9][0-9]{9}$/.test(v.mobile)) throw new Error('Invalid mobile number.');
  v.city = raText_(p, 'city', 100, true);
  v.locality = raText_(p, 'locality', 200, true);
  v.propertyType = raText_(p, 'propertyType', 100, true);
  v.bhk = raText_(p, 'bhk', 30, false);
  v.area = raText_(p, 'area', 20, false);
  v.price = raText_(p, 'price', 20, true);
  if (!Number.isFinite(Number(v.price)) || Number(v.price) < 1 || !Number.isInteger(Number(v.price)) || Number(v.price) > 1e12) throw new Error('Invalid price.');
  if (v.area && (!Number.isFinite(Number(v.area)) || Number(v.area) <= 0 || Number(v.area) > 1e9)) throw new Error('Invalid area.');
  v.description = raText_(p, 'description', 3000, false);
  const photos = JSON.parse(p.photos || '[]');
  if (!Array.isArray(photos) || photos.length > RA.maxPhotos) throw new Error('Too many photos.');
  v.photos = photos.map(function(photo) {
    if (!photo || photo.type !== 'image/jpeg' || typeof photo.data !== 'string' || photo.data.length > 333336 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.data)) throw new Error('Invalid photo data.');
    const bytes = Utilities.base64Decode(photo.data);
    if (bytes.length < 4 || bytes.length > RA.maxPhotoBytes || (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 || (bytes[bytes.length - 2] & 255) !== 255 || (bytes[bytes.length - 1] & 255) !== 217) throw new Error('Invalid JPEG photo.');
    return {data: photo.data, bytes: bytes};
  });
  return v;
}

function doPost(e) {
  let lock, folder, input, committed = false;
  try {
    if (!e || !e.postData || e.postData.length > 4500000) throw new Error('Request is too large.');
    const p = String(e.postData.type || '').indexOf('application/json') === 0
      ? JSON.parse(e.postData.contents) : (e.parameter || {});
    input = raInput_(p);
    const fingerprint = Object.assign({}, input, {photos: input.photos.map(function(photo) { return photo.data; })});
    const hash = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(fingerprint), Utilities.Charset.UTF_8));
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const sheet = raSheet_();
    const previous = raFind_(sheet, input.id);
    if (previous) {
      if (previous[18] && previous[18] !== hash) throw new Error('Reference already used with different details.');
      return raReply_({status: 'success', photoCount: Number(previous[15] || 0)});
    }
    if (!raReady_()) throw new Error('Run setup before using this version.');
    const props = PropertiesService.getScriptProperties();
    const day = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
    const count = props.getProperty('RA_UPLOAD_DAY') === day ? Number(props.getProperty('RA_UPLOAD_COUNT') || 0) : 0;
    if (count >= RA.dailySubmissions) throw new Error('Daily submission limit reached. Please contact RealtyAdda.');
    const ids = [];
    if (input.photos.length) {
      folder = raPhotoRoot_().createFolder(input.id);
      input.photos.forEach(function(photo, i) {
        const blob = Utilities.newBlob(photo.bytes, 'image/jpeg', String(i + 1).padStart(2, '0') + '.jpg');
        ids.push(folder.createFile(blob).getId());
      });
    }
    const row = [input.id, new Date(), input.purpose, input.postedBy, raCell_(input.name), input.mobile,
      raCell_(input.city), raCell_(input.locality), raCell_(input.propertyType), raCell_(input.bhk),
      input.area ? Number(input.area) : '', Number(input.price), raCell_(input.description),
      folder ? folder.getUrl() : '', JSON.stringify(ids), ids.length, 'Pending',
      'https://www.realtyadda.in/property.html?id=' + encodeURIComponent(input.id), hash];
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();
    committed = true;
    props.setProperties({RA_UPLOAD_DAY: day, RA_UPLOAD_COUNT: String(count + 1)});
    return raReply_({status: 'success', photoCount: ids.length});
  } catch (error) {
    console.error(error);
    if (folder && !committed) {
      // A lost acknowledgement may still have written the row. Never remove its photos.
      try { if (!raFind_(raSheet_(), input.id)) folder.setTrashed(true); } catch (_) {}
    }
    return raReply_({status: 'error', message: 'Submission could not be completed. Please retry or contact RealtyAdda.'});
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
