const dialog = document.querySelector<HTMLDialogElement>('#inquiry-dialog')!;
const form = document.querySelector<HTMLFormElement>('#tour-request-form')!;
const location = document.querySelector<HTMLSelectElement>('#tour-location')!;
const phone = document.querySelector<HTMLInputElement>('#tour-phone')!;
const submit = document.querySelector<HTMLButtonElement>('#tour-submit')!;
const submitLabel = document.querySelector('#tour-submit-label')!;
const errorBox = document.querySelector<HTMLElement>('#tour-form-error')!;
const success = document.querySelector<HTMLElement>('#tour-success')!;
const formContent = document.querySelector<HTMLElement>('#tour-form-content')!;
let sending = false;
let sent = false;
let requestId = '';
let lastPayload = '';
let mode = 'tour';
let requestedMode: 'tour' | 'waitlist' | undefined;

function updateMode() {
  const comingSoon = location.selectedOptions[0]?.dataset.availability === 'coming-soon';
  const full = location.selectedOptions[0]?.dataset.available === 'false';
  mode = full ? 'waitlist' : requestedMode || 'tour';
  const waitlist = mode === 'waitlist';
  document.querySelector('#inquiry-title')!.textContent = waitlist ? 'Get on the list.' : 'Request a tour.';
  document.querySelector('#inquiry-intro')!.textContent = waitlist
    ? comingSoon ? `${location.value} is coming soon. We’ll contact you about opening dates and availability.`
      : full ? `${location.value} is full. We’ll contact you when space opens.` : `We’ll contact you about upcoming space in ${location.value}.`
    : 'We’ll call or text to confirm a tour time.';
  submitLabel.textContent = waitlist ? 'Join the waitlist' : 'Request my tour';
  document.querySelector('.tour-form-note')!.textContent = waitlist
    ? 'No obligation. A suite isn’t reserved.'
    : 'No obligation. We’ll confirm your tour time.';
}

export function openTourInquiry(city = '', requestType?: 'tour' | 'waitlist') {
  if (sent) {
    form.reset(); sent = false; requestId = ''; lastPayload = '';
    success.hidden = true; formContent.hidden = false;
    dialog.setAttribute('aria-labelledby', 'inquiry-title');
    dialog.setAttribute('aria-describedby', 'inquiry-intro');
  }
  if (!sending) {
    requestedMode = requestType;
    if (city) location.value = city;
    errorBox.hidden = true;
    updateMode();
  }
  dialog.showModal();
}

location.addEventListener('change', () => { requestedMode = undefined; updateMode(); });
phone.addEventListener('input', () => phone.setCustomValidity(''));
document.querySelector('#tour-done')!.addEventListener('click', () => dialog.close());

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending) return;
  const digits = phone.value.replace(/\D/g, '');
  phone.setCustomValidity(digits.length >= 10 && digits.length <= 15 && /^[+\d().\s-]+$/.test(phone.value)
    ? '' : 'Enter a cell phone number with 10–15 digits.');
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const payload = {
    name: String(data.get('name') || '').trim(), location: String(data.get('location') || ''),
    business: String(data.get('business') || '').trim(), cell_phone: phone.value.trim(),
    request_type: mode, website_confirm: String(data.get('website_confirm') || ''),
  };
  const signature = JSON.stringify(payload);
  if (signature !== lastPayload) { requestId = crypto.randomUUID(); lastPayload = signature; }
  sending = true;
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach(field => field.disabled = true);
  submitLabel.textContent = 'Sending your request…';
  errorBox.hidden = true;
  try {
    const response = await fetch('/api/tour-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...payload, id: requestId }), signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || result.success !== true || result.id !== requestId) {
      throw new Error(typeof result.error === 'string' ? result.error : 'We couldn’t confirm your request. Please try again or call/text leasing.');
    }
    sent = true;
    document.querySelector('#tour-success-message')!.textContent = payload.request_type === 'waitlist'
      ? `You’re on our ${payload.location} interest list. Leasing will contact you at ${payload.cell_phone} about availability.`
      : `Your ${payload.location} tour request is with our team. We’ll contact you at ${payload.cell_phone} to confirm availability and a time.`;
    document.querySelector('.tour-success-reference')!.textContent = `Request reference: ${requestId.slice(0, 8).toUpperCase()}`;
    formContent.hidden = true; success.hidden = false;
    dialog.setAttribute('aria-labelledby', 'tour-success-title');
    dialog.setAttribute('aria-describedby', 'tour-success-message');
    success.focus();
  } catch (error) {
    errorBox.textContent = error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'TypeError'
      ? error.message : 'We couldn’t confirm your request. Your details are still here—try again or call/text leasing.';
    errorBox.hidden = false;
  } finally {
    sending = false; submit.disabled = false; form.removeAttribute('aria-busy');
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach(field => field.disabled = false);
    updateMode();
  }
});
