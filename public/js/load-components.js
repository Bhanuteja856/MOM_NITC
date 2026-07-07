// ==========================================
// CLIENT-SIDE ROUTER / URL MASKING SYSTEM
// ==========================================
const routes = {
    '#dashboard': '/Alumni/Alumni-Main-Screen',
    '#profile': '/Admin/Admin/Admin-Information',
    '#manage-admins': '/Admin/SuperAdmin/Manage-Admins',
    '#manage-alumni': '/Admin/SuperAdmin/Manage-Alumni',
    '#manage-alumni-admin': '/Admin/Admin/Manage-Alumni-Admin',
    '#role-permissions': '/Admin/SuperAdmin/Manage-Role-Permissions',
    '#approve-alumni': '/Admin/Admin/Alumni-Approval',
    '#super-approve-alumni': '/Admin/SuperAdmin/Alumni-Approval',
    '#approve-events': '/Admin/Admin/event-approval',
    '#create-event': '/Admin/Admin/event-creation',
    '#super-create-event': '/Admin/SuperAdmin/Super-admin-event-creation',
    '#announcements': '/Admin/Admin/Manage-Announcements',
    '#super-announcements': '/Admin/SuperAdmin/Super-Admin-Manage-Announcements',
    '#id-cards': '/Admin/Admin/Manage-ID-Cards',
    '#super-id-cards': '/Admin/SuperAdmin/Manage-ID-Cards',
    '#gallery': '/Alumni/gallary',
    '#admin-gallery': '/Admin/Admin/Admin-gallery',
    '#super-gallery': '/Admin/SuperAdmin/Super-admin-gallery',
    '#videos': '/Admin/Admin/Admin-Videos',
    '#super-videos': '/Admin/SuperAdmin/Super-Admin-Videos',
    '#vouch': '/Alumni/Alumni-Vouching',
    '#alumni-profile': '/Alumni/Alumni-Information',
    '#alumni-details': '/Alumni/Alumni-View-Details',
    '#login': '/login',
    '#admin-login': '/Admin-login',
    '#signup': '/signup',
    '#about': '/about-us'
};
window.routes = routes;

const getResolvedPath = () => {
    let path = window.location.pathname.toLowerCase();
    const hash = window.location.hash;
    if (hash) {
        const hashRoute = hash.split('?')[0];
        if (routes && routes[hashRoute]) {
            return routes[hashRoute].toLowerCase();
        }
    }
    return path;
};
window.getResolvedPath = getResolvedPath;

