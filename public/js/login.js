// Security: Clear any stale sessions/tokens immediately when the login page loads
localStorage.removeItem('token');
localStorage.removeItem('user');
localStorage.removeItem('adminToken');
localStorage.removeItem('adminUser');
localStorage.removeItem('superAdminToken');
localStorage.removeItem('superAdminUser');
sessionStorage.clear();

const API_URL = '/api/auth';
const messageDiv = document.getElementById('message');

function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
}

document.getElementById('loginBtn').addEventListener('click', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    showMessage('Please enter your email and password.', 'error');
    return;
  }

  const loginBtn = document.getElementById('loginBtn');
  loginBtn.textContent = 'Authenticating...';
  loginBtn.disabled = true;

  try {
    const response = await fetch(`${API_URL}/smart-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok && !response.headers.get('content-type')?.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Server returned status ${response.status}: ${text.substring(0, 100)}...`);
    }

    const data = await response.json();

    if (response.ok && data.success) {
      showMessage('Login successful! Redirecting...', 'success');

      const accountType = data.accountType;
      const user = data.user || data;

      const isCustomRole = !['alumni', 'super_admin', 'faculty', 'admin'].includes(accountType);

      if (accountType === 'alumni') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(user));
        setTimeout(() => { window.location.href = 'Alumni/Alumni-Main-Screen'; }, 1500);

      } else if (accountType === 'super_admin') {
        localStorage.setItem('superAdminToken', data.token);
        localStorage.setItem('superAdminUser', JSON.stringify(user));
        setTimeout(() => { window.location.href = 'Admin/SuperAdmin/Super-Admin-Main-Screen'; }, 1500);

      } else if (accountType === 'faculty') {
        // Faculty gets dual-session to access both admin and alumni pages
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(user));
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(user));
        setTimeout(() => { window.location.href = 'Alumni/Alumni-Main-Screen'; }, 1500);

      } else if (isCustomRole) {
        // Custom roles get dual-session to access both admin and alumni pages
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(user));
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(user));
        setTimeout(() => { window.location.href = 'Alumni/Alumni-Main-Screen'; }, 1500);

      } else {
        // Regular admin
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(user));
        setTimeout(() => { window.location.href = 'Admin/Admin/Admin-Main-Screen'; }, 1500);
      }

    } else {
      showMessage(data.message || 'Login failed. Invalid credentials.', 'error');
    }
  } catch (error) {
    console.error('Error during login:', error);
    showMessage('Network error. Ensure your server is running.', 'error');
  } finally {
    loginBtn.textContent = 'Login';
    loginBtn.disabled = false;
  }
});