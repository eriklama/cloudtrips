const AUTH_TOKEN_KEY = 'cloudtrips_auth_token';
const AUTH_USER_KEY = 'cloudtrips_auth_user';

/* =========================
 * HELPERS
 * ========================= */

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function setAuthSession(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user || null));
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function isAuthPage() {
  const path = location.pathname;
  return path.endsWith('/login.html') || path.endsWith('/signup.html');
}

/* =========================
 * 🔥 NEW: GUEST DETECTION
 * ========================= */

function isGuestView() {
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get('token'));
}

/* =========================
 * REDIRECT
 * ========================= */

function redirectToLogin() {
  // ✅ DO NOT redirect shared links
  if (isGuestView()) {
    console.log('Guest mode → skip login redirect');
    return;
  }

  if (!isAuthPage()) {
    window.location.href = '/login.html';
  }
}

/* =========================
 * FETCH WITH AUTH
 * ========================= */

async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // ✅ DO NOT kill guest sessions on 401
  if (response.status === 401 && !isAuthPage() && !isGuestView()) {
    clearAuthSession();
    redirectToLogin();
    throw new Error('Unauthorized');
  }

  return response;
}

/* =========================
 * RESPONSE PARSER
 * ========================= */

async function parseApiResponse(response) {
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && data.error) ||
      (typeof data === 'string' && data) ||
      `Request failed: ${response.status}`;

    throw new Error(message);
  }

  return data;
}

/* =========================
 * API HELPERS
 * ========================= */

async function apiGet(url) {
  const res = await authFetch(url, { method: 'GET' });
  return parseApiResponse(res);
}

async function apiPost(url, payload) {
  const res = await authFetch(url, {
    method: 'POST',
    body: JSON.stringify(payload || {})
  });
  return parseApiResponse(res);
}

async function apiDelete(url, payload) {
  const res = await authFetch(url, {
    method: 'POST',
    body: JSON.stringify(payload || {})
  });
  return parseApiResponse(res);
}

/* =========================
 * AUTH CHECK
 * ========================= */

async function requireAuth() {
  if (isAuthPage()) return null;

  // ✅ allow guest access
  if (isGuestView()) {
    console.log('Guest access → skipping auth');
    return null;
  }

  const token = getAuthToken();
  if (!token) {
    redirectToLogin();
    return null;
  }

  try {
    const data = await apiGet('/api/me');
    updateAuthUi(data.user);
    return data.user;
  } catch {
    clearAuthSession();
    redirectToLogin();
    return null;
  }
}

/* =========================
 * UI
 * ========================= */

function updateAuthUi(user) {
  const emailEl = document.getElementById('auth-user-email');
  if (emailEl) {
    emailEl.textContent = user?.email || '';
  }
}

function bindLogoutButton() {
  const logoutButton = document.getElementById('logout-button');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', () => {
    clearAuthSession();
    window.location.href = '/login.html';
  });
}

/* =========================
 * FORMS
 * ========================= */

async function handleLoginSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const email = form.querySelector('input[name="email"]').value.trim();
  const password = form.querySelector('input[name="password"]').value;
  const errorBox = document.getElementById('auth-error');
  const submitButton = form.querySelector('button[type="submit"]');

  errorBox.textContent = '';
  submitButton.disabled = true;

  try {
    const data = await apiPost('/api/login', { email, password });
    setAuthSession(data.token, data.user);
    window.location.href = '/';
  } catch (err) {
    errorBox.textContent = err.message || 'Login failed.';
  } finally {
    submitButton.disabled = false;
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const email = form.querySelector('input[name="email"]').value.trim();
  const password = form.querySelector('input[name="password"]').value;
  const confirmPassword = form.querySelector('input[name="confirmPassword"]').value;
  const errorBox = document.getElementById('auth-error');
  const submitButton = form.querySelector('button[type="submit"]');

  errorBox.textContent = '';

  if (password !== confirmPassword) {
    errorBox.textContent = 'Passwords do not match.';
    return;
  }

  submitButton.disabled = true;

  try {
    const data = await apiPost('/api/signup', { email, password });
    setAuthSession(data.token, data.user);
    window.location.href = '/';
  } catch (err) {
    errorBox.textContent = err.message || 'Signup failed.';
  } finally {
    submitButton.disabled = false;
  }
}

/* =========================
 * INIT
 * ========================= */

document.addEventListener('DOMContentLoaded', async () => {
  bindLogoutButton();

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
    return;
  }

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignupSubmit);
    return;
  }

  await requireAuth();
});