document.addEventListener("DOMContentLoaded", () => {


    const currentPath = window.getResolvedPath().toLowerCase();

    // 1. If we are on the home page, resolve any hash redirects
    if (currentPath === '/' || currentPath === '/index' || currentPath.endsWith('index')) {
        const fullHash = window.location.hash;
        if (fullHash) {
            const hashParts = fullHash.split('?');
            const hashRoute = hashParts[0];
            const query = hashParts[1] ? '?' + hashParts[1] : '';
            if (routes[hashRoute]) {
                window.location.replace(routes[hashRoute] + query);
                return; // Stop execution on redirect
            }
        }
    }

    // 2. Otherwise, if current page path is mapped to a hash, replace the address bar URL
    let matchingHash = null;
    for (const [hash, routePath] of Object.entries(routes)) {
        if (currentPath === routePath.toLowerCase()) {
            matchingHash = hash;
            break;
        }
    }

    if (matchingHash) {
        const query = window.location.search;
        window.history.replaceState({}, '', '/' + query + matchingHash);
    }

    // Dynamically determine the base URL of the public directory
    const scriptTag = document.querySelector('script[src*="load-components.js"]');
    let publicBaseUrl = '';
    if (scriptTag && scriptTag.src) {
        publicBaseUrl = scriptTag.src.split('/js/load-components.js')[0];
    }

    // Automatically refresh user profile/permissions on page load from the server
    const refreshUserPermissions = async () => {
        let token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('superAdminToken');
        if (!token) return;

        try {
            const apiBase = window.API_URL || '/api/auth';
            const res = await fetch(`${apiBase}/me?_=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    const latestUser = data.user;
                    const role = latestUser.role || latestUser.userType || 'alumni';
                    latestUser.role = role; // Ensure role is explicitly set
                    const isCustomRole = !['super_admin', 'admin', 'faculty', 'alumni'].includes(role);

                    if (role === 'faculty' || isCustomRole) {
                        localStorage.setItem('adminUser', JSON.stringify(latestUser));
                        localStorage.setItem('user', JSON.stringify(latestUser));
                    } else if (role === 'super_admin') {
                        localStorage.setItem('superAdminUser', JSON.stringify(latestUser));
                    } else if (role === 'admin') {
                        localStorage.setItem('adminUser', JSON.stringify(latestUser));
                    } else {
                        localStorage.setItem('user', JSON.stringify(latestUser));
                    }
                    document.dispatchEvent(new CustomEvent('PermissionsRefreshed'));
                }
            }
        } catch (e) {
            console.error("Error refreshing permissions:", e);
        }
    };
    refreshUserPermissions();


    // Dynamically set/update favicon and apple-touch-icon using calculated publicBaseUrl
    let faviconLink = document.querySelector('link[rel="icon"]');
    if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        faviconLink.type = 'image/png';
        document.head.appendChild(faviconLink);
    } else {
        faviconLink.type = 'image/png';
    }
    faviconLink.href = publicBaseUrl + '/logo.png';

    let shortcutLink = document.querySelector('link[rel="shortcut icon"]');
    if (!shortcutLink) {
        shortcutLink = document.createElement('link');
        shortcutLink.rel = 'shortcut icon';
        document.head.appendChild(shortcutLink);
    }
    shortcutLink.href = publicBaseUrl + '/favicon.ico';

    let appleTouchLink = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleTouchLink) {
        appleTouchLink = document.createElement('link');
        appleTouchLink.rel = 'apple-touch-icon';
        document.head.appendChild(appleTouchLink);
    }
    appleTouchLink.href = publicBaseUrl + '/logo.png';

    // Dynamically load the 3D particles background effect if not already present
    if (!document.querySelector('script[src*="3d-effects.js"]')) {
        const script = document.createElement('script');
        script.src = publicBaseUrl + '/js/3d-effects.js';
        script.defer = true;
        document.head.appendChild(script);
    }

    const loadComponent = async (id, file, eventName) => {
        const placeholder = document.getElementById(id);
        if (placeholder) {
            try {
                const fetchUrl = file.startsWith('/') ? publicBaseUrl + file : file;
                const cacheBuster = fetchUrl.includes('?') ? `&_=${Date.now()}` : `?_=${Date.now()}`;
                const response = await fetch(fetchUrl + cacheBuster);
                if (response.ok) {
                    placeholder.innerHTML = await response.text();
                    if (eventName) document.dispatchEvent(new Event(eventName));
                }
            } catch (error) {
                console.error(`Error loading ${file}:`, error);
            }
        }
    };
    // Load specific header based on the data attribute
    const headerPlaceholder = document.getElementById('header-placeholder');
    let headerFile = headerPlaceholder?.getAttribute('data-header') || '/header';

    // Self-healing: If user object was corrupted (overwritten by raw alumni object) or missing for Faculty/Custom roles
    try {
        const uStr = localStorage.getItem('user');
        const aStr = localStorage.getItem('adminUser');
        if (aStr) {
            const aObj = JSON.parse(aStr);
            const isFacultyOrCustom = aObj.role && aObj.role !== 'alumni' && aObj.role !== 'super_admin' && aObj.role !== 'admin';
            if (isFacultyOrCustom) {
                if (!uStr) {
                    localStorage.setItem('user', aStr);
                } else {
                    const uObj = JSON.parse(uStr);
                    if (!uObj.role || uObj.role === 'alumni') {
                        localStorage.setItem('user', aStr);
                    }
                }
            }
        }
    } catch (e) {}

    // Dynamically route faculty or custom roles to their specific headers
    try {
        const userStr = localStorage.getItem('user') || localStorage.getItem('adminUser');
        if (userStr) {
            const user = JSON.parse(userStr);
            const userRole = user.role || user.userType || 'alumni';
            if (userRole === 'faculty' && (headerFile.includes('header-alumni.html') || headerFile.includes('header-admin.html'))) {
                headerFile = '/Headers_Footers_common/header-faculty.html';
            } else {
                const isCustomRole = userRole && !['super_admin', 'admin', 'faculty', 'alumni'].includes(userRole);
                if (isCustomRole && (headerFile.includes('header-alumni.html') || headerFile.includes('header-admin.html'))) {
                    headerFile = '/Headers_Footers_common/header-custom.html';
                }
            }
        }
    } catch (e) { }

    loadComponent('header-placeholder', headerFile, 'HeaderLoaded');

    // Load the shared invite modal
    const modalPlaceholder = document.getElementById('modal-placeholder');
    const modalFile = modalPlaceholder?.getAttribute('data-modal') || '/Headers_Footers_common/invite-modal';
    if (modalPlaceholder) loadComponent('modal-placeholder', modalFile, 'ModalLoaded');

    // ==========================================
    // GLOBAL INVITE BATCHMATES LOGIC
    // ==========================================
    document.addEventListener('click', (e) => {
        // 1. Open Modal
        const inviteLink = e.target.closest('a[href="#Invitational-registration"]');
        if (inviteLink) {
            e.preventDefault();
            const inviteModal = document.getElementById('inviteModal');
            if (inviteModal) {
                try {
                    const userStr = localStorage.getItem('user') || localStorage.getItem('adminUser');
                    if (userStr) {
                        const user = JSON.parse(userStr);
                        if (user.role === 'faculty') {
                            const h3 = inviteModal.querySelector('h3');
                            const p = inviteModal.querySelector('p');
                            if (h3) h3.textContent = 'Invite alumni';
                            if (p) p.textContent = 'Choose how you want to invite people:';
                        }
                    }
                } catch (err) { }

                // Reset modal state
                const optionsSec = document.getElementById('inviteOptionsSection');
                const emailSec = document.getElementById('inviteEmailSection');
                const statusMsg = document.getElementById('inviteStatusMsg');
                const emailInput = document.getElementById('inviteEmailInput');
                if (optionsSec) optionsSec.style.display = 'block';
                if (emailSec) emailSec.style.display = 'none';
                if (statusMsg) statusMsg.style.display = 'none';
                if (emailInput) emailInput.value = '';

                inviteModal.style.display = 'block';
            }
        }
        // 2. Close Modal (X button)
        if (e.target.closest('#closeInviteModal')) {
            const inviteModal = document.getElementById('inviteModal');
            if (inviteModal) inviteModal.style.display = 'none';
        }
        // 3. Close Modal (Clicking outside)
        if (e.target.id === 'inviteModal') {
            e.target.style.display = 'none';
        }
        // 4. Invite via Mail
        if (e.target.closest('#inviteMailBtn')) {
            const optionsSec = document.getElementById('inviteOptionsSection');
            const emailSec = document.getElementById('inviteEmailSection');
            if (optionsSec && emailSec) {
                optionsSec.style.display = 'none';
                emailSec.style.display = 'block';
            }
        }
        // 5. Invite via Link
        if (e.target.closest('#inviteLinkBtn')) {
            const signupLink = window.location.origin + "/signup";
            navigator.clipboard.writeText(signupLink).then(() => {
                alert("Invite link copied to clipboard!");
                const inviteModal = document.getElementById('inviteModal');
                if (inviteModal) inviteModal.style.display = 'none';
            }).catch(err => console.error("Could not copy text: ", err));
        }

        // 6. Back Button in Email Invite Section
        if (e.target.closest('#cancelInviteEmailBtn')) {
            const optionsSec = document.getElementById('inviteOptionsSection');
            const emailSec = document.getElementById('inviteEmailSection');
            if (optionsSec && emailSec) {
                optionsSec.style.display = 'block';
                emailSec.style.display = 'none';
            }
        }

        // 7. Send Invite Email Action
        if (e.target.closest('#sendInviteEmailBtn')) {
            const emailInput = document.getElementById('inviteEmailInput');
            const statusMsg = document.getElementById('inviteStatusMsg');
            const sendBtn = e.target.closest('#sendInviteEmailBtn');

            if (!emailInput || !emailInput.value.trim() || !emailInput.value.includes('@')) {
                if (statusMsg) {
                    statusMsg.textContent = 'Please enter a valid email address.';
                    statusMsg.style.display = 'block';
                    statusMsg.style.backgroundColor = '#f8d7da';
                    statusMsg.style.color = '#721c24';
                }
                return;
            }
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';

            let token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('superAdminToken');
            fetch(`${window.API_URL || '/api/auth'}/send-invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ targetEmail: emailInput.value.trim() })
            }).then(res => res.json()).then(data => {
                if (data.success) {
                    if (statusMsg) {
                        statusMsg.textContent = 'Invitation sent successfully!';
                        statusMsg.style.display = 'block';
                        statusMsg.style.backgroundColor = '#d4edda';
                        statusMsg.style.color = '#155724';
                    }
                    emailInput.value = '';
                    setTimeout(() => { const inviteModal = document.getElementById('inviteModal'); if (inviteModal) inviteModal.style.display = 'none'; }, 2000);
                } else throw new Error(data.message || 'Failed to send invite.');
            }).catch(err => {
                if (statusMsg) {
                    statusMsg.textContent = err.message || 'Network error occurred.';
                    statusMsg.style.display = 'block';
                    statusMsg.style.backgroundColor = '#f8d7da';
                    statusMsg.style.color = '#721c24';
                }
            }).finally(() => {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send Invite';
            });
        }

        // 8. Global Logout Handler
        if (e.target && e.target.closest && e.target.closest('#logoutBtn')) {
            e.preventDefault();

            const btn = e.target.closest('#logoutBtn');
            btn.style.pointerEvents = 'none';
            btn.innerHTML = `<svg style="animation: spin 1s linear infinite;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line></svg> Logging out...`;

            const isAdminUser = localStorage.getItem('adminUser') || localStorage.getItem('superAdminUser');

            fetch(`${window.API_URL || '/api/auth'}/logout`, { method: 'POST' }).finally(() => {
                const isDarkMode = localStorage.getItem('darkMode');
                localStorage.clear();
                if (isDarkMode !== null) localStorage.setItem('darkMode', isDarkMode);
                sessionStorage.clear();
                window.location.href = isAdminUser ? '/Admin-login' : '/login';
            });
        }
    });

    // Load the shared footer
    let footerPlaceholder = document.getElementById('footer-placeholder');
    const isAuthPage = ['login', 'signup', 'forgot', 'otp', 'register'].some(kw => window.getResolvedPath().toLowerCase().includes(kw));
    if (!footerPlaceholder && !isAuthPage) {
        footerPlaceholder = document.createElement('div');
        footerPlaceholder.id = 'footer-placeholder';
        document.body.appendChild(footerPlaceholder);
    }
    const footerFile = footerPlaceholder?.getAttribute('data-footer') || '/Headers_Footers_common/footer';
    loadComponent('footer-placeholder', footerFile, 'FooterLoaded');

    // ==========================================
    // ACTIVE SESSION ADJUSTMENTS (HEADER & FOOTER)
    // ==========================================
    const adjustActiveSessionUI = () => {
        const hasSuperAdmin = localStorage.getItem('superAdminUser');
        const hasAdmin = localStorage.getItem('adminUser');
        const hasAlumni = localStorage.getItem('user');

        if (hasSuperAdmin || hasAdmin || hasAlumni) {
            let dashboardUrl = '';
            if (hasSuperAdmin) {
                dashboardUrl = publicBaseUrl + '/Admin/SuperAdmin/Super-Admin-Main-Screen';
            } else {
                let userObj = null;
                if (hasAdmin) {
                    try { userObj = JSON.parse(hasAdmin); } catch (e) { }
                } else if (hasAlumni) {
                    try { userObj = JSON.parse(hasAlumni); } catch (e) { }
                }

                const isCustomRole = userObj && userObj.role && !['super_admin', 'admin', 'faculty', 'alumni'].includes(userObj.role);
                if (userObj && (userObj.role === 'faculty' || isCustomRole)) {
                    dashboardUrl = publicBaseUrl + '/Alumni/Alumni-Main-Screen';
                } else if (hasAdmin) {
                    dashboardUrl = publicBaseUrl + '/Admin/Admin/Admin-Main-Screen';
                } else {
                    dashboardUrl = publicBaseUrl + '/Alumni/Alumni-Main-Screen';
                }
            }

            // 1. Update Header Nav Links (login -> dashboard, register -> logout)
            const navLinks = document.getElementById('navLinks');
            if (navLinks) {
                const loginLink = navLinks.querySelector('a[href*="login"]');
                const registerLink = navLinks.querySelector('a[href*="signup"]');

                if (loginLink) {
                    loginLink.href = dashboardUrl;
                    loginLink.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="3" x2="9" y2="21"></line>
                        </svg> Dashboard
                    `;
                }
                if (registerLink) {
                    registerLink.href = '#';
                    registerLink.id = 'logoutBtn';
                    registerLink.classList.remove('btn-primary');
                    registerLink.classList.add('btn-outline');
                    registerLink.style.borderColor = '#dc3545';
                    registerLink.style.color = '#dc3545';
                    registerLink.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg> Logout
                    `;
                    registerLink.setAttribute('onmouseover', "this.style.backgroundColor='rgba(220, 53, 69, 0.1)'; this.style.transform='translateY(-2px)';");
                    registerLink.setAttribute('onmouseout', "this.style.backgroundColor='transparent'; this.style.transform='translateY(0)';");
                }
            }

            // 2. Update Feature Cards (e.g. on index.html)
            document.querySelectorAll('a[href*="login"]').forEach(link => {
                if (!link.closest('#navLinks') && !link.closest('#footer-placeholder')) {
                    link.href = dashboardUrl;
                }
            });

            // 3. Update Footer Links
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                const footerLoginLink = footerPlaceholder.querySelector('a[href*="/login"]') || footerPlaceholder.querySelector('a[href="login"]');
                const footerRegisterLink = footerPlaceholder.querySelector('a[href*="/signup"]') || footerPlaceholder.querySelector('a[href="signup"]');

                if (footerLoginLink) {
                    footerLoginLink.href = dashboardUrl;
                    footerLoginLink.textContent = 'Dashboard';
                }
                if (footerRegisterLink) {
                    footerRegisterLink.href = '#';
                    footerRegisterLink.id = 'logoutBtn';
                    footerRegisterLink.textContent = 'Logout';
                }
            }
        }
    };

    // Run session adjustments immediately for header elements
    adjustActiveSessionUI();

    // Run session adjustments and current year updates when footer loads
    document.addEventListener('FooterLoaded', () => {
        // Set Current Year
        const currentYearEl = document.getElementById('currentYear');
        if (currentYearEl) {
            currentYearEl.textContent = new Date().getFullYear();
        }

        // Adjust session links in footer
        adjustActiveSessionUI();

        // Back-to-Top Button Functionality
        const backToTopBtn = document.getElementById('backToTopBtn');
        if (backToTopBtn) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) {
                    backToTopBtn.classList.add('show');
                } else {
                    backToTopBtn.classList.remove('show');
                }
            });

            backToTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    });

    // ==========================================
    // AUTO-LOGOUT INACTIVITY TIMER (30 MINUTES)
    // ==========================================
    const hasSession = localStorage.getItem('user') || localStorage.getItem('adminUser') || localStorage.getItem('superAdminUser');
    if (hasSession && !window.getResolvedPath().toLowerCase().includes('login')) {
        const INACTIVITY_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds
        let timeoutId;

        const logoutUser = () => {
            fetch(`${window.API_URL || '/api/auth'}/logout`, { method: 'POST' }).finally(() => {
                const isDarkMode = localStorage.getItem('darkMode');
                localStorage.clear(); // Wipe all session data
                if (isDarkMode !== null) localStorage.setItem('darkMode', isDarkMode);
                alert('Your session has expired due to 30 minutes of inactivity. Please log in again.');

                if (window.getResolvedPath().includes('/Admin/') || window.getResolvedPath().includes('/SuperAdmin/')) {
                    window.location.href = '../../Admin-login.html';
                } else {
                    window.location.href = '../login.html';
                }
            });
        };

        const resetTimer = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(logoutUser, INACTIVITY_TIME);
        };

        // Listen for user activity with passive listeners for performance
        ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(event => {
            window.addEventListener(event, resetTimer, { passive: true });
        });

        // Start the timer initially
        resetTimer();
    }

    // ==========================================
    // DARK MODE TOGGLE (GLOBAL)
    // ==========================================
    const setupDarkMode = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            /* Global smooth transition for theme toggling */
            body, header, footer, .form-section, .profile-card, .left-sidebar, .right-sidebar, .announcement-card, .video-card, .modal-content, input, select, textarea, .stat-item {
                transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
            }

            /* Fix for long dropdown menus getting cut off on smaller screens */
            .dropdown-content, .profile-dropdown, .notification-dropdown {
                max-height: 55vh !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                z-index: 99999 !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
                backdrop-filter: blur(10px);
            }
            /* Flex layout for menu links + icon support */
            .dropdown-content a {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
            }
            .dropdown-content a[style*="display: none"], .dropdown-content a[style*="display:none"] {
                display: none !important;
            }
            .dropdown-content a span:first-child svg {
                width: 18px !important;
                height: 18px !important;
                display: block !important;
                flex-shrink: 0 !important;
            }
            /* Beautiful custom scrollbars */
            .dropdown-content::-webkit-scrollbar, .notification-dropdown::-webkit-scrollbar, .announcements-scroll-container::-webkit-scrollbar { width: 6px; }
            .dropdown-content::-webkit-scrollbar-track, .notification-dropdown::-webkit-scrollbar-track, .announcements-scroll-container::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 4px; }
            .dropdown-content::-webkit-scrollbar-thumb, .notification-dropdown::-webkit-scrollbar-thumb, .announcements-scroll-container::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 4px; }
            
            /* Premium Slate Dark Mode Palette */
            body.dark-mode { background-color: #0f172a !important; color: #f1f5f9 !important; background-image: none !important; }
            .dark-mode .form-section, .dark-mode .profile-card, .dark-mode .approval-card, .dark-mode .vouch-card, .dark-mode .left-sidebar, .dark-mode .right-sidebar, .dark-mode .event-card, .dark-mode .announcement-card, .dark-mode .modal-content, .dark-mode .gallery-upload-sidebar, .dark-mode .info-box, .dark-mode .detail-item, .dark-mode .my-event-card, .dark-mode .chart-box, .dark-mode .instructions, .dark-mode .file-upload-wrapper, .dark-mode .dnd-box, .dark-mode .empty-state, .dark-mode .profile-card-left, .dark-mode .post-event-container, .dark-mode .event-meta, .dark-mode .no-events, .dark-mode .container, .dark-mode .profile-header, .dark-mode .profile-card-view, .dark-mode .sub-list li, .dark-mode .upload-section, .dark-mode .gallery-item, .dark-mode .image-modal-content, .dark-mode #enlargedCaption, .dark-mode .magazine-card, .dark-mode .announcement-box, .dark-mode .video-card { background-color: #1e293b !important; color: #f8fafc !important; border-color: #334155 !important; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3) !important; }
            .dark-mode [style*="background: white"], .dark-mode [style*="background-color: white"], .dark-mode [style*="background: #fff"], .dark-mode [style*="background-color: #fff"], .dark-mode [style*="background: #f9f9f9"], .dark-mode [style*="background-color: #f9f9f9"], .dark-mode [style*="background: #e9ecef"], .dark-mode [style*="background-color: #e9ecef"], .dark-mode [style*="background: #f8f9fa"], .dark-mode [style*="background-color: #f8f9fa"], .dark-mode [style*="background: #f4f6f8"], .dark-mode [style*="background-color: #f4f6f8"], .dark-mode [style*="background: #f0f0f0"], .dark-mode [style*="background-color: #f0f0f0"] { background-color: #1e293b !important; color: #f8fafc !important; border-color: #334155 !important; }
            .dark-mode h1, .dark-mode h2, .dark-mode h3, .dark-mode h4, .dark-mode p:not(.error-text):not(.success-text), .dark-mode span:not(.notification-badge):not(.category-badge):not(.meta):not(.date), .dark-mode label, .dark-mode td { color: #e0e0e0 !important; }
            .dark-mode .form-group input, .dark-mode .form-group textarea, .dark-mode .form-group select, .dark-mode textarea { background-color: #0f172a !important; color: #f8fafc !important; border-color: #475569 !important; }
            .dark-mode input:focus, .dark-mode textarea:focus, .dark-mode select:focus { border-color: #60a5fa !important; box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.3) !important; }
            .dark-mode .category-badge { background-color: #0c4a6e !important; color: #bae6fd !important; }
            .dark-mode #loadingOverlay { background-color: rgba(15, 23, 42, 0.9) !important; }
            .dark-mode input[readonly] { background-color: #444 !important; }
            .dark-mode hr { border-color: #334155 !important; }
            .dark-mode header, .dark-mode footer, .dark-mode .notification-header { background-color: #1e293b !important; border-color: #334155 !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5) !important; }
            .dark-mode .scrolling-ticker { background-color: #be185d !important; color: #fde047 !important; border-color: #334155 !important; }
            .dark-mode .dropdown-content, .dark-mode .notification-dropdown, .dark-mode .profile-dropdown { background-color: rgba(30, 41, 59, 0.95) !important; border-color: #334155 !important; }
            .dark-mode .dropdown-content a, .dark-mode .notification-item, .dark-mode .profile-dropdown a { color: #f1f5f9 !important; border-color: #334155 !important;}
            .dark-mode .dropdown-content a:hover, .dark-mode .notification-item:hover, .dark-mode .profile-dropdown a:hover { background-color: #334155 !important; color: #60a5fa !important; }
            .dark-mode .dropdown-content a[style*="font-weight: bold"], .dark-mode .profile-dropdown a[style*="font-weight: bold"], .dark-mode .notification-item[style*="font-weight: bold"] { background-color: #3d3d3d !important; color: #ffffff !important; }
            .dark-mode .notification-item div[style*="color: #444"] { color: #e0e0e0 !important; }
            .dark-mode .user-info, .dark-mode .user-details, .dark-mode .user-name, .dark-mode .user-email { color: #e0e0e0 !important; }
            .dark-mode table th { background-color: #1e293b !important; color: #f8fafc !important; border-color: #334155 !important; }
            .dark-mode table td { color: #e2e8f0 !important; border-color: #334155 !important; }
            .dark-mode table tr { border-color: #334155 !important; transition: background-color 0.2s; }
            .dark-mode table tr:hover td { background-color: #0f172a !important; }
            .dark-mode .main-container { background-color: transparent !important; }
            .dark-mode strong { color: #fff !important; }
            
            /* Soft Touch - View Details & Profile Accents */
            .dark-mode .profile-card-view { background-color: #1e293b !important; box-shadow: 0 10px 25px rgba(0,0,0,0.5) !important; border: 1px solid #334155 !important; }
            .dark-mode .profile-card-left { background-color: #0f172a !important; } /* Soft, elegant dark slate-blue */
            .dark-mode .profile-card-left p { color: #94a3b8 !important; }
            .dark-mode .detail-section h3 { color: #60a5fa !important; border-bottom-color: #334155 !important; }
            .dark-mode .detail-item, .dark-mode .sub-list li { background-color: #0f172a !important; border-left-color: #3b82f6 !important; }
            .dark-mode .detail-item label { color: #9ca3af !important; } /* Soft grey for labels */
            .dark-mode .detail-item a { color: #93c5fd !important; text-decoration: underline; }
            .dark-mode a[style*="color: #0D8ABC"] { color: #60a5fa !important; } /* Fixes hardcoded dark-blue links */
            .dark-mode .announcement { background: #1e293b !important; border-left-color: #fbc02d !important; border: 1px solid #334155 !important; }
            .dark-mode .announcement h4, .dark-mode .announcement-card h4, .dark-mode .announcement-details h4 { color: #60a5fa !important; }
            .dark-mode .announcement p, .dark-mode .announcement-card p, .dark-mode .announcement-details p { color: #e2e8f0 !important; }
            .dark-mode .announcement .date, .dark-mode .announcement-card .meta, .dark-mode .announcement-details .meta { color: #94a3b8 !important; }
            
            /* Auth Screens (Login/Signup) */
            .dark-mode .role-selector label[style*="background: white"] { background-color: #1e293b !important; color: #e0e0e0 !important; border-color: #475569 !important; }
            .dark-mode .link-text a { color: #60a5fa !important; }
            
            .header-theme-toggle {
                cursor: pointer; font-size: 22px; margin-right: 20px; user-select: none;
                transition: transform 0.3s ease, background-color 0.3s ease; display: flex;
                align-items: center; justify-content: center; width: 40px; height: 40px;
                border-radius: 50%; background-color: rgba(0,0,0,0.05); color: #334155;
            }
            .header-theme-toggle:hover {
                transform: scale(1.1); background-color: rgba(0,0,0,0.1);
            }
            .dark-mode .header-theme-toggle {
                background-color: rgba(255,255,255,0.1); color: #f1f5f9;
            }
            .dark-mode .header-theme-toggle:hover { background-color: rgba(255,255,255,0.2); }
        `;
        document.head.appendChild(style);

        const isDark = localStorage.getItem('darkMode') === 'true';
        if (isDark) document.body.classList.add('dark-mode');

        // Modern SVG Icons for the Toggle
        const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
        const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

        // Global Helper to Update Chart.js Theme Colors
        window.updateChartsTheme = (isDarkMode) => {
            if (window.Chart && window.Chart.defaults) {
                window.Chart.defaults.color = isDarkMode ? '#f1f5f9' : '#111827';
                if (window.Chart.defaults.scale && window.Chart.defaults.scale.grid) {
                    window.Chart.defaults.scale.grid.color = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
                }
                for (let id in window.Chart.instances) {
                    window.Chart.instances[id].update();
                }
            }
        };

        const injectThemeToggle = () => {
            if (document.querySelector('.header-theme-toggle')) return;

            const toggleBtn = document.createElement('div');
            toggleBtn.className = 'header-theme-toggle';
            toggleBtn.innerHTML = isDark ? sunIcon : moonIcon;
            toggleBtn.title = "Toggle Dark/Light Mode";

            toggleBtn.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                const currentlyDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('darkMode', currentlyDark);
                toggleBtn.innerHTML = currentlyDark ? sunIcon : moonIcon;
                window.updateChartsTheme(currentlyDark);
            });

            // Insert the toggle button right before the notification bell (or profile icon) in the header
            const insertTarget = document.querySelector('.notification-bell') || document.querySelector('.profile-menu');
            const navLinks = document.querySelector('.nav-links'); // Targets the index.html navigation
            const container = document.querySelector('.container'); // Targets public card screens (Login, Signup, Legacy Signup, etc.)

            if (insertTarget && insertTarget.parentNode) {
                insertTarget.parentNode.insertBefore(toggleBtn, insertTarget);
            } else if (navLinks) {
                // Inject perfectly next to the Login button on the landing page
                navLinks.insertBefore(toggleBtn, navLinks.firstChild);
            } else if (container) {
                // Absolute position inside the card container to stay inside bounds
                toggleBtn.style.position = 'absolute';
                toggleBtn.style.top = '15px';
                toggleBtn.style.right = '15px';
                toggleBtn.style.margin = '0';
                toggleBtn.style.zIndex = '100';
                container.appendChild(toggleBtn);
            } else {
                // Fallback for public auth screens (Login, Signup, etc.)
                toggleBtn.style.position = 'fixed';
                toggleBtn.style.top = '20px';
                toggleBtn.style.right = '20px';
                toggleBtn.style.margin = '0';
                toggleBtn.style.zIndex = '9999';
                document.body.appendChild(toggleBtn);
            }
        };

        // Sync Dark Mode across multiple open tabs instantly
        window.addEventListener('storage', (e) => {
            if (e.key === 'darkMode') {
                const isNowDark = e.newValue === 'true';
                if (isNowDark) document.body.classList.add('dark-mode');
                else document.body.classList.remove('dark-mode');

                const toggleBtns = document.querySelectorAll('.header-theme-toggle');
                toggleBtns.forEach(btn => btn.innerHTML = isNowDark ? sunIcon : moonIcon);
                if (window.updateChartsTheme) window.updateChartsTheme(isNowDark);
            }
        });

        if (document.getElementById('header-placeholder')) {
            document.addEventListener('HeaderLoaded', injectThemeToggle);
        } else {
            injectThemeToggle();
        }
    };
    setupDarkMode();
});
// -------------------------------------------------------------
// Global function to handle Batchmate Verification votes
window.vouchBatchmate = async function (userId, knows, event) {
    if (event) event.stopPropagation();

    let token = localStorage.getItem('token');
    if (window.getResolvedPath().includes('/SuperAdmin') || window.getResolvedPath().includes('Super-Admin')) token = localStorage.getItem('superAdminToken');
    else if (window.getResolvedPath().includes('/Admin')) token = localStorage.getItem('adminToken');

    try {
        const res = await fetch(`${window.API_URL}/legacy-vouch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ targetUserId: userId, knows })
        });
        const data = await res.json();
        if (res.ok) {
            alert(knows ? 'Thank you for verifying your batchmate!' : 'Thank you for your feedback. Admins will review it.');
            const notifEl = document.getElementById(`notif-${userId}`);
            if (notifEl) notifEl.style.display = 'none';
        } else {
            alert(data.message || 'Failed to submit response.');
        }
    } catch (err) {
        console.error("Vouch Error:", err);
        alert('Network error while submitting response.');
    }
};

// // Global logic to highlight the currently active page in the dropdown menu
document.addEventListener('HeaderLoaded', () => {
    const currentPage = window.getResolvedPath().split('/').pop();
    if (!currentPage) return;

    const dropdownLinks = document.querySelectorAll('.dropdown-content a');

    let activeColor = '#0D8ABC'; // Default Alumni blue
    if (window.getResolvedPath().includes('/SuperAdmin') || window.getResolvedPath().includes('Super-Admin')) {
        activeColor = '#4a148c'; // Super Admin purple
    } else if (window.getResolvedPath().includes('/Admin')) {
        activeColor = '#c62828'; // Admin red
    }

    dropdownLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref && linkHref.toLowerCase() === currentPage.toLowerCase()) {
            link.style.fontWeight = 'bold';
            link.style.color = activeColor;
            link.style.backgroundColor = '#f4f6f8';
            link.style.borderLeft = `4px solid ${activeColor}`;
        }
    });

    // ==========================================
    // MENU ICONS INJECTION (Light & Dark Mode Sync)
    // ==========================================
    const menuIconMap = {
        'dashboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>',
        'my profile': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        'admin profile': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        'admin dashboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>',
        'post events': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>',
        'view the events': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
        'invite batchmates': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>',
        'invite alumni': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>',
        'verify batchmates': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        'verify alumni': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        'gallery': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
        'post magazines': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
        'manage alumni': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
        'event creation': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="12" y1="14" x2="12" y2="18"></line><line x1="10" y1="16" x2="14" y2="16"></line></svg>',
        'alumni approval': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
        'event approval': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        'announcements': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>',
        'manage id cards': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
        'manage gallery': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
        'manage videos': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
        'logout': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
    };

    const allMenuLinks = document.querySelectorAll('.dropdown-content a, .profile-dropdown a, #logoutBtn');
    allMenuLinks.forEach(link => {
        if (link.querySelector('svg')) return; // Prevent duplicates

        const label = link.textContent.trim().toLowerCase();
        let iconSvg = menuIconMap[label];

        // Fallbacks for sub-string matches if not exact
        if (!iconSvg) {
            if (label.includes('profile') || label.includes('information')) {
                iconSvg = menuIconMap['my profile'];
            } else if (label.includes('dashboard') || label.includes('home')) {
                iconSvg = menuIconMap['dashboard'];
            } else if (label.includes('logout') || label.includes('log out')) {
                iconSvg = menuIconMap['logout'];
            } else if (label.includes('manage alumni') || label.includes('manage admins') || label.includes('directory')) {
                iconSvg = menuIconMap['manage alumni'];
            } else if (label.includes('event creation') || label.includes('post event') || label.includes('postevents')) {
                iconSvg = menuIconMap['event creation'];
            } else if (label.includes('alumni approval') || label.includes('verify')) {
                iconSvg = menuIconMap['alumni approval'];
            } else if (label.includes('event approval')) {
                iconSvg = menuIconMap['event approval'];
            } else if (label.includes('announcement') || label.includes('alert')) {
                iconSvg = menuIconMap['announcements'];
            } else if (label.includes('gallery') || label.includes('picture')) {
                iconSvg = menuIconMap['gallery'];
            } else if (label.includes('magazine') || label.includes('newsletter')) {
                iconSvg = menuIconMap['post magazines'];
            } else if (label.includes('id card')) {
                iconSvg = menuIconMap['manage id cards'];
            } else if (label.includes('video')) {
                iconSvg = menuIconMap['manage videos'];
            } else {
                iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
            }
        }

        if (iconSvg) {
            const wasHidden = link.style.display === 'none';
            const originalText = link.textContent.trim();
            // Clear and rebuild content
            link.textContent = '';
            const svgWrapper = document.createElement('span');
            svgWrapper.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:18px;height:18px;min-width:18px;opacity:0.75;transition:opacity 0.2s;';
            svgWrapper.innerHTML = iconSvg;
            // Make the inner SVG explicitly sized
            const svgEl = svgWrapper.querySelector('svg');
            if (svgEl) {
                svgEl.setAttribute('width', '18');
                svgEl.setAttribute('height', '18');
                svgEl.style.display = 'block';
            }
            link.appendChild(svgWrapper);
            link.appendChild(document.createTextNode(originalText));
            // Use setProperty with 'important' flag
            if (wasHidden) {
                link.style.setProperty('display', 'none', 'important');
            } else {
                link.style.setProperty('display', 'flex', 'important');
                link.style.setProperty('align-items', 'center', 'important');
                link.style.setProperty('gap', '10px', 'important');
            }
            // Hover effects on icon
            link.addEventListener('mouseenter', () => { svgWrapper.style.opacity = '1'; });
            link.addEventListener('mouseleave', () => { svgWrapper.style.opacity = '0.75'; });
        }
    });


    // ==========================================
    // ROLE-BASED DROPDOWN MENU LOGIC
    // ==========================================
    const applyRolePermissions = () => {
        const setLinkDisplay = (el, val) => {
            if (el) el.style.setProperty('display', val, 'important');
        };

        const userStr = localStorage.getItem('user');
        const adminUserStr = localStorage.getItem('adminUser');

        let userObj = null;
        let adminUserObj = null;
        try { if (userStr) userObj = JSON.parse(userStr); } catch(e){}
        try { if (adminUserStr) adminUserObj = JSON.parse(adminUserStr); } catch(e){}

        // Sync welcome name display and profile image if present
        try {
            const activeUserObj = adminUserObj || userObj;
            if (activeUserObj && activeUserObj.name) {
                const alumniNameEl = document.getElementById('alumniNameDisplay');
                if (alumniNameEl) alumniNameEl.textContent = activeUserObj.name;
                const adminNameEl = document.getElementById('adminNameDisplay');
                if (adminNameEl) adminNameEl.textContent = activeUserObj.name;
                const headerProfilePic = document.getElementById('headerProfilePic');
                if (headerProfilePic) {
                    let avatarColor = '0D8ABC';
                    if (activeUserObj.role === 'super_admin') avatarColor = '4a148c';
                    else if (activeUserObj.role === 'admin') avatarColor = 'c62828';
                    headerProfilePic.src = activeUserObj.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeUserObj.name)}&background=${avatarColor}&color=fff`;
                }
            }
        } catch (e) { }

        // Determine effective user for faculty/custom role checks
        const adminRole = adminUserObj ? (adminUserObj.role || adminUserObj.userType || 'admin') : '';
        const effectiveUser = (adminUserObj && (adminRole === 'faculty' || !['super_admin', 'admin', 'faculty', 'alumni'].includes(adminRole))) 
            ? adminUserObj 
            : userObj;

        // Handle Alumni Header (Faculty View)
        if (effectiveUser && document.getElementById('navProfileLink')) {
            try {
                const user = effectiveUser;
                const userRole = user.role || user.userType || 'alumni';
                const isCustomRole = !['super_admin', 'admin', 'faculty', 'alumni'].includes(userRole);
                if (isCustomRole) {
                    const dashboardLink = document.getElementById('navDashboardLink');
                    if (dashboardLink) {
                        setLinkDisplay(dashboardLink, 'flex');
                        dashboardLink.href = '/Alumni/Alumni-Main-Screen';
                    }
                    const profileLink = document.getElementById('navProfileLink');
                    if (profileLink) {
                        setLinkDisplay(profileLink, 'flex');
                        profileLink.href = '/Admin/Admin/Admin-Information';
                    }
                    const galleryLink = document.getElementById('navGalleryLink');
                    if (galleryLink) {
                        setLinkDisplay(galleryLink, 'flex');
                        galleryLink.href = '/Alumni/gallary';
                    }

                    // Hide all standard alumni links (not admin-menu) except dashboard, profile, gallery, and logout
                    const alumniLinks = document.querySelectorAll('.dropdown-content a:not(.admin-menu):not(#navDashboardLink):not(#navProfileLink):not(#navGalleryLink):not(#logoutBtn)');
                    alumniLinks.forEach(link => setLinkDisplay(link, 'none'));

                    // Handle admin menus based on permissions
                    const menusToUse = Array.isArray(user.accessibleMenus) ? user.accessibleMenus : [];
                    const adminMenus = document.querySelectorAll('.dropdown-content a.admin-menu');
                    adminMenus.forEach(link => {
                        const menuAttr = link.getAttribute('data-menu');
                        if (menuAttr === 'Dashboard' || menuAttr === 'My Profile') {
                            setLinkDisplay(link, 'none'); // Replaced by navDashboardLink and navProfileLink
                        } else {
                            const isAllowed = menusToUse.includes(menuAttr);
                            setLinkDisplay(link, isAllowed ? 'flex' : 'none');
                        }
                    });
                } else if (userRole === 'faculty') {
                    const menusToUse = Array.isArray(user.accessibleMenus) ? user.accessibleMenus : [];
                    const adminMenus = document.querySelectorAll('.dropdown-content a.admin-menu');
                    adminMenus.forEach(link => {
                        const menuAttr = link.getAttribute('data-menu');
                        if (menuAttr === 'Dashboard' || menuAttr === 'My Profile') {
                            setLinkDisplay(link, 'none'); // Replaced by navDashboardLink and navProfileLink
                        } else {
                            const isAllowed = menusToUse.includes(menuAttr);
                            setLinkDisplay(link, isAllowed ? 'flex' : 'none');
                        }
                    });
                    const profileLink = document.getElementById('navProfileLink');

                    if (profileLink) profileLink.href = '/Admin/Admin/Admin-Information';

                    const inviteLink = document.getElementById('navInviteLink');
                    if (inviteLink) inviteLink.innerHTML = inviteLink.innerHTML.replace('Invite Batchmates', 'Invite Alumni');

                    const verifyLink = document.getElementById('navVerifyLink');
                    if (verifyLink) verifyLink.innerHTML = verifyLink.innerHTML.replace('Verify Batchmates', 'Verify Alumni');
                }
            } catch (e) { }
        }

        // Handle Admin Header (Faculty & Admin View)
        if (adminUserStr && !document.getElementById('navProfileLink')) {
            try {
                const user = JSON.parse(adminUserStr);

                const nameDisplay = document.getElementById('adminNameDisplay');
                if (nameDisplay && user.name) nameDisplay.textContent = user.name;

                // Get all potentially controlled links
                const allDataMenuLinks = document.querySelectorAll('.dropdown-content a[data-menu]');
                const facultyMenuLinks = document.querySelectorAll('.dropdown-content a.faculty-menu');
                const adminDashboardLink = document.getElementById('adminDashboardLink');
                const adminProfileLink = document.getElementById('adminProfileLink');

                const isCustomRole = !['super_admin', 'admin', 'faculty'].includes(user.role);

                if (isCustomRole) {
                    if (adminDashboardLink) {
                        setLinkDisplay(adminDashboardLink, 'flex');
                        adminDashboardLink.href = '/Alumni/Alumni-Main-Screen';
                    }
                    if (adminProfileLink) {
                        setLinkDisplay(adminProfileLink, 'flex');
                        adminProfileLink.href = '/Admin/Admin/Admin-Information';
                    }

                    // Hide any faculty-specific links
                    facultyMenuLinks.forEach(link => setLinkDisplay(link, 'none'));

                    // Handle data-menu links based on permissions
                    const menusToUse = Array.isArray(user.accessibleMenus) ? user.accessibleMenus : [];
                    allDataMenuLinks.forEach(link => {
                        const menuAttr = link.getAttribute('data-menu');
                        const isAllowed = menusToUse.includes(menuAttr);
                        setLinkDisplay(link, isAllowed ? 'flex' : 'none');
                    });

                    // Adjust logo link if present
                    const logoLink = document.querySelector('header a[href*="Admin-Main-Screen"]');
                    if (logoLink) {
                        logoLink.href = '/Alumni/Alumni-Main-Screen';
                    }
                } else if (user.role === 'super_admin') {
                    // Super admin sees everything, so do nothing (links are visible by default in HTML)
                } else if (user.role === 'faculty') {
                    if (adminDashboardLink) setLinkDisplay(adminDashboardLink, 'none');
                    if (adminProfileLink) setLinkDisplay(adminProfileLink, 'none');
                    // Show faculty-specific links
                    facultyMenuLinks.forEach(link => {
                        setLinkDisplay(link, 'flex');
                        if (link.innerHTML.includes('Invite Batchmates')) {
                            link.innerHTML = link.innerHTML.replace('Invite Batchmates', 'Invite Alumni');
                        }
                        if (link.innerHTML.includes('Verify Batchmates')) {
                            link.innerHTML = link.innerHTML.replace('Verify Batchmates', 'Verify Alumni');
                        }
                    });
                    // Handle data-menu links based on permissions
                    const menusToUse = Array.isArray(user.accessibleMenus) ? user.accessibleMenus : [];
                    allDataMenuLinks.forEach(link => {
                        const isAllowed = menusToUse.includes(link.getAttribute('data-menu'));
                        setLinkDisplay(link, isAllowed ? 'flex' : 'none');
                    });
                } else { // Standard 'admin'
                    // Hide any faculty-specific links
                    facultyMenuLinks.forEach(link => setLinkDisplay(link, 'none'));
                    // Handle data-menu links based on permissions
                    const defaultAdminMenus = ['Manage Alumni', 'Event Creation', 'Alumni Approval', 'Event Approval', 'Announcements', 'Manage Gallery', 'Manage ID Cards'];
                    const menusToUse = Array.isArray(user.accessibleMenus) ? user.accessibleMenus : defaultAdminMenus;
                    allDataMenuLinks.forEach(link => {
                        if (menusToUse.includes(link.getAttribute('data-menu'))) {
                            setLinkDisplay(link, 'flex');
                        } else {
                            setLinkDisplay(link, 'none');
                        }
                    });
                }
            } catch (e) { console.error("Error processing admin menu roles:", e); }
        }
    };
    window.applyRolePermissions = applyRolePermissions;

    document.addEventListener('HeaderLoaded', applyRolePermissions);
    document.addEventListener('PermissionsRefreshed', applyRolePermissions);

    // ==========================================
    // DYNAMIC NOTIFICATION FETCHING LOGIC
    // ==========================================
    const bellIcon = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');

    if (bellIcon && dropdown) {

        let token = null;
        let storedUser = null;
        let currentUser = null;

        if (window.getResolvedPath().includes('/SuperAdmin') || window.getResolvedPath().includes('Super-Admin')) {
            token = localStorage.getItem('superAdminToken');
            storedUser = localStorage.getItem('superAdminUser');
        } else if (window.getResolvedPath().includes('/Admin')) {
            token = localStorage.getItem('adminToken');
            storedUser = localStorage.getItem('adminUser');
        } else {
            token = localStorage.getItem('token');
            storedUser = localStorage.getItem('user');
        }

        if (storedUser) {
            try { currentUser = JSON.parse(storedUser); } catch (e) { }
        }

        const fetchNotifications = () => {
            let notifications = [];
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const fetchPromises = [];

            // 1. Fetch Events
            fetchPromises.push(
                fetch(`${window.API_URL}/events`, { headers }).then(res => res.json()).then(data => {
                    if (data.success && data.events) {
                        data.events.forEach(e => {
                            if (e.status === 'Approved') {
                                notifications.push({ type: 'Event', title: 'New Event Approved', text: e.title, date: new Date(e.createdAt || e.date || Date.now()) });
                            } else if (e.status === 'Pending' && currentUser && currentUser.role) {
                                notifications.push({ type: 'Event', title: 'Pending Event', text: `"${e.title}" needs review.`, date: new Date(e.createdAt || e.date || Date.now()) });
                            }
                        });
                    }
                }).catch(err => console.error("Event fetch error", err))
            );

            // 2. Fetch Admin Announcements
            fetchPromises.push(
                fetch(`${window.API_URL}/announcements`, { headers }).then(res => res.json()).then(data => {
                    if (data.success && data.announcements) {
                        data.announcements.filter(a => a.isActive !== false).forEach(a => {
                            notifications.push({ type: 'Announcement', title: 'New Announcement', text: a.title, date: new Date(a.date || a.createdAt || Date.now()) });
                        });
                    }
                }).catch(err => {
                    // Fallback to local storage if API unreachable
                    const local = JSON.parse(localStorage.getItem('adminAnnouncements')) || [];
                    local.filter(a => a.isActive !== false).forEach(a => {
                        notifications.push({ type: 'Announcement', title: 'New Announcement', text: a.title, date: new Date(a.date || a.createdAt || Date.now()) });
                    });
                })
            );

            // 3. Fetch Batchmates (Alumni) & Pending Registrations (Admins)
            if (token && currentUser) {
                fetchPromises.push(
                    fetch(`${window.API_URL}/alumni`, { headers }).then(res => res.json()).then(data => {
                        if (data.success && data.alumni) {
                            data.alumni.forEach(user => {
                                // Batchmate Logic (For standard Alumni)
                                const currentUserBatch = currentUser.batchYear || currentUser.gradYear;
                                const targetUserBatch = user.batchYear || user.gradYear;

                                if (!currentUser.role && currentUserBatch && String(targetUserBatch) === String(currentUserBatch) && user.email !== currentUser.email) {
                                    if (!user.isVerified && user.rollNumber && user.rollNumber.startsWith('PENDING-')) {
                                        notifications.push({ type: 'LegacyVerification', title: 'Verify Batchmate', text: `${user.name} claims to be from your batch. Do you know them?`, date: new Date(user.createdAt || Date.now()), userId: user._id });
                                    } else if (!user.rollNumber || !user.rollNumber.startsWith('PENDING-')) {
                                        notifications.push({ type: 'Batchmate', title: 'New Batchmate', text: `${user.name} joined!`, date: new Date(user.createdAt || Date.now()) });
                                    }
                                }
                                // Pending Manual Registration Logic (For Admins)
                                if (currentUser.role && !user.isVerified && user.rollNumber && user.rollNumber.startsWith('PENDING-')) {
                                    notifications.push({ type: 'Registration', title: 'Pending Registration', text: `${user.name} awaits approval.`, date: new Date(user.createdAt || Date.now()) });
                                }
                            });
                        }
                    }).catch(err => console.error("Alumni fetch error", err))
                );
            }

            // Wait for all fetches to complete
            Promise.all(fetchPromises).then(() => {
                // Sort by most recent first
                notifications.sort((a, b) => b.date - a.date);

                // Default to 48 hours ago so old historical records don't flood as "new" on first load
                const defaultCutoff = Date.now() - (48 * 60 * 60 * 1000);
                const lastRead = parseInt(localStorage.getItem('notificationsLastRead')) || defaultCutoff;
                const newNotifs = notifications.filter(n => n.date.getTime() > lastRead);

                // Safely grab the header before clearing
                const headerHtml = dropdown.querySelector('.notification-header')?.outerHTML || '<div class="notification-header">Notifications <span style="display:none;float:right;font-size:0.8em;color:#0D8ABC;cursor:pointer;" onclick="markNotificationsRead()">Mark all as read</span></div>';
                dropdown.innerHTML = headerHtml;

                const escapeHtml = (str) => {
                    if (!str) return "";
                    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                };

                const timeAgo = (date) => {
                    const seconds = Math.floor((new Date() - date) / 1000);
                    if (seconds < 60) return "Just now";
                    let interval = seconds / 86400;
                    if (interval > 1) return Math.floor(interval) + " days ago";
                    interval = seconds / 3600;
                    if (interval > 1) return Math.floor(interval) + " hours ago";
                    interval = seconds / 60;
                    return Math.floor(interval) + " mins ago";
                };

                // Determine correct "View All" link relative to current path
                const isSuper = window.getResolvedPath().includes('/SuperAdmin') || window.getResolvedPath().includes('Super-Admin');
                const isAdmin = !isSuper && window.getResolvedPath().includes('/Admin');
                let notifPagePath = '/notifications';
                if (isSuper) notifPagePath = '../../notifications.html';
                else if (isAdmin) notifPagePath = '../../notifications.html';

                if (notifications.length === 0) {
                    dropdown.insertAdjacentHTML('beforeend', '<div class="notification-item" style="text-align:center;color:#888;cursor:default;">No new notifications</div>');
                    const badge = document.querySelector('.notification-badge');
                    if (badge) badge.style.display = 'none';
                } else {
                    const topN = notifications.slice(0, 10); // Show top 10 recent notifications
                    topN.forEach(n => {
                        const isNew = n.date.getTime() > lastRead;
                        let actions = '';
                        if (n.type === 'LegacyVerification') {
                            actions = `
                                <div style="margin-top: 8px; display: flex; gap: 8px;">
                                    <button onclick="window.vouchBatchmate('${n.userId}', true, event)" style="flex: 1; background: #28a745; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: bold;">Know</button>
                                    <button onclick="window.vouchBatchmate('${n.userId}', false, event)" style="flex: 1; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: bold;">Don't Know</button>
                                </div>
                            `;
                        }
                        // Add data-isnew attribute to allow markNotificationsRead to target them
                        dropdown.insertAdjacentHTML('beforeend', `
                            <div class="notification-item${isNew ? ' notif-unread' : ''}" style="${isNew ? 'background-color: #f1f8ff; font-weight: bold;' : ''}" data-isnew="${isNew}" id="notif-${n.userId || Math.random().toString(36).substr(2)}">
                                <div style="font-size: 1.05em; margin-bottom: 3px; color: #0D8ABC;">${escapeHtml(n.title)}</div>
                                <div style="color: #444;">${escapeHtml(n.text)}</div>
                                ${actions}
                                <span class="notification-time" style="color: #888; font-size: 0.8em; margin-top: 5px; display: block;">${timeAgo(n.date)}</span>
                            </div>
                        `);
                    });

                    const badge = document.querySelector('.notification-badge');
                    const markReadBtn = dropdown.querySelector('.notification-header span');
                    if (badge && markReadBtn) {
                        if (newNotifs.length > 0) {
                            badge.textContent = newNotifs.length > 9 ? '9+' : newNotifs.length;
                            badge.style.display = 'block';
                            markReadBtn.style.display = 'inline';
                            bellIcon.classList.add('has-unread');
                        } else {
                            badge.style.display = 'none';
                            markReadBtn.style.display = 'none';
                            bellIcon.classList.remove('has-unread');
                        }
                    }
                }

                // Always add "View All Notifications" footer link
                dropdown.insertAdjacentHTML('beforeend', `
                    <div class="notification-footer" style="padding: 10px 15px; text-align: center; border-top: 1px solid #eee; background: #f8f9fa;">
                        <a href="${notifPagePath}" style="color: #0D8ABC; font-size: 0.88em; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17H20L18.595 15.595A1.8 1.8 0 0118 14.382V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.382c0 .476-.19.93-.595 1.595L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                            View All Notifications
                        </a>
                    </div>
                `);
                // Also add dark-mode style for footer
                if (!document.getElementById('notif-footer-style')) {
                    const fs = document.createElement('style');
                    fs.id = 'notif-footer-style';
                    fs.textContent = '.dark-mode .notification-footer { background-color: #1e293b !important; border-color: #334155 !important; } .dark-mode .notification-footer a { color: #60a5fa !important; }';
                    document.head.appendChild(fs);
                }
            });
        };

        // Fetch immediately on page load
        fetchNotifications();

        // Automatically fetch new notifications every 60 seconds (60000 ms)
        setInterval(fetchNotifications, 60000);
    }
});

// ==========================================
// GLOBAL SHARED UTILITIES
// ==========================================
window.API_URL = '/api/auth';

window.toggleProfilePanel = function () {
    const panel = document.getElementById('profileSlidePanel');
    const overlay = document.getElementById('slideOverlay');
    if (!panel || !overlay) return;

    if (panel.classList.contains('show')) {
        panel.classList.remove('show');
        overlay.classList.remove('show');
        document.body.classList.remove('panel-open');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    } else {
        overlay.style.display = 'block';
        setTimeout(() => {
            panel.classList.add('show');
            overlay.classList.add('show');
            document.body.classList.add('panel-open');
        }, 10);
    }
};

window.showAccessDenied = () => {
    const isAlumni = !window.getResolvedPath().toLowerCase().includes('/admin/');
    const loginUrl = isAlumni ? '../login.html' : '../../Admin-login.html';

    document.body.innerHTML = `
        <style>
            body { display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f8f9fa; margin: 0; font-family: 'Segoe UI', sans-serif; }
            .error-container { text-align: center; background: white; padding: 50px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            .cross-mark { font-size: 80px; color: #dc3545; line-height: 1; animation: scale-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            @keyframes scale-in { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            h1 { color: #dc3545; margin: 20px 0 10px 0; }
            p { color: #666; }
            .btn-home { display: inline-block; margin-top: 30px; padding: 12px 25px; background-color: #0D8ABC; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; transition: background-color 0.3s; }
            .btn-home:hover { background-color: #0056b3; }
        </style>
        <div class="error-container">
            <div class="cross-mark">❌</div>
            <h1>Access Denied</h1>
            <p>You are not logged in or your session has expired.</p>
            <a href="${loginUrl}" class="btn-home">Go to Login</a>
        </div>
    `;
    document.title = "Access Denied";
};

window.checkAccess = (isPersisted = false) => {
    let userKey = 'user';
    let loginUrl = '../login.html';

    let path = window.getResolvedPath().toLowerCase();
    const hash = window.location.hash;
    if (hash) {
        const hashRoute = hash.split('?')[0];
        if (window.routes && window.routes[hashRoute]) {
            path = window.routes[hashRoute].toLowerCase();
        }
    }

    if (path.includes('/superadmin') || path.includes('super-admin')) {
        userKey = localStorage.getItem('superAdminUser') ? 'superAdminUser' : 'adminUser';
        loginUrl = '../../Admin-login.html';
    } else if (path.includes('/admin')) {
        userKey = localStorage.getItem('superAdminUser') ? 'superAdminUser' : 'adminUser';
        loginUrl = '../../Admin-login.html';
    }

    const hasUser = localStorage.getItem(userKey);
    if (!hasUser) {
        const navEntries = performance.getEntriesByType("navigation");
        const isBack = isPersisted || (navEntries.length > 0 && navEntries[0].type === "back_forward");
        if (isBack) window.showAccessDenied();
        else window.location.href = loginUrl;
        return false;
    }
    return true;
};

if (!window.getResolvedPath().toLowerCase().includes('login') && !window.getResolvedPath().toLowerCase().includes('signup') && !window.getResolvedPath().toLowerCase().includes('forgot-password')) {
    window.addEventListener('pageshow', (event) => { if (event.persisted) window.checkAccess(true); });
}

window.escapeHtml = function (unsafe) {
    if (!unsafe) return "";
    return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

let tickerAnimation;
window.updateEventsTicker = async function () {
    const tickerWrapper = document.querySelector('.scrolling-ticker');
    const tickerContent = document.getElementById('eventsTicker');
    if (!tickerWrapper || !tickerContent) return;

    if (tickerAnimation) tickerAnimation.cancel();

    let token = localStorage.getItem('token');
    if (window.getResolvedPath().includes('/SuperAdmin') || window.getResolvedPath().includes('Super-Admin')) token = localStorage.getItem('superAdminToken');
    else if (window.getResolvedPath().includes('/Admin')) token = localStorage.getItem('adminToken');

    try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${window.API_URL}/events`, { headers });
        const data = await response.json();

        if (response.ok && data.success) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const approvedEvents = data.events.filter(e => e.status === 'Approved' && new Date(e.date) >= now);

            if (approvedEvents.length > 0) {
                const originalContent = approvedEvents.map(e => {
                    // Format the date to be more readable
                    const eventUrl = `/Alumni/view-events#event-${e._id}`;
                    const eventDate = new Date(e.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                    return `<a href="${eventUrl}" style="color: inherit; text-decoration: none; display: inline-block;">⭐ ${window.escapeHtml(e.title)} - ${eventDate}</a>`;
                }).join(' &nbsp; | &nbsp; ');
                tickerContent.innerHTML = originalContent + ' &nbsp; | &nbsp; ' + originalContent; // Clone for seamless loop

                const duration = tickerContent.offsetWidth / 180; // Increased from 80 to 180 for a faster scroll
                tickerAnimation = tickerContent.animate([
                    { transform: 'translateX(0)' },
                    { transform: `translateX(-50%)` }
                ], {
                    duration: duration * 1000,
                    iterations: Infinity
                });
            } else {
                tickerContent.innerHTML = '⭐ No upcoming events at the moment.';
            }
        }
    } catch (error) { console.error("Failed to load ticker events", error); }
};

// ==========================================
// GLOBAL SIDEBAR ANNOUNCEMENTS
// ==========================================
window.loadSideBarAnnouncements = async function () {
    const announcementsList = document.getElementById('announcementsList');
    if (!announcementsList) return;
    let token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('superAdminToken');
    try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${window.API_URL}/announcements`, { headers });
        if (!response.ok) throw new Error('API missing');
        const data = await response.json();
        window.renderSideBarAnnouncements(data.success ? data.announcements : []);
    } catch (error) {
        const local = JSON.parse(localStorage.getItem('adminAnnouncements')) || [];
        window.renderSideBarAnnouncements(local);
    }
};

window.renderSideBarAnnouncements = function (announcements) {
    const announcementsList = document.getElementById('announcementsList');
    if (!announcementsList) return;

    announcementsList.innerHTML = '';
    const now = new Date();
    const twoDaysInMillis = 2 * 24 * 60 * 60 * 1000;
    const validAnnouncements = announcements.filter(ann => {
        if (ann.isActive === false) return false;
        if (!ann.expiryDate) return true;
        const expiry = new Date(ann.expiryDate);
        return isNaN(expiry.getTime()) || (now.getTime() <= expiry.getTime() + twoDaysInMillis);
    });
    if (validAnnouncements.length === 0) {
        announcementsList.innerHTML = '<p style="color: #666; font-style: italic;">No new announcements.</p>';
        return;
    }

    let htmlStr = '<marquee direction="up" scrollamount="3" onmouseover="this.stop();" onmouseout="this.start();" style="height: 100%; max-height: 400px; padding-right: 5px;">';
    validAnnouncements.sort((a, b) => new Date(b.date) - new Date(a.date));
    validAnnouncements.slice(0, 5).forEach(ann => {
        const dateStr = new Date(ann.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        htmlStr += `<div class="announcement"><h4>${window.escapeHtml(ann.title)}</h4><p>${window.escapeHtml(ann.content)}</p><span class="date">${window.escapeHtml(dateStr)}</span></div>`;
    });
    htmlStr += '</marquee>';
    announcementsList.innerHTML = htmlStr;
};

window.markNotificationsRead = function () {
    // Save the current timestamp so future renders correctly compute "new" notifications
    localStorage.setItem('notificationsLastRead', Date.now().toString());

    // Strip the unread visual styling from all currently displayed notification items
    document.querySelectorAll('.notification-item.notif-unread, .notification-item[data-isnew="true"]').forEach(item => {
        item.classList.remove('notif-unread');
        item.removeAttribute('data-isnew');
        item.style.backgroundColor = '';
        item.style.fontWeight = '';
    });

    // Hide the badge and remove the ringing animation from the bell
    const badge = document.querySelector('.notification-badge');
    if (badge) badge.style.display = 'none';

    const bell = document.getElementById('notificationBell');
    if (bell) bell.classList.remove('has-unread');

    // Hide the "Mark all read" button in the header
    const markReadBtn = document.querySelector('.notification-header span');
    if (markReadBtn) markReadBtn.style.display = 'none';
};

// ==========================================
// PROFILE DROPDOWN UX CLICK HANDLER
// ==========================================
document.addEventListener('click', (e) => {
    const profileMenu = document.querySelector('.profile-menu');
    const profileDropdown = document.getElementById('profileDropdown');
    if (!profileMenu || !profileDropdown) return;

    if (profileMenu.contains(e.target)) {
        if (!e.target.closest('.dropdown-content')) {
            profileDropdown.classList.toggle('show');
            // Refresh/Apply role permissions when opening the dropdown to reflect updates immediately
            if (profileDropdown.classList.contains('show') && typeof window.applyRolePermissions === 'function') {
                window.applyRolePermissions();
            }
        } else {
            profileDropdown.classList.remove('show');
        }
    } else {
        profileDropdown.classList.remove('show');
    }
});