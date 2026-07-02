const API_URL = '/api/auth';
const messageDiv = document.getElementById('message');
const otpInputs = document.querySelectorAll('.otp-input');

const email = localStorage.getItem('pendingEmail');
const rollNumber = localStorage.getItem('pendingRollNumber');

if (!email) {
  window.location.href = 'signup';
} else {
  document.getElementById('emailDisplay').textContent = email;
}

function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
  setTimeout(() => messageDiv.style.display = 'none', 5000);
}

// Auto-focus next input
otpInputs.forEach((input, index) => {
  input.addEventListener('input', () => {
    if (input.value && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && index > 0) {
      otpInputs[index - 1].focus();
    }
  });
});

// Paste support for OTP input
document.addEventListener('paste', (e) => {
  const paste = (e.clipboardData || window.clipboardData).getData('text').trim();
  if (/^\d{6}$/.test(paste)) {
    const inputs = document.querySelectorAll('.otp-input');
    paste.split('').forEach((digit, i) => { if (inputs[i]) inputs[i].value = digit; });
    e.preventDefault();
    // Focus the last input automatically
    if (inputs[5]) inputs[5].focus();
  }
});

// Verify OTP
document.getElementById('verifyBtn').addEventListener('click', async () => {
  const otp = Array.from(otpInputs).map(i => i.value.trim()).join('');

  if (otp.length !== 6) {
    return showMessage('Please enter complete 6-digit OTP', 'error');
  }

  try {
    const verifyBtn = document.getElementById('verifyBtn');
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';

    const res = await fetch(`${API_URL}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, rollNumber, otp })
    });

    const data = await res.json();
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify OTP';

    if (!res.ok) {
      return showMessage(data.message || 'OTP verification failed', 'error');
    }

    if (data.success) {
      localStorage.removeItem('pendingEmail');
      localStorage.removeItem('pendingRollNumber');
      showMessage('Email verified! Redirecting to login...', 'success');
      setTimeout(() => {
        window.location.href = 'login';
      }, 1200);
      return;
    }

    showMessage(data.message || 'OTP verification failed', 'error');
  } catch (err) {
    showMessage('Server error. Try again.', 'error');
    document.getElementById('verifyBtn').disabled = false;
    document.getElementById('verifyBtn').textContent = 'Verify OTP';
  }
});

const resendBtn = document.getElementById('resendOtpBtn');
if (resendBtn) {
  resendBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!email || !rollNumber) {
      return showMessage('Missing signup details. Please sign up again.', 'error');
    }

    resendBtn.style.pointerEvents = 'none';
    resendBtn.style.opacity = '0.5';
    resendBtn.textContent = 'Resending...';

    try {
      const res = await fetch(`${API_URL}/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, rollNumber })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMessage('A new OTP has been sent to your email!', 'success');
      } else {
        showMessage(data.message || 'Failed to resend OTP.', 'error');
      }
    } catch (err) {
      showMessage('Network error. Try again.', 'error');
    } finally {
      resendBtn.style.pointerEvents = 'auto';
      resendBtn.style.opacity = '1';
      resendBtn.textContent = 'Resend OTP';
    }
  });
}