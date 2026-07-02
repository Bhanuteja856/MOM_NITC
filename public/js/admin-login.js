const API_URL = window.API_URL;

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageDiv = document.getElementById('message');

    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showMessage('Please enter both email and password.', 'error');
            return;
        }

        loginBtn.textContent = 'Authenticating...';
        loginBtn.disabled = true;

        try {
            // Make a POST request strictly to your Node.js Express server
            const response = await fetch(`${API_URL}/admin-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            // Check if the server returned HTML (like a 404 page) instead of JSON
            if (!response.ok && !response.headers.get('content-type')?.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Server returned status ${response.status}: ${text.substring(0, 100)}...`);
            }

            const data = await response.json();

            if (response.ok) {
                showMessage('Login successful! Redirecting...', 'success');

                // Clear any stale sessions/tokens to prevent cross-role URL hopping
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
                localStorage.removeItem('superAdminToken');
                localStorage.removeItem('superAdminUser');

                // Fallback to safely extract user data (in case backend returns data.admin instead of data.user)
                const loggedInUser = data.user || data.admin || data;

                // Check the role and route to the correct dashboard
                if (loggedInUser && loggedInUser.role === 'super_admin') {
                    localStorage.setItem('superAdminToken', data.token);
                    localStorage.setItem('superAdminUser', JSON.stringify(loggedInUser));
                    window.location.href = 'Admin/SuperAdmin/Super-Admin-Main-Screen';
                } else {
                    const isCustomRole = !['super_admin', 'admin', 'faculty'].includes(loggedInUser.role);

                    if (loggedInUser.role === 'faculty' || isCustomRole) {
                        // Give Faculty/Custom roles a dual-session token to access both Admin and Alumni pages
                        localStorage.setItem('adminToken', data.token);
                        localStorage.setItem('adminUser', JSON.stringify(loggedInUser || {}));
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('user', JSON.stringify(loggedInUser || {}));
                        window.location.href = 'Alumni/Alumni-Main-Screen';
                    } else {
                        localStorage.setItem('adminToken', data.token);
                        localStorage.setItem('adminUser', JSON.stringify(loggedInUser || {}));
                        window.location.href = 'Admin/Admin/Admin-Main-Screen';
                    }
                }
            } else {
                showMessage(data.message || 'Login failed. Invalid credentials.', 'error');
            }
        } catch (error) {
            console.error('Error during admin login:', error);
            
            // Provide a more helpful error message directly on the screen
            if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
                showMessage('Network error: Ensure your Node server is running and you are using http://localhost:5000/Admin-login.html', 'error');
            } else {
                showMessage(`Connection Error: ${error.message}`, 'error');
            }
        } finally {
            loginBtn.textContent = 'Secure Login';
            loginBtn.disabled = false;
        }
    });

    function showMessage(msg, type) {
        messageDiv.textContent = msg;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
    }
});