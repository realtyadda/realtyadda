/* Online enquiries appear only when the deployed Apps Script confirms support. */
(function () {
'use strict';
const form = document.getElementById('enquiryForm');
const availability = document.getElementById('enquiryAvailability');
const result = document.getElementById('enquiryResult');
const whatsApp = document.getElementById('enquiryWhatsApp');
const propertyId = new URLSearchParams(location.search).get('id') || '';
const validProperty = /^[A-Za-z0-9_-]{20,100}$/.test(propertyId);
if (validProperty) {
  document.getElementById('enquiryMessage').value = 'I am interested in property ' + propertyId + '. Please contact me with the details.';
  whatsApp.href = 'https://wa.me/919540205941?text=' + encodeURIComponent('Hello RealtyAdda, I am interested in https://www.realtyadda.in/property.html?id=' + propertyId);
}
RealtyAddaAPI.read({action: 'capabilities'}, 12000).then(data => {
  if (data && data.status === 'success' && data.enquiries === true && data.apiVersion >= 3) {
    availability.textContent = 'Share your requirement and we will contact you.';
    form.hidden = false;
  } else {
    availability.textContent = 'Please call or WhatsApp RealtyAdda to send your enquiry.';
  }
}).catch(() => { availability.textContent = 'Please call or WhatsApp RealtyAdda to send your enquiry.'; });

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button');
  button.disabled = true;
  result.textContent = 'Sending enquiry…';
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const id = 'RAE' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const payload = new URLSearchParams({
    action: 'enquiry', id, name: form.elements.name.value.trim(),
    mobile: form.elements.mobile.value.trim(),
    message: form.elements.message.value.trim(),
    propertyId: validProperty ? propertyId : ''
  });
  try {
    await fetch(RealtyAddaAPI.url, {method: 'POST', mode: 'no-cors', body: payload});
    let saved = false;
    for (let attempt = 0; attempt < 4 && !saved; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1300 + attempt * 700));
      const response = await RealtyAddaAPI.read({action: 'enquiryStatus', id}, 15000, {fresh: true});
      saved = response && response.status === 'saved';
    }
    if (!saved) throw new Error('Unconfirmed');
    result.textContent = 'Enquiry received. Your reference is ' + id + '.';
    form.reset();
    button.disabled = true;
  } catch (_) {
    result.textContent = 'We could not confirm your enquiry. Please call or WhatsApp RealtyAdda. Avoid submitting again until you check with us.';
    button.disabled = false;
  }
});
})();
