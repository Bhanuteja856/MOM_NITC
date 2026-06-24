(function () {
    // Premium Gradient System, Glassmorphic Cards & Global Alumni Connection Map Background

    if (window.is3dEffectsInitialized) return;
    window.is3dEffectsInitialized = true;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    function init() {
        // 1. Inject Premium Styles (Stable, Professional Gradients and Glassy Cards)
        injectStyles();

        // 2. Initialize Global Connections Map Background
        initNetworkMapBackground();
    }

    function injectStyles() {
        const style = document.createElement("style");
        style.id = "glassmorphism-card-styles";
        style.innerHTML = `
            /* Overwrite body background with clean, professional gradients */
            body {
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) no-repeat center center fixed !important;
                background-size: cover !important;
                color: #0f172a !important;
            }
            body.dark-mode {
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) no-repeat center center fixed !important;
                background-size: cover !important;
                color: #f1f5f9 !important;
            }

            /* Auth Containers (Login, Signup, Forgot Password, OTP Verification) */
            .container {
                background: rgba(255, 255, 255, 0.72) !important; /* Clean glassy light backing */
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                border: 1.5px solid rgba(255, 255, 255, 0.65) !important;
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.05) !important;
                transition: background-color 0.3s ease, border-color 0.3s ease !important;
            }
            .dark-mode .container {
                background: rgba(30, 41, 59, 0.45) !important;
                border: 1px solid rgba(255, 255, 255, 0.08) !important;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3) !important;
            }

            /* Landing Page Hero Card */
            .hero-section {
                background: rgba(255, 255, 255, 0.78) !important;
                backdrop-filter: blur(14px) !important;
                -webkit-backdrop-filter: blur(14px) !important;
                border: 1.5px solid rgba(255, 255, 255, 0.6) !important;
                box-shadow: 0 12px 35px rgba(0, 0, 0, 0.05) !important;
            }
            .dark-mode .hero-section {
                background: rgba(30, 41, 59, 0.5) !important;
                border: 1px solid rgba(255, 255, 255, 0.08) !important;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3) !important;
            }

            /* Landing Page Feature Cards */
            .feature-card {
                background: rgba(255, 255, 255, 0.65) !important;
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
                border: 1.2px solid rgba(255, 255, 255, 0.55) !important;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.03) !important;
                transition: background-color 0.3s, transform 0.3s, box-shadow 0.3s !important;
            }
            .feature-card:hover {
                background: rgba(255, 255, 255, 0.85) !important;
                transform: translateY(-4px) !important;
                box-shadow: 0 12px 25px rgba(13, 138, 188, 0.08) !important;
            }
            .dark-mode .feature-card {
                background: rgba(30, 41, 59, 0.4) !important;
                border: 1px solid rgba(255, 255, 255, 0.06) !important;
            }
            .dark-mode .feature-card:hover {
                background: rgba(30, 41, 59, 0.6) !important;
                box-shadow: 0 12px 25px rgba(0, 0, 0, 0.4) !important;
            }

            /* Announcements Section */
            .announcements-section {
                background: rgba(255, 255, 255, 0.75) !important;
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                border: 1.5px solid rgba(255, 255, 255, 0.55) !important;
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.04) !important;
            }
            .dark-mode .announcements-section {
                background: rgba(30, 41, 59, 0.45) !important;
                border: 1px solid rgba(255, 255, 255, 0.08) !important;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3) !important;
            }
        `;
        document.head.appendChild(style);
    }

    function drawMortarboard(ctx, x, y, size) {
        ctx.beginPath();
        // Diamond top
        ctx.moveTo(x, y - size * 0.5);
        ctx.lineTo(x + size * 0.9, y - size * 0.1);
        ctx.lineTo(x, y + size * 0.3);
        ctx.lineTo(x - size * 0.9, y - size * 0.1);
        ctx.closePath();
        ctx.fill();

        // Cap base (bowl underneath)
        ctx.beginPath();
        ctx.moveTo(x - size * 0.5, y + size * 0.1);
        ctx.quadraticCurveTo(x, y + size * 0.35, x + size * 0.5, y + size * 0.1);
        ctx.lineTo(x + size * 0.4, y + size * 0.5);
        ctx.quadraticCurveTo(x, y + size * 0.7, x - size * 0.4, y + size * 0.5);
        ctx.closePath();
        ctx.fill();

        // Tassel
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - size * 0.75, y + size * 0.15);
        ctx.lineTo(x - size * 0.75, y + size * 0.6);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = size * 0.12;
        ctx.stroke();
    }

    function drawSparkle(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.9);
        ctx.quadraticCurveTo(x, y, x + size * 0.9, y);
        ctx.quadraticCurveTo(x, y, x, y + size * 0.9);
        ctx.quadraticCurveTo(x, y, x - size * 0.9, y);
        ctx.quadraticCurveTo(x, y, x, y - size * 0.9);
        ctx.closePath();
        ctx.fill();
    }

    function drawCodeTag(ctx, x, y, size) {
        ctx.save();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1, size * 0.15);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Left angle bracket <
        ctx.beginPath();
        ctx.moveTo(x - size * 0.4, y - size * 0.4);
        ctx.lineTo(x - size * 0.8, y);
        ctx.lineTo(x - size * 0.4, y + size * 0.4);
        ctx.stroke();

        // Right angle bracket >
        ctx.beginPath();
        ctx.moveTo(x + size * 0.4, y - size * 0.4);
        ctx.lineTo(x + size * 0.8, y);
        ctx.lineTo(x + size * 0.4, y + size * 0.4);
        ctx.stroke();

        // Center slash /
        ctx.beginPath();
        ctx.moveTo(x + size * 0.2, y - size * 0.55);
        ctx.lineTo(x - size * 0.2, y + size * 0.55);
        ctx.stroke();

        ctx.restore();
    }

    function drawGlobe(ctx, x, y, size) {
        ctx.save();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1, size * 0.12);
        
        // Outer circle
        ctx.beginPath();
        ctx.arc(x, y, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        // Ellipse horizontal/vertical wireframe
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.35, size * 0.85, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x - size * 0.85, y);
        ctx.lineTo(x + size * 0.85, y);
        ctx.stroke();
        
        ctx.restore();
    }

    function drawTerminal(ctx, x, y, size) {
        ctx.save();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1, size * 0.12);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Box border
        ctx.strokeRect(x - size * 0.8, y - size * 0.6, size * 1.6, size * 1.2);

        // Command prompt sign >
        ctx.beginPath();
        ctx.moveTo(x - size * 0.5, y - size * 0.25);
        ctx.lineTo(x - size * 0.3, y - size * 0.1);
        ctx.lineTo(x - size * 0.5, y + size * 0.05);
        ctx.stroke();

        // Underscore cursor _
        ctx.beginPath();
        ctx.moveTo(x - size * 0.15, y + size * 0.05);
        ctx.lineTo(x + size * 0.15, y + size * 0.05);
        ctx.stroke();

        ctx.restore();
    }

    function initNetworkMapBackground() {
        if (document.getElementById("canvas-3d-particles")) return;

        const canvas = document.createElement("canvas");
        canvas.id = "canvas-3d-particles";
        canvas.style.position = "fixed";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.width = "100vw";
        canvas.style.height = "100vh";
        canvas.style.zIndex = "-1";
        canvas.style.pointerEvents = "none";
        document.body.insertBefore(canvas, document.body.firstChild);

        const ctx = canvas.getContext("2d");
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        let mouse = { x: null, y: null, targetX: null, targetY: null, radius: 180 };

        window.addEventListener("resize", () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initParticles();
        });

        window.addEventListener("mousemove", (e) => {
            mouse.targetX = e.clientX;
            mouse.targetY = e.clientY;
        });

        window.addEventListener("mouseleave", () => {
            mouse.targetX = null;
            mouse.targetY = null;
        });

        const particles = [];
        const particleCount = 55;

        class Particle {
            constructor(isInitial = false) {
                this.reset(isInitial);
            }

            reset(isInitial = false) {
                this.x = Math.random() * width;
                this.y = isInitial ? Math.random() * height : height + 30;
                this.z = 0.5 + Math.random() * 2.0; // depth
                this.baseSize = 10 + Math.random() * 8;
                this.size = this.baseSize * (this.z / 1.5);
                this.vx = 0;
                this.vy = 0;
                
                this.swayAngle = Math.random() * Math.PI * 2;
                this.swaySpeed = 0.005 + Math.random() * 0.015;
                this.swayRange = 0.1 + Math.random() * 0.4;
                
                this.baseFloatSpeed = -0.3 - Math.random() * 0.5;
                this.floatSpeed = this.baseFloatSpeed * (this.z / 1.5);
                this.type = Math.floor(Math.random() * 5);
                this.colorOffset = Math.random();
            }

            update() {
                this.swayAngle += this.swaySpeed;
                const defaultSway = Math.sin(this.swayAngle) * this.swayRange;
                
                const targetVx = defaultSway;
                const targetVy = this.floatSpeed;

                if (mouse.x !== null && mouse.y !== null) {
                    const dx = this.x - mouse.x;
                    const dy = this.y - mouse.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const localRadius = mouse.radius * (this.z / 1.5);

                    if (distance < localRadius) {
                        const force = (localRadius - distance) / localRadius;
                        const strength = 1.8 * (this.z / 1.5);
                        
                        const pushX = (dx / (distance || 1)) * force * strength;
                        const pushY = (dy / (distance || 1)) * force * strength;
                        
                        this.vx += pushX;
                        this.vy += pushY;
                    }
                }

                this.vx += (targetVx - this.vx) * 0.06;
                this.vy += (targetVy - this.vy) * 0.06;

                const maxSpeed = 8;
                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                if (speed > maxSpeed) {
                    this.vx = (this.vx / speed) * maxSpeed;
                    this.vy = (this.vy / speed) * maxSpeed;
                }

                this.x += this.vx;
                this.y += this.vy;

                if (this.y < -30) {
                    this.reset(false);
                } else if (this.y > height + 50) {
                    this.y = -20;
                    this.x = Math.random() * width;
                }

                if (this.x < -30) {
                    this.x = width + 20;
                } else if (this.x > width + 30) {
                    this.x = -20;
                }
            }

            draw(isDark) {
                ctx.save();
                
                let primaryHSL;
                if (isDark) {
                    const hues = [200, 160, 270];
                    const hueIndex = Math.floor(this.type) % 3;
                    const hue = hues[hueIndex];
                    const alpha = 0.08 + (this.z / 2.5) * 0.16;
                    primaryHSL = `hsla(${hue}, 85%, 65%, ${alpha})`;
                    ctx.shadowColor = `hsla(${hue}, 90%, 65%, 0.3)`;
                    ctx.shadowBlur = this.z * 4;
                } else {
                    const hues = [200, 185, 215];
                    const hueIndex = Math.floor(this.type) % 3;
                    const hue = hues[hueIndex];
                    const alpha = 0.08 + (this.z / 2.5) * 0.14;
                    primaryHSL = `hsla(${hue}, 75%, 45%, ${alpha})`;
                }

                ctx.fillStyle = primaryHSL;
                ctx.strokeStyle = primaryHSL;

                switch (this.type) {
                    case 0:
                        drawMortarboard(ctx, this.x, this.y, this.size);
                        break;
                    case 1:
                        drawSparkle(ctx, this.x, this.y, this.size);
                        break;
                    case 2:
                        drawCodeTag(ctx, this.x, this.y, this.size);
                        break;
                    case 3:
                        drawGlobe(ctx, this.x, this.y, this.size);
                        break;
                    case 4:
                        drawTerminal(ctx, this.x, this.y, this.size);
                        break;
                }

                ctx.restore();
            }
        }

        function initParticles() {
            particles.length = 0;
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle(true));
            }
        }

        initParticles();

        function drawConnections(isDark) {
            ctx.save();
            const maxDist = 120;
            
            for (let i = 0; i < particles.length; i++) {
                const p1 = particles[i];
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    
                    if (Math.abs(p1.z - p2.z) > 0.5) continue;
                    
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < maxDist) {
                        const alphaRatio = (maxDist - dist) / maxDist;
                        const avgZ = (p1.z + p2.z) / 2;
                        const alpha = alphaRatio * (avgZ / 2.5) * (isDark ? 0.12 : 0.08);
                        
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        
                        if (isDark) {
                            ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
                        } else {
                            ctx.strokeStyle = `rgba(13, 138, 188, ${alpha})`;
                        }
                        
                        ctx.lineWidth = 0.5 * (avgZ / 1.5);
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();
        }

        function animate() {
            const isDark = document.body.classList.contains("dark-mode");
            ctx.clearRect(0, 0, width, height);

            if (isDark) {
                ctx.fillStyle = "rgba(15, 23, 42, 0.25)"; 
            } else {
                ctx.fillStyle = "rgba(255, 255, 255, 0.25)"; 
            }
            ctx.fillRect(0, 0, width, height);

            if (mouse.targetX !== null && mouse.targetY !== null) {
                if (mouse.x === null) {
                    mouse.x = mouse.targetX;
                    mouse.y = mouse.targetY;
                } else {
                    mouse.x += (mouse.targetX - mouse.x) * 0.12;
                    mouse.y += (mouse.targetY - mouse.y) * 0.12;
                }
            } else {
                mouse.x = null;
                mouse.y = null;
            }

            drawConnections(isDark);

            particles.sort((a, b) => a.z - b.z);
            
            particles.forEach(p => {
                p.update();
                p.draw(isDark);
            });

            requestAnimationFrame(animate);
        }

        animate();
    }
})();
