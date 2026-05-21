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


function isAuthPage() {
  const path = location.pathname;
  return path.endsWith('/login.html') ||
         path.endsWith('/signup.html') ||
         path.endsWith('/verify-email.html');
}

function redirectToLogin() {
  if (!isAuthPage()) {
    window.location.href = '/login.html';
  }
}

async function requireAuth() {
  if (isAuthPage()) return null;

  // ✅ allow guest/shared access without token
  if (isGuestView()) return null;

  const token = getAuthToken();
  if (!token) {
    redirectToLogin();
    return null;
  }

  try {
    const data = await apiGet('/api/me');
    // Hard gate — redirect to verify page if email not verified
    if (!data.user.emailVerified) {
      window.location.href = '/verify-email.html';
      return null;
    }
    state.user = data.user;
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
    const data = await apiFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    setAuthSession(data.token, data.user);
    const redirectUrl = new URLSearchParams(window.location.search).get('redirect');
    window.location.href = redirectUrl || '/';
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
    const data = await apiFetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (data.requiresVerification) {
      window.location.href = '/verify-email.html?email=' + encodeURIComponent(data.email);
      return;
    }
    setAuthSession(data.token, data.user);
    const redirectUrl = new URLSearchParams(window.location.search).get('redirect');
    window.location.href = redirectUrl || '/';
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

  // Skip requireAuth on verify-email page — it handles its own auth state
  if (location.pathname.endsWith('/verify-email.html')) return;

  await requireAuth();
});