const AUTH_TOKEN_KEY = 'cloudtrips_auth_token';
const AUTH_USER_KEY = 'cloudtrips_auth_user';

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

function redirectToLogin() {
  if (!isAuthPage()) {
    window.location.href = '/login.html';
  }
}

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

  if (response.status === 401 && !isAuthPage()) {
    clearAuthSession();
    redirectToLogin();
    throw new Error('Unauthorized');
  }

  return response;
}

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

async function requireAuth() {
  if (isAuthPage()) return null;

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

function updateAuthUi(user) {
  const emailEl = document.getElementById('auth-user-email');
  if (emailEl) {
    emailEl.textContent = user?.email || '';
  }
}

function logout() {
  clearAuthSession();
  window.location.href = '/login.html';
}

function bindLogoutButton() {
  const logoutButton = document.getElementById('logout-button');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', logout);
}

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
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await parseApiResponse(response);
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
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await parseApiResponse(response);
    setAuthSession(data.token, data.user);
    window.location.href = '/';
  } catch (err) {
    errorBox.textContent = err.message || 'Signup failed.';
  } finally {
    submitButton.disabled = false;
  }
}

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
