const MANUAL_OVERRIDE_KEY = 'penya_manual_market_selection';
const AUTO_ATTEMPT_KEY = 'penya_auto_market_attempted';
let autoSubmitting = false;

const EUROPE_REGION_CODES = new Set([
  'AL', 'AD', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB',
  'GE', 'GI', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL',
  'NO', 'PL', 'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'SM', 'TR', 'UA', 'VA', 'XK'
]);

const EURO_PREFERRED_CODES = ['DE', 'FR', 'NL', 'IE', 'IT', 'ES', 'BE', 'PT', 'AT', 'FI', 'LU'];

function normalizeCurrency(text) {
  return (text || '').trim().split(/\s+/)[0]?.toUpperCase() || '';
}

function extractLocaleRegions() {
  const locales = Array.from(new Set([...(navigator.languages || []), navigator.language].filter(Boolean)));
  const regions = new Set();

  for (const locale of locales) {
    try {
      const region = new Intl.Locale(locale).region;
      if (region) regions.add(region.toUpperCase());
      // ignore invalid locale strings
    } catch (_) {}
  }

  return Array.from(regions);
}

function buildAvailableCountries() {
  const countries = new Map();
  const items = document.querySelectorAll('localization-form-component .localization-form__list-item[data-value]');

  for (const item of items) {
    const isoCode = item.dataset.value?.toUpperCase();
    if (!isoCode || countries.has(isoCode)) continue;

    const currencyText = item.querySelector('.localization-form__currency')?.textContent || '';
    countries.set(isoCode, {
      isoCode,
      currency: normalizeCurrency(currencyText),
    });
  }

  return countries;
}

function chooseTargetCountry(availableCountries, currentCountry) {
  const localeRegions = extractLocaleRegions();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

  const zimbabweVisitor =
    localeRegions.includes('ZW') || timezone === 'Africa/Harare' || timezone.startsWith('Africa/Harare');

  if (zimbabweVisitor) {
    const zimbabwe = availableCountries.get('ZW');
    if (zimbabwe?.currency === 'USD' || zimbabwe) {
      return 'ZW';
    }

    for (const code of ['ZW', 'US']) {
      const candidate = availableCountries.get(code);
      if (candidate?.currency === 'USD') return code;
    }

    for (const [, candidate] of availableCountries) {
      if (candidate.currency === 'USD') return candidate.isoCode;
    }
  }

  const europeanVisitor =
    timezone.startsWith('Europe/') || localeRegions.some((region) => EUROPE_REGION_CODES.has(region));

  if (europeanVisitor) {
    for (const region of localeRegions) {
      const candidate = availableCountries.get(region);
      if (candidate?.currency === 'EUR') return region;
    }

    for (const code of EURO_PREFERRED_CODES) {
      const candidate = availableCountries.get(code);
      if (candidate?.currency === 'EUR') return code;
    }

    for (const [, candidate] of availableCountries) {
      if (candidate.currency === 'EUR') return candidate.isoCode;
    }
  }

  return currentCountry || null;
}

function markManualOverride() {
  try {
    localStorage.setItem(MANUAL_OVERRIDE_KEY, '1');
  } catch (_) {}
}

function wireManualOverrideListeners() {
  document.querySelectorAll('form.localization-form').forEach((form) => {
    form.addEventListener('submit', () => {
      if (autoSubmitting) {
        autoSubmitting = false;
        return;
      }

      markManualOverride();
    });
  });

  document
    .querySelectorAll('localization-form-component .localization-form__list-item[data-value]')
    .forEach((item) => item.addEventListener('click', markManualOverride, { passive: true }));

  document
    .querySelectorAll('localization-form-component .localization-form__select')
    .forEach((select) => select.addEventListener('change', markManualOverride));
}

function autoSelectCountry() {
  const forms = Array.from(document.querySelectorAll('form.localization-form'));
  const countryForm = forms.find((form) => form.querySelector('input[name="country_code"]'));
  const countryInput = countryForm?.querySelector('input[name="country_code"]');

  if (!countryForm || !countryInput) return;

  wireManualOverrideListeners();

  try {
    if (localStorage.getItem(MANUAL_OVERRIDE_KEY) === '1') return;
  } catch (_) {}

  const currentCountry = countryInput.value?.toUpperCase() || '';
  const availableCountries = buildAvailableCountries();
  if (!availableCountries.size) return;

  const targetCountry = chooseTargetCountry(availableCountries, currentCountry);
  if (!targetCountry || targetCountry === currentCountry || !availableCountries.has(targetCountry)) return;

  try {
    if (sessionStorage.getItem(AUTO_ATTEMPT_KEY) === targetCountry) return;
    sessionStorage.setItem(AUTO_ATTEMPT_KEY, targetCountry);
  } catch (_) {}

  countryInput.value = targetCountry;
  autoSubmitting = true;
  countryForm.submit();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoSelectCountry, { once: true });
} else {
  autoSelectCountry();
}
