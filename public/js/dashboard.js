 document.getElementById('profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('token');
            
            // Use FormData because we are sending an image file
            const formData = new FormData();
            formData.append('image', document.getElementById('imageInput').files[0]);
            formData.append('dob', document.getElementById('dob').value);
            formData.append('skills', document.getElementById('skills').value);
            formData.append('experience', document.getElementById('experience').value);
            formData.append('companies', document.getElementById('companies').value);

            const res = await fetch('/api/auth/update-profile', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if(data.success) {
                alert('Profile Updated!');
                window.location.href = 'dashboard.html';
            }
        });