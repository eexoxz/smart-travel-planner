const state = {
  token: localStorage.getItem('smartTravelToken') || '',
  authMode: 'login',
  trips: []
};

const elements = {
  sessionStatus: document.getElementById('sessionStatus'),
  logoutButton: document.getElementById('logoutButton'),
  loginTab: document.getElementById('loginTab'),
  registerTab: document.getElementById('registerTab'),
  nameField: document.getElementById('nameField'),
  authForm: document.getElementById('authForm'),
  nameInput: document.getElementById('nameInput'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  tripForm: document.getElementById('tripForm'),
  tripIdInput: document.getElementById('tripIdInput'),
  destinationInput: document.getElementById('destinationInput'),
  countryInput: document.getElementById('countryInput'),
  regionInput: document.getElementById('regionInput'),
  startDateInput: document.getElementById('startDateInput'),
  endDateInput: document.getElementById('endDateInput'),
  budgetInput: document.getElementById('budgetInput'),
  currencyInput: document.getElementById('currencyInput'),
  statusInput: document.getElementById('statusInput'),
  tagsInput: document.getElementById('tagsInput'),
  notesInput: document.getElementById('notesInput'),
  resetTripFormButton: document.getElementById('resetTripFormButton'),
  refreshTripsButton: document.getElementById('refreshTripsButton'),
  tripList: document.getElementById('tripList'),
  summaryContent: document.getElementById('summaryContent'),
  toast: document.getElementById('toast')
};

const countryCodes = [
  'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR',
  'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC',
  'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO',
  'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF',
  'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY',
  'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM',
  'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY',
  'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX',
  'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI',
  'NE', 'NG', 'NU', 'NF', 'MK', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH',
  'PN', 'PL', 'PT', 'PR', 'QA', 'RE', 'RO', 'RU', 'RW', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC',
  'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA',
  'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG',
  'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ',
  'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW'
];

const countryNames = buildCountryNames();
const countryCurrency = {
  Australia: 'AUD',
  Austria: 'EUR',
  China: 'CNY',
  France: 'EUR',
  Indonesia: 'IDR',
  Italy: 'EUR',
  Japan: 'JPY',
  Malaysia: 'MYR',
  Singapore: 'SGD',
  'South Korea': 'KRW',
  Spain: 'EUR',
  Thailand: 'THB',
  'United Kingdom': 'GBP',
  'United States': 'USD'
};

function setAuthMode(mode) {
  state.authMode = mode;
  elements.loginTab.classList.toggle('active', mode === 'login');
  elements.registerTab.classList.toggle('active', mode === 'register');
  elements.nameField.style.display = mode === 'register' ? 'grid' : 'none';
}

function setSessionStatus() {
  elements.sessionStatus.textContent = state.token ? 'Signed in' : 'Signed out';
  elements.logoutButton.hidden = !state.token;
}

async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return undefined;
  }

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Request failed');
  }

  return payload;
}

