const API_URL = '/api/auth';
const messageDiv = document.getElementById('message');
let base64Image = null;

function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
  setTimeout(() => messageDiv.style.display = 'none', 6000);
}

const fileInput = document.getElementById('profileImage');
const previewImg = document.getElementById('previewImg');

if (fileInput) {
  fileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showMessage("File is too large! Please select an image under 2MB.", 'error');
        fileInput.value = ''; 
        return;
      }
      const reader = new FileReader();
      reader.onload = function(e) {
        base64Image = e.target.result;
        if (previewImg) previewImg.src = e.target.result;
      }
      reader.readAsDataURL(file);
    }
  });
}

document.getElementById('submitRequestBtn').addEventListener('click', async () => {
  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const gradYear = document.getElementById('gradYear').value.trim();
  const reference = document.getElementById('reference').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!fullName || !email || !gradYear || !password || !confirmPassword) {
    return showMessage('Please fill out all required fields.', 'error');
  }

  if (password.length < 6) {
    return showMessage('Password must be at least 6 characters.', 'error');
  }

  if (password !== confirmPassword) {
    return showMessage('Passwords do not match.', 'error');
  }

  try {
    const btn = document.getElementById('submitRequestBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting Request...';

    const res = await fetch(`${API_URL}/legacy-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, gradYear, reference, password, profileImage: base64Image })
    });

    const data = await res.json();
    
    btn.disabled = false;
    btn.textContent = 'Submit Verification Request';

    if (data.success) {
      showMessage('Request submitted successfully! We will notify you once verified.', 'success');
      document.getElementById('fullName').value = '';
      document.getElementById('email').value = '';
      document.getElementById('gradYear').value = '';
      document.getElementById('reference').value = '';
      document.getElementById('password').value = '';
      document.getElementById('confirmPassword').value = '';
      if (fileInput) fileInput.value = '';
      base64Image = null;
      if (previewImg) previewImg.src = 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff';
    } else {
      showMessage(data.message || 'Failed to submit request.', 'error');
    }
  } catch (err) {
    showMessage('Server error. Please try again later.', 'error');
    document.getElementById('submitRequestBtn').disabled = false;
    document.getElementById('submitRequestBtn').textContent = 'Submit Verification Request';
  }
});