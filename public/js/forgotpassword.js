const API_URL = '/api/auth';

document.addEventListener('DOMContentLoaded', () => {
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const resetPasswordBtn = document.getElementById('resetPasswordBtn');

  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');

  const emailInput = document.getElementById('email');
  const otpInput = document.getElementById('otp');
  const newPasswordInput = document.getElementById('newPassword');

  const messageDiv = document.getElementById('message');

  function showMessage(msg, isError = false) {
    messageDiv.textContent = msg;
    messageDiv.style.display = 'block';
    messageDiv.style.backgroundColor = isError ? '#ffebee' : '#e8f5e9';
    messageDiv.style.color = isError ? '#c62828' : '#2e7d32';
    messageDiv.style.padding = '10px';
    messageDiv.style.borderRadius = '5px';
    messageDiv.style.marginBottom = '15px';
  }

  sendOtpBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) {
      return showMessage('Please enter your email', true);
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = 'Sending...';

    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        showMessage('OTP sent to your email! Valid for 10 minutes.');
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
      } else {
        showMessage(data.message || 'Failed to send OTP', true);
      }
    } catch (error) {
      showMessage('Network error. Please try again.', true);
    } finally {
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = 'Send OTP';
    }
  });

  resetPasswordBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const otp = otpInput.value.trim();
    const newPassword = newPasswordInput.value.trim();

    if (!otp || !newPassword) {
      return showMessage('Please enter both OTP and new password', true);
    }

    if (newPassword.length < 6) {
      return showMessage('Password must be at least 6 characters', true);
    }

    resetPasswordBtn.disabled = true;
    resetPasswordBtn.textContent = 'Resetting...';

    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });

      const data = await response.json();

      if (data.success) {
        showMessage('Password reset successfully! You can now login.');
        step2.classList.add('hidden');
        // Clear inputs
        emailInput.value = '';
        otpInput.value = '';
        newPasswordInput.value = '';
        setTimeout(() => { window.location.href = '/login'; }, 2000);
      } else {
        showMessage(data.message || 'Failed to reset password', true);
      }
    } catch (error) {
      showMessage('Network error. Please try again.', true);
    } finally {
      resetPasswordBtn.disabled = false;
      resetPasswordBtn.textContent = 'Reset Password';
    }
  });
});
