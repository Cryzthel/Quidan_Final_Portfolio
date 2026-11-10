// Loaded with `defer`, so the DOM is parsed and THREE is available when this runs.

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Highlights the nav item of whichever section crosses a line ~40% down the viewport.
function initNavHighlight() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('main > section[id]');
    const ACTIVE = ['bg-indigo-600', 'text-white', 'shadow-xl'];
    const INACTIVE = ['text-slate-400', 'hover:text-white', 'hover:bg-slate-700/50'];

    function setActiveNavItem(targetId) {
        navItems.forEach(item => {
            const isActive = item.dataset.target === targetId;
            item.classList.remove(...(isActive ? INACTIVE : ACTIVE));
            item.classList.add(...(isActive ? ACTIVE : INACTIVE));
            if (isActive) {
                item.setAttribute('aria-current', 'true');
            } else {
                item.removeAttribute('aria-current');
            }
        });
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) setActiveNavItem(entry.target.id);
        });
    }, { rootMargin: '-40% 0px -59% 0px' });

    sections.forEach(section => observer.observe(section));
}

function initTypewriter() {
    const target = document.getElementById('animated-title');
    if (!target) return;

    const words = ['UI/UX Designer', 'Front-end Developer', 'Creative Problem Solver'];

    if (prefersReducedMotion) {
        target.textContent = words[0];
        return;
    }

    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function tick() {
        const fullWord = words[wordIndex];
        charIndex += isDeleting ? -1 : 1;
        target.textContent = fullWord.substring(0, charIndex);

        let delay = isDeleting ? 50 : 100;
        if (!isDeleting && charIndex === fullWord.length) {
            delay = 1500;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            delay = 500;
        }
        setTimeout(tick, delay);
    }

    setTimeout(tick, 500);
}

// Sparkle trail behind the mouse cursor, capped at one particle per animation frame.
function initCursorGlitter() {
    if (!canHover || prefersReducedMotion) return;

    let pending = null;

    document.addEventListener('mousemove', e => {
        if (pending) return;
        pending = requestAnimationFrame(() => {
            pending = null;
            const particle = document.createElement('div');
            const size = Math.random() * 5 + 2;
            particle.className = 'glitter-particle';
            particle.style.left = `${e.clientX}px`;
            particle.style.top = `${e.clientY}px`;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.addEventListener('animationend', () => particle.remove(), { once: true });
            document.body.appendChild(particle);
        });
    }, { passive: true });
}

function initSkillReveal() {
    const items = document.querySelectorAll('[data-animate-on-scroll]');

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const item = entry.target;
            const delay = Number(item.dataset.delay) || 0;
            setTimeout(() => item.classList.add('is-visible'), delay);
            observer.unobserve(item);
        });
    }, { rootMargin: '0px 0px -100px 0px', threshold: 0.1 });

    items.forEach(item => observer.observe(item));
}

function initTiltCards() {
    if (!canHover || prefersReducedMotion) return;

    const MAX_TILT = 6;
    const SCALE = 1.05;

    document.querySelectorAll('.js-tilt-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transition = 'transform 0.1s ease-out, box-shadow 0.5s ease-out';
            card.style.transform = `scale(${SCALE})`;
        });

        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width * 2 - 1;  // -1 .. 1
            const y = (e.clientY - rect.top) / rect.height * 2 - 1;
            card.style.transition = 'box-shadow 0.5s ease-out';
            card.style.transform =
                `perspective(1000px) rotateX(${-y * MAX_TILT}deg) rotateY(${x * MAX_TILT}deg) scale(${SCALE})`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transition = 'transform 0.5s ease-out, box-shadow 0.5s ease-out';
            card.style.transform = '';
        });
    });
}

// Drifting particle network behind the page.
function initBackground() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const PARTICLE_COUNT = 200;
    const BOX = 300;
    const HALF = BOX / 2;
    const MAX_DIST_SQ = 60 * 60;
    const MAX_SEGMENTS = PARTICLE_COUNT * (PARTICLE_COUNT - 1) / 2;
    const COLOR = new THREE.Color(0x00ccff);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 200;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (err) {
        console.warn('WebGL unavailable; skipping background animation.', err);
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < positions.length; i++) {
        positions[i] = (Math.random() - 0.5) * BOX;
        velocities[i] = (Math.random() - 0.5) * 0.1;
    }

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    scene.add(new THREE.Points(pointGeometry, new THREE.PointsMaterial({
        color: COLOR,
        size: 2,
        blending: THREE.AdditiveBlending,
        transparent: true,
        sizeAttenuation: true,
    })));

    // Line buffers are allocated once at their maximum size; setDrawRange limits what is drawn.
    // Each segment's brightness fades with distance via vertex colours (additive on a dark background).
    const linePositions = new Float32Array(MAX_SEGMENTS * 6);
    const lineColors = new Float32Array(MAX_SEGMENTS * 6);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));
    scene.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
    })));

    function wrap(v) {
        if (v > HALF) return -HALF;
        if (v < -HALF) return HALF;
        return v;
    }

    function writeVertex(offset, particle, alpha) {
        linePositions[offset] = positions[particle];
        linePositions[offset + 1] = positions[particle + 1];
        linePositions[offset + 2] = positions[particle + 2];
        lineColors[offset] = COLOR.r * alpha;
        lineColors[offset + 1] = COLOR.g * alpha;
        lineColors[offset + 2] = COLOR.b * alpha;
    }

    function step() {
        for (let i = 0; i < positions.length; i++) {
            positions[i] = wrap(positions[i] + velocities[i]);
        }

        let v = 0;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const ia = i * 3;
            for (let j = i + 1; j < PARTICLE_COUNT; j++) {
                const ja = j * 3;
                const dx = positions[ia] - positions[ja];
                const dy = positions[ia + 1] - positions[ja + 1];
                const dz = positions[ia + 2] - positions[ja + 2];
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq >= MAX_DIST_SQ) continue;

                const alpha = (1 - distSq / MAX_DIST_SQ) * 0.3;
                writeVertex(v, ia, alpha);
                writeVertex(v + 3, ja, alpha);
                v += 6;
            }
        }

        pointGeometry.attributes.position.needsUpdate = true;
        lineGeometry.attributes.position.needsUpdate = true;
        lineGeometry.attributes.color.needsUpdate = true;
        lineGeometry.setDrawRange(0, v / 3);
    }

    function render() {
        step();
        scene.rotation.y += 0.0005;
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (prefersReducedMotion) renderer.render(scene, camera);
    });

    if (prefersReducedMotion) {
        render(); // single static frame
    } else {
        renderer.setAnimationLoop(render);
    }
}

function initCopyrightYear() {
    const el = document.getElementById('copyright-year');
    if (el) el.textContent = new Date().getFullYear();
}

initNavHighlight();
initTypewriter();
initCursorGlitter();
initSkillReveal();
initTiltCards();
initBackground();
initCopyrightYear();
