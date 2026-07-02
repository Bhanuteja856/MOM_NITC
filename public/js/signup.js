const API_URL = '/api/auth';

const messageDiv = document.getElementById('message');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');

let verifiedRollNumber = '';

function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
  setTimeout(() => messageDiv.style.display = 'none', 5000);
}

// Step 1: Verify Roll Number
document.getElementById('verifyRollBtn').addEventListener('click', async () => {
  const rollNumber = document.getElementById('rollNumber').value.trim();

  if (!rollNumber) {
    return showMessage('Please enter roll number', 'error');
  }

  try {
    const res = await fetch(`${API_URL}/verify-roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber })
    });

    const data = await res.json();

    if (data.success) {
      verifiedRollNumber = rollNumber;
      document.getElementById('alumniName').textContent = data.data.name;
      step1.style.display = 'none';
      step2.style.display = 'block';
      showMessage('Roll number verified! Set your credentials.', 'success');
    } else {
      showMessage(data.message, 'error');
    }
  } catch (err) {
    showMessage('Server error. Try again.', 'error');
  }
});

// Step 2: Sign Up
document.getElementById('signupBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!email || !password) {
    return showMessage('Please fill all fields', 'error');
  }
  if (password.length < 6) {
    return showMessage('Password must be at least 6 characters', 'error');
  }
  if (password !== confirmPassword) {
    return showMessage('Passwords do not match', 'error');
  }

  try {
    const signupBtn = document.getElementById('signupBtn');
    signupBtn.disabled = true;
    signupBtn.textContent = 'Signing up...';

    const res = await fetch(`${API_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber: verifiedRollNumber, email, password })
    });

    const data = await res.json();
    
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';

    if (data.success) {
      showMessage('OTP sent to your email!', 'success');
      // Save email to localStorage for OTP verification page
      localStorage.setItem('pendingEmail', email);
      localStorage.setItem('pendingRollNumber', verifiedRollNumber);
      setTimeout(() => {
        window.location.href = 'verify-otp';
      }, 1500);
    } else {
      showMessage(data.message, 'error');
    }
  } catch (err) {
    showMessage('Server error. Try again.', 'error');
    const btn = document.getElementById('signupBtn') || document.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = false; btn.textContent = 'Sign Up'; }
  }
});