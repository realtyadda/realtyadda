/* Standalone private admin project. Never paste into the public upload project. */
const ADMIN = Object.freeze({
  email: 'shekhar.ch90@gmail.com',
  sheetId: '1Ih9v4E5PVUKKEi3AorEzo0pGVhJ6x86fqNCpXY7rTPE',
  sheetName: 'RealtyAdda Leads',
  headers: ['Submission ID', 'Date', 'Purpose', 'Posted By', 'Name', 'Mobile', 'City', 'Locality / Society', 'Property Type', 'BHK', 'Area (sq ft)', 'Price / Monthly Rent (INR)', 'Description', 'Photo Folder', 'Photo IDs', 'Photo Count', 'Publication Status', 'Listing URL', 'Request Hash']
});

function requireAdmin_() {
  // Effective user alone is NOT authentication: it can be the deployment owner.
  const active = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const effective = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (active !== ADMIN.email || effective !== ADMIN.email) throw new Error('Access denied. Sign in with the authorised RealtyAdda Google account.');
}
function doGet() {
  try {
    requireAdmin_();
    return HtmlService.createHtmlOutputFromFile('Dashboard').setTitle('RealtyAdda Admin')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (_) {
    return HtmlService.createHtmlOutput('<h1>Private RealtyAdda dashboard</h1><p>Access denied. Open this dashboard with the authorised Google account.</p>');
  }
}
function adminSheet_() {
  const sheet = SpreadsheetApp.openById(ADMIN.sheetId).getSheetByName(ADMIN.sheetName);
  if (!sheet) throw new Error('Property sheet not found.');
  const headers = sheet.getRange(1, 1, 1, 19).getValues()[0];
  if (!ADMIN.headers.every((h, i) => headers[i] === h)) throw new Error('Sheet columns have changed. No updates were made.');
  return sheet;
}
function validId_(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{20,100}$/.test(id); }
function version_(row) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(row), Utilities.Charset.UTF_8));
}
function findRow_(sheet, id) {
  if (!validId_(id)) throw new Error('Invalid property reference.');
  if (sheet.getLastRow() < 2) throw new Error('Property not found.');
  const matches = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(id)
    .matchEntireCell(true).matchCase(true).useRegularExpression(false).findAll();
  if (matches.length !== 1) throw new Error('Property reference is missing or duplicated.');
  const index = matches[0].getRow();
  return {index: index, row: sheet.getRange(index, 1, 1, 19).getValues()[0]};
}
function isTest_(row) { return /^ra-test-/.test(String(row[0])) || /TEST ONLY/i.test([row[4], row[7], row[12]].join(' ')); }
function summary_(row) {
  return {id: String(row[0]), title: [row[9], row[8]].filter(Boolean).join(' '),
    city: String(row[6]), locality: String(row[7]), price: Number(row[11]) || 0,
    purpose: String(row[2]), status: String(row[16] || 'Pending').trim(), test: isTest_(row),
    photoCount: Number(row[15]) || 0};
}
function adminList() {
  requireAdmin_();
  const sheet = adminSheet_();
  const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, 19).getValues();
  return {email: ADMIN.email, listings: rows.filter(r => validId_(String(r[0]))).reverse().map(summary_)};
}
function adminDetail(id) {
  requireAdmin_();
  const row = findRow_(adminSheet_(), id).row;
  return Object.assign(summary_(row), {version: version_(row), name: String(row[4]), mobile: String(row[5]),
    postedBy: String(row[3]), type: String(row[8]), bhk: String(row[9]), area: String(row[10]),
    description: String(row[12]), date: row[1] instanceof Date ? row[1].toISOString() : String(row[1]),
    listingUrl: 'https://www.realtyadda.in/property.html?id=' + encodeURIComponent(id)});
}
function adminPhoto(id, index) {
  requireAdmin_();
  const row = findRow_(adminSheet_(), id).row;
  const ids = JSON.parse(row[14] || '[]');
  if (!Array.isArray(ids) || ids.length > 10 || !Number.isInteger(index) || index < 0 || index >= ids.length) throw new Error('Photo not found.');
  const file = DriveApp.getFileById(ids[index]);
  if (file.isTrashed() || file.getSize() > 250000) throw new Error('Photo unavailable.');
  const blob = file.getBlob();
  if (blob.getContentType() !== 'image/jpeg') throw new Error('Unsupported photo.');
  return 'data:image/jpeg;base64,' + Utilities.base64Encode(blob.getBytes());
}
function text_(value, max, required) {
  if (typeof value !== 'string') throw new Error('Invalid text field.');
  const s = value.trim();
  if ((required && !s) || s.length > max) throw new Error('A required field is missing or too long.');
  return s;
}
function cell_(s) { return /^[=+@-]/.test(s) ? "'" + s : s; }
function adminSave(id, expectedVersion, edits, nextStatus) {
  requireAdmin_();
  if (!['Pending', 'Published', 'Rejected'].includes(nextStatus)) throw new Error('Invalid status.');
  if (!edits || typeof edits !== 'object') throw new Error('Missing property details.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = adminSheet_();
    const found = findRow_(sheet, id);
    const row = found.row;
    if (typeof expectedVersion !== 'string' || expectedVersion !== version_(row)) throw new Error('This listing changed. Reload it before saving.');
    if (nextStatus === 'Published' && isTest_(row)) throw new Error('Test submissions cannot be published.');
    const purpose = text_(edits.purpose, 10, true);
    const postedBy = text_(edits.postedBy, 10, true);
    if (!['Sale', 'Rent'].includes(purpose) || !['Owner', 'Agent', 'Builder'].includes(postedBy)) throw new Error('Invalid listing options.');
    const name = text_(edits.name, 100, true), mobile = text_(edits.mobile, 10, true);
    if (!/^[6-9][0-9]{9}$/.test(mobile)) throw new Error('Enter a valid 10-digit mobile number.');
    const city = text_(edits.city, 100, true), locality = text_(edits.locality, 200, true);
    const type = text_(edits.type, 100, true), bhk = text_(edits.bhk, 30, false);
    const area = text_(edits.area, 20, false), price = text_(edits.price, 20, true);
    const description = text_(edits.description, 3000, false);
    if (!Number.isSafeInteger(Number(price)) || Number(price) < 1 || Number(price) > 1e12) throw new Error('Enter a valid price.');
    if (area && (!Number.isFinite(Number(area)) || Number(area) <= 0 || Number(area) > 1e9)) throw new Error('Enter a valid area.');
    const fields = [purpose, postedBy, cell_(name), mobile, cell_(city), cell_(locality), cell_(type), cell_(bhk), area ? Number(area) : '', Number(price), cell_(description)];
    fields.forEach((v, i) => { row[i + 2] = v; });
    // Also reject edited test text, even if the original row was genuine.
    if (nextStatus === 'Published' && isTest_(row)) throw new Error('Test submissions cannot be published.');
    // Write C:Q once; preserve immutable ID/date, stored photos, listing URL and request hash.
    row[16] = nextStatus;
    sheet.getRange(found.index, 3, 1, 15).setValues([row.slice(2, 17)]);
    SpreadsheetApp.flush();
    return {id: id, status: nextStatus};
  } finally { lock.releaseLock(); }
}