function buildCountryNames() {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

  return [...new Set(countryCodes.map((code) => displayNames.of(code)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function populateCountries() {
  elements.countryInput.innerHTML = '<option value="">Choose country</option>' + countryNames
    .map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`)
    .join('');
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const body = {
    email: elements.emailInput.value.trim(),
    password: elements.passwordInput.value
  };

  if (state.authMode === 'register') {
    body.name = elements.nameInput.value.trim();
  }

  const endpoint = state.authMode === 'register' ? '/auth/register' : '/auth/login';
  const payload = await apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  });

  state.token = payload.data.token;
  localStorage.setItem('smartTravelToken', state.token);
  setSessionStatus();
  showToast('Signed in');
  await loadTrips();
}

function buildTripPayload() {
  const tags = getSelectedPreferences();

  const payload = {
    destination: elements.destinationInput.value.trim(),
    country: elements.countryInput.value.trim() || undefined,
    region: elements.regionInput.value.trim() || undefined,
    startDate: elements.startDateInput.value,
    endDate: elements.endDateInput.value || undefined,
    notes: elements.notesInput.value.trim() || undefined,
    preferenceTags: tags,
    status: elements.statusInput.value
  };

  if (elements.budgetInput.value) {
    payload.budgetAmount = Number(elements.budgetInput.value);
    payload.budgetCurrency = elements.currencyInput.value;
  }

  return payload;
}

async function handleTripSubmit(event) {
  event.preventDefault();

  const tripId = elements.tripIdInput.value;
  const method = tripId ? 'PUT' : 'POST';
  const endpoint = tripId ? `/trips/${tripId}` : '/trips';

  await apiRequest(endpoint, {
    method,
    body: JSON.stringify(buildTripPayload())
  });

  resetTripForm();
  await loadTrips();
  showToast(tripId ? 'Trip updated' : 'Trip created');
}

async function loadTrips() {
  if (!state.token) {
    state.trips = [];
    renderTrips();
    return;
  }

  const payload = await apiRequest('/trips');
  state.trips = payload.data;
  renderTrips();
}

async function handleCountryChange() {
  const country = elements.countryInput.value.trim();
  elements.regionInput.innerHTML = '<option value="">Loading regions...</option>';
  elements.regionInput.disabled = true;
  elements.destinationInput.innerHTML = '<option value="">Choose region first</option>';
  elements.destinationInput.disabled = true;
  elements.currencyInput.value = countryCurrency[country] || 'USD';

  if (!country) {
    elements.regionInput.innerHTML = '<option value="">Choose country first</option>';
    return;
  }

  try {
    const params = new URLSearchParams({ country });
    const payload = await apiRequest(`/locations/states?${params}`);

    if (!payload.data.length) {
      elements.regionInput.innerHTML = '<option value="">No region required</option>';
      await loadCities('');
      return;
    }

    elements.regionInput.innerHTML = '<option value="">Choose region/state</option>' + payload.data
      .map((region) => `<option value="${escapeHtml(region.name)}">${escapeHtml(region.name)}</option>`)
      .join('');
    elements.regionInput.disabled = false;
  } catch (error) {
    elements.regionInput.innerHTML = '<option value="">Unable to load regions</option>';
    showToast(error.message);
  }
}

async function handleRegionChange() {
  await loadCities(elements.regionInput.value.trim());
}

async function loadCities(region) {
  const country = elements.countryInput.value.trim();
  elements.destinationInput.innerHTML = '<option value="">Loading destinations...</option>';
  elements.destinationInput.disabled = true;

  if (!country) {
    elements.destinationInput.innerHTML = '<option value="">Choose country first</option>';
    return;
  }

  try {
    const params = new URLSearchParams({ country });

    if (region) {
      params.set('state', region);
    }

    const payload = await apiRequest(`/locations/cities?${params}`);
    elements.destinationInput.innerHTML = '<option value="">Choose destination/city</option>' + payload.data
      .map((city) => `<option value="${escapeHtml(city.name)}">${escapeHtml(city.name)}</option>`)
      .join('');
    elements.destinationInput.disabled = false;
  } catch (error) {
    elements.destinationInput.innerHTML = '<option value="">Unable to load destinations</option>';
    showToast(error.message);
  }
}

function renderTrips() {
  if (!state.trips.length) {
    elements.tripList.innerHTML = '<div class="summary-empty">No trips saved.</div>';
    return;
  }

  elements.tripList.innerHTML = state.trips.map((trip) => `
    <article class="trip-card">
      <header>
        <div>
          <h3>${escapeHtml(trip.destination)}</h3>
          <p>${escapeHtml(trip.country || 'No country')} - ${escapeHtml(trip.startDate)}${trip.endDate ? ` to ${escapeHtml(trip.endDate)}` : ''}</p>
        </div>
        <span class="status ${escapeHtml(trip.status)}">${escapeHtml(trip.status)}</span>
      </header>
      <p>${escapeHtml(trip.notes || 'No notes')}</p>
      <div class="card-actions">
        <button type="button" data-action="summary" data-id="${trip.id}">Generate plan</button>
        <button type="button" data-action="edit" data-id="${trip.id}">Edit</button>
        <button type="button" data-action="delete" data-id="${trip.id}">Delete</button>
      </div>
    </article>
  `).join('');
}

async function handleTripListClick(event) {
  const button = event.target.closest('button[data-action]');

  if (!button) {
    return;
  }

  const tripId = Number(button.dataset.id);
  const action = button.dataset.action;

  if (action === 'edit') {
    const trip = state.trips.find((item) => item.id === tripId);
    await fillTripForm(trip);
  }

  if (action === 'delete') {
    await apiRequest(`/trips/${tripId}`, { method: 'DELETE' });
    await loadTrips();
    showToast('Trip deleted');
  }

  if (action === 'summary') {
    await loadSummary(tripId);
  }
}

async function loadSummary(tripId) {
  elements.summaryContent.innerHTML = '<div class="summary-empty">Generating travel plan...</div>';
  const payload = await apiRequest(`/planner/trips/${tripId}/summary`);
  renderSummary(payload.data);
}

function renderSummary(data) {
  const weather = data.externalData.weather.currentWeather;
  const attractions = data.externalData.attractions;
  const plan = data.travelPlan;
  const attractionItems = attractions.attractions.length
    ? attractions.attractions.map((item) => `
      <li>
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.name)}</a>
        <span> ${escapeHtml(item.category)}</span>
      </li>
    `).join('')
    : `<li>${escapeHtml(attractions.message || 'No nearby places returned.')}</li>`;

  elements.summaryContent.innerHTML = `
    <div class="summary-content">
      <div class="summary-block">
        <h3>${escapeHtml(plan.title)}</h3>
        <p>${escapeHtml(data.recommendation.summary)}</p>
      </div>
      <div class="summary-grid">
        <div class="metric"><span>Temperature</span><strong>${weather.temperatureCelsius} C</strong></div>
        <div class="metric"><span>Humidity</span><strong>${weather.humidityPercent}%</strong></div>
        <div class="metric"><span>Wind</span><strong>${weather.windSpeedKmh} km/h</strong></div>
      </div>
      <section>
        <h4>Trip Overview</h4>
        <p>${escapeHtml(plan.overview)}</p>
      </section>
      <section>
        <h4>Weather Advice</h4>
        <p>${escapeHtml(weather.description)} - ${escapeHtml(plan.weatherAdvice)}</p>
      </section>
      <section>
        <h4>Suggested Nearby Places</h4>
        <ol class="attraction-list">${attractionItems}</ol>
      </section>
      <section>
        <h4>Preparation Tips</h4>
        <ul class="attraction-list">
          ${plan.preparationTips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}
        </ul>
      </section>
      <section>
        <h4>Limitations</h4>
        <p>${escapeHtml(plan.limitation)}</p>
      </section>
    </div>
  `;
}

async function fillTripForm(trip) {
  elements.tripIdInput.value = trip.id;
  elements.countryInput.value = trip.country || '';
  elements.currencyInput.value = trip.budgetCurrency || countryCurrency[trip.country] || 'USD';
  await handleCountryChange();
  elements.regionInput.value = trip.region || '';
  await handleRegionChange();
  elements.destinationInput.value = trip.destination;
  elements.startDateInput.value = trip.startDate;
  elements.endDateInput.value = trip.endDate || '';
  elements.budgetInput.value = trip.budgetAmount || '';
  elements.statusInput.value = trip.status;
  elements.tagsInput.value = trip.preferenceTags.join(', ');
  setSelectedPreferences(trip.preferenceTags);
  elements.notesInput.value = trip.notes || '';
  updateDateBounds();
}

function resetTripForm() {
  elements.tripForm.reset();
  elements.tripIdInput.value = '';
  elements.statusInput.value = 'planned';
  elements.currencyInput.value = 'MYR';
  elements.regionInput.innerHTML = '<option value="">Choose country first</option>';
  elements.regionInput.disabled = true;
  elements.destinationInput.innerHTML = '<option value="">Choose region first</option>';
  elements.destinationInput.disabled = true;
  setSelectedPreferences(['food', 'culture', 'beach']);
  updateDateBounds();
}

function updateDateBounds() {
  const today = new Date().toISOString().slice(0, 10);
  elements.startDateInput.min = today;

  if (elements.startDateInput.value && elements.startDateInput.value < today) {
    elements.startDateInput.value = today;
  }

  const endMin = elements.startDateInput.value || today;
  elements.endDateInput.min = endMin;

  if (elements.endDateInput.value && elements.endDateInput.value < endMin) {
    elements.endDateInput.value = '';
  }
}

function getSelectedPreferences() {
  return Array.from(document.querySelectorAll('input[name="preference"]:checked'))
    .map((input) => input.value);
}

function setSelectedPreferences(tags) {
  const selected = new Set(tags);
  document.querySelectorAll('input[name="preference"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
  elements.tagsInput.value = Array.from(selected).join(', ');
}

function logout() {
  state.token = '';
  localStorage.removeItem('smartTravelToken');
  setSessionStatus();
  state.trips = [];
  renderTrips();
  elements.summaryContent.innerHTML = '<div class="summary-empty">Select a saved trip and generate a travel plan.</div>';
  showToast('Signed out');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  window.setTimeout(() => elements.toast.classList.remove('show'), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function attachHandlers() {
  elements.loginTab.addEventListener('click', () => setAuthMode('login'));
  elements.registerTab.addEventListener('click', () => setAuthMode('register'));
  elements.authForm.addEventListener('submit', safeHandler(handleAuthSubmit));
  elements.tripForm.addEventListener('submit', safeHandler(handleTripSubmit));
  elements.tripList.addEventListener('click', safeHandler(handleTripListClick));
  elements.refreshTripsButton.addEventListener('click', safeHandler(loadTrips));
  elements.resetTripFormButton.addEventListener('click', resetTripForm);
  elements.logoutButton.addEventListener('click', logout);
  elements.countryInput.addEventListener('change', safeHandler(handleCountryChange));
  elements.regionInput.addEventListener('change', safeHandler(handleRegionChange));
  elements.startDateInput.addEventListener('change', updateDateBounds);
}

function safeHandler(handler) {
  return async (event) => {
    try {
      await handler(event);
    } catch (error) {
      showToast(error.message);
    }
  };
}

attachHandlers();
populateCountries();
updateDateBounds();
setAuthMode('login');
setSessionStatus();
loadTrips().catch(() => undefined);


