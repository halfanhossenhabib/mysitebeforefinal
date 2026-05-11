/* =========================================================
   Halfan Hossen Habib - Portfolio
   "Midnight Lab" - interactive 3D + premium UX
   ========================================================= */

const header = document.querySelector("#siteHeader");
const menuToggle = document.querySelector(".menu-toggle");
const navMenu = document.querySelector("#navMenu");
const navLinks = [...document.querySelectorAll(".nav-menu a")];
const revealItems = [...document.querySelectorAll(".reveal")];
const tiltCards = [...document.querySelectorAll(".tilt-card")];
const dangerBtn = document.querySelector("#dangerBtn");
const eggMessage = document.querySelector("#eggMessage");
const particleCanvas = document.querySelector("#particleCanvas");
const heroCanvas = document.querySelector("#heroCanvas");
const cursorEl = document.querySelector("#cursor");
const scrollProgress = document.querySelector("#scrollProgress");
const liveClock = document.querySelector("#liveClock");
const navClock = document.querySelector("#navClock");
const backTop = document.querySelector("#backTop");
const yearEl = document.querySelector(".year");
const magneticEls = [...document.querySelectorAll("[data-magnetic]")];
const visitCountEl = document.querySelector("#visitCount");
const visitCounterEl = document.querySelector("#visitCounter");

/* Visit counter config.
   Displayed count = max(START_DISPLAY_AT, (hits.sh real count) + OFFSET).
   The site should "start counting from 136" on deploy.
   Real hits.sh count at deploy is ~144, so OFFSET = 136 - 144 = -8. */
const VISIT_START = 136;
const VISIT_OFFSET = -8;
const VISIT_BADGE_URL = "https://hits.sh/halfanhossenhabib.github.io/mysite.svg";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

/* --------------- Header / Nav --------------- */
function setHeaderState() {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 20);
}
function closeMenu() {
  menuToggle.classList.remove("is-open");
  navMenu.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
}
function setupNavigation() {
  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.classList.toggle("is-open");
    navMenu.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach((link) => link.addEventListener("click", closeMenu));

  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
        });
      });
    },
    { rootMargin: "-45% 0px -45% 0px" }
  );
  sections.forEach((section) => observer.observe(section));
}

/* --------------- Reveal on scroll --------------- */
function setupReveal() {
  if (prefersReducedMotion) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add("is-visible"), i * 40);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealItems.forEach((item) => observer.observe(item));
}

/* --------------- Tilt cards + bento spotlight --------------- */
function setupTiltCards() {
  if (prefersReducedMotion) return;

  tiltCards.forEach((card) => {
    if (hasFinePointer) {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
        card.style.setProperty("--my", `${(y + 0.5) * 100}%`);
        card.style.transform = `perspective(900px) rotateX(${y * -6}deg) rotateY(${x * 8}deg) translateY(-4px)`;
      });
    }
    card.addEventListener("pointerdown", () => card.classList.add("is-touched"));
    card.addEventListener("pointerup", () => setTimeout(() => card.classList.remove("is-touched"), 140));
    card.addEventListener("pointercancel", () => card.classList.remove("is-touched"));
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
      card.classList.remove("is-touched");
    });
  });
}

/* --------------- Custom cursor --------------- */
function setupCursor() {
  if (!cursorEl || !hasFinePointer || prefersReducedMotion) return;
  document.documentElement.classList.add("cursor-active");

  const dot = cursorEl.querySelector(".cursor-dot");
  const ring = cursorEl.querySelector(".cursor-ring");
  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const ringPos = { x: pos.x, y: pos.y };

  window.addEventListener("pointermove", (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
  }, { passive: true });

  const hoverables = "a, button, [data-magnetic], .project-card, .bento-card, .contact-card, .danger-btn, .nav-menu a, .icon-link, .hero-scroll";
  document.addEventListener("pointerover", (e) => {
    if (e.target.closest(hoverables)) cursorEl.classList.add("is-hover");
  });
  document.addEventListener("pointerout", (e) => {
    if (e.target.closest(hoverables)) cursorEl.classList.remove("is-hover");
  });

  function ringLoop() {
    ringPos.x += (pos.x - ringPos.x) * 0.18;
    ringPos.y += (pos.y - ringPos.y) * 0.18;
    ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%)`;
    requestAnimationFrame(ringLoop);
  }
  ringLoop();
}

/* --------------- Magnetic buttons --------------- */
function setupMagnetic() {
  if (!hasFinePointer || prefersReducedMotion) return;
  magneticEls.forEach((el) => {
    const strength = 0.32;
    el.addEventListener("pointermove", (e) => {
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${mx * strength}px, ${my * strength}px)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
    });
  });
}

/* --------------- Scroll progress + Back to top --------------- */
function setupScrollUI() {
  function update() {
    const max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
    const pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
    if (scrollProgress) scrollProgress.style.width = `${pct}%`;
    if (backTop) backTop.classList.toggle("is-visible", window.scrollY > 600);
  }
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();

  if (backTop) {
    backTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  }
}

/* --------------- Clocks --------------- */
function setupClocks() {
  function pad(n) { return String(n).padStart(2, "0"); }
  function tick() {
    const d = new Date();
    const full = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const short = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (liveClock) liveClock.textContent = full;
    if (navClock) navClock.textContent = short;
  }
  tick();
  setInterval(tick, 1000);

  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* --------------- Visit counter (hits.sh, every page load) --------------- */
function setupVisitCounter() {
  if (!visitCountEl) return;

  // Fire-and-forget: fetching the SVG counts the visit.
  // Parsing its aria-label gives us the real count to display.
  const url = `${VISIT_BADGE_URL}?t=${Date.now()}`;

  fetch(url, { cache: "no-store", mode: "cors" })
    .then((res) => (res.ok ? res.text() : Promise.reject(new Error("hits.sh error"))))
    .then((svg) => {
      // aria-label looks like: aria-label="Total Visits: 123"
      const match = svg.match(/aria-label="[^"]*:\s*(\d+)"/i);
      if (!match) return;
      const real = parseInt(match[1], 10);
      const display = Math.max(VISIT_START, real + VISIT_OFFSET);
      animateCount(visitCountEl, display);
      if (visitCounterEl) {
        visitCounterEl.classList.add("is-pulse");
        setTimeout(() => visitCounterEl.classList.remove("is-pulse"), 650);
      }
    })
    .catch(() => {
      // Network / CORS issue - keep the SSR default (136) so the badge still reads nicely.
    });
}

function animateCount(el, target) {
  const start = parseInt(el.textContent, 10) || 0;
  if (target === start) return;
  const duration = 900;
  const startTime = performance.now();

  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(start + (target - start) * eased);
    el.textContent = value.toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* --------------- Easter egg --------------- */
function setupEasterEgg() {
  if (!dangerBtn) return;
  const messages = [
    "Curiosity mode unlocked.",
    "Neon boost activated.",
    "Tiny surprise deployed.",
    "You clicked it. Respect."
  ];
  let count = 0;
  dangerBtn.addEventListener("click", (event) => {
    count += 1;
    dangerBtn.classList.remove("is-active");
    void dangerBtn.offsetWidth;
    dangerBtn.classList.add("is-active");
    eggMessage.textContent = messages[count % messages.length];
    releaseSparks(event.clientX, event.clientY);
  });
}
function releaseSparks(x, y) {
  if (prefersReducedMotion) return;
  for (let i = 0; i < 18; i++) {
    const spark = document.createElement("span");
    const angle = (Math.PI * 2 * i) / 18;
    const distance = 40 + Math.random() * 52;
    spark.className = "spark";
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.color = i % 3 === 0 ? "#10b981" : i % 3 === 1 ? "#2dd4bf" : "#06b6d4";
    spark.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--ty", `${Math.sin(angle) * distance}px`);
    document.body.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
  }
}

/* --------------- Ambient particle canvas --------------- */
function setupParticles() {
  if (!particleCanvas) return;
  const ctx = particleCanvas.getContext("2d");
  let w = 0, h = 0, particles = [], rafId = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth;
    h = window.innerHeight;
    particleCanvas.width = Math.floor(w * ratio);
    particleCanvas.height = Math.floor(h * ratio);
    particleCanvas.style.width = `${w}px`;
    particleCanvas.style.height = `${h}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(100, Math.max(40, Math.floor(w / 16)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.26,
      vy: (Math.random() - 0.5) * 0.26,
      s: 0.7 + Math.random() * 1.7,
      hue: Math.random() > 0.6 ? "violet" : Math.random() > 0.5 ? "cyan" : "pink"
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fillStyle = p.hue === "violet" ? "rgba(16,185,129,0.65)"
        : p.hue === "cyan" ? "rgba(6,182,212,0.7)"
        : "rgba(45,212,191,0.7)";
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const o = particles[j];
        const d = Math.hypot(p.x - o.x, p.y - o.y);
        if (d > 120) continue;
        ctx.strokeStyle = `rgba(45,212,191,${0.12 * (1 - d / 120)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(o.x, o.y);
        ctx.stroke();
      }
    });
    rafId = requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });
  if (!prefersReducedMotion) draw();
  else {
    ctx.fillStyle = "rgba(45,212,191,0.28)";
    particles.forEach((p) => ctx.fillRect(p.x, p.y, 2, 2));
  }
  return () => cancelAnimationFrame(rafId);
}

/* --------------- Interactive 3D hero crystal --------------- */
async function setupThreeHero() {
  if (!heroCanvas) return;
  if (prefersReducedMotion) {
    heroCanvas.classList.add("is-ready");
    return;
  }

  try {
    const THREE = await loadThree();

    const renderer = new THREE.WebGLRenderer({
      canvas: heroCanvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    camera.position.set(0, 0, 7);

    const group = new THREE.Group();
    scene.add(group);

    /* ---------- Crystal: icosahedron wireframe + inner core ---------- */
    const crystal = new THREE.Group();
    group.add(crystal);

    // Outer wireframe crystal (teal)
    const geo = new THREE.IcosahedronGeometry(1.35, 1);
    const basePositions = new Float32Array(geo.attributes.position.array);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const wireMesh = new THREE.Mesh(geo, wireMat);
    crystal.add(wireMesh);

    // Second shell (cyan)
    const geo2 = new THREE.IcosahedronGeometry(1.55, 1);
    const wireMat2 = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.32
    });
    const wireMesh2 = new THREE.Mesh(geo2, wireMat2);
    crystal.add(wireMesh2);

    // Solid inner core - deep teal, teal emissive
    const coreGeo = new THREE.IcosahedronGeometry(0.95, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x062824,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x0f766e,
      emissiveIntensity: 0.65,
      flatShading: true
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    crystal.add(coreMesh);

    // Inner bright orb (mint)
    const orbGeo = new THREE.SphereGeometry(0.38, 24, 24);
    const orbMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.78
    });
    const orbMesh = new THREE.Mesh(orbGeo, orbMat);
    crystal.add(orbMesh);

    // Ring halos
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.008, 10, 140), ringMat1);
    ring1.rotation.x = Math.PI / 2.2;
    group.add(ring1);

    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    });
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.007, 10, 140), ringMat2);
    ring2.rotation.x = Math.PI / 1.8;
    ring2.rotation.y = Math.PI / 6;
    group.add(ring2);

    const ringMat3 = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.006, 10, 140), ringMat3);
    ring3.rotation.x = Math.PI / 3;
    ring3.rotation.z = Math.PI / 4;
    group.add(ring3);

    /* ---------- Starfield ---------- */
    const starGeo = new THREE.BufferGeometry();
    const starCount = 520;
    const starPos = [];
    const starCol = [];
    for (let i = 0; i < starCount; i++) {
      const r = 8 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.9,
        r * Math.sin(phi) * Math.sin(theta)
      );
      const pick = Math.random();
      if (pick < 0.4) starCol.push(0.17, 0.83, 0.75);       // teal #2dd4bf
      else if (pick < 0.75) starCol.push(0.02, 0.71, 0.83);  // cyan #06b6d4
      else starCol.push(0.06, 0.72, 0.51);                   // mint #10b981
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    starGeo.setAttribute("color", new THREE.Float32BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    /* ---------- Orbiting small crystals ---------- */
    const satellites = [];
    const satMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x2dd4bf,
      emissiveIntensity: 0.85,
      metalness: 0.8,
      roughness: 0.3,
      flatShading: true
    });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.OctahedronGeometry(0.14, 0);
      const m = new THREE.Mesh(g, satMat.clone());
      m.material.color.setHex(i % 2 ? 0x10b981 : 0x2dd4bf);
      m.material.emissive.setHex(i % 2 ? 0x10b981 : 0x2dd4bf);
      m.userData = {
        angle: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
        radius: 2.3 + Math.random() * 0.8,
        tilt: (Math.random() - 0.5) * 0.8,
        phase: Math.random() * Math.PI * 2
      };
      satellites.push(m);
      group.add(m);
    }

    /* ---------- Lights ---------- */
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const lightTeal = new THREE.PointLight(0x2dd4bf, 12, 20);
    lightTeal.position.set(-4, 3, 4);
    scene.add(lightTeal);
    const lightMint = new THREE.PointLight(0x10b981, 10, 20);
    lightMint.position.set(4, -2, 3);
    scene.add(lightMint);
    const lightCyan = new THREE.PointLight(0x06b6d4, 8, 18);
    lightCyan.position.set(0, 4, -3);
    scene.add(lightCyan);

    /* ---------- Interaction state ---------- */
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let scrollFactor = 0;
    let mouseDown = false;
    const clock = new THREE.Clock();

    function onPointerMove(e) {
      pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
      target.x = pointer.x * 0.6;
      target.y = pointer.y * -0.4;
    }
    function onTouchMove(e) {
      const t = e.touches[0];
      if (t) {
        pointer.x = (t.clientX / window.innerWidth - 0.5) * 2;
        pointer.y = (t.clientY / window.innerHeight - 0.5) * 2;
        target.x = pointer.x * 0.6;
        target.y = pointer.y * -0.4;
      }
    }
    function onScroll() {
      scrollFactor = Math.min(1, window.scrollY / (window.innerHeight || 1));
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    heroCanvas.addEventListener("pointerdown", () => { mouseDown = true; });
    window.addEventListener("pointerup", () => { mouseDown = false; });

    /* ---------- Resize ---------- */
    function resize() {
      const rect = heroCanvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // On smaller screens, shrink the crystal and move it
      const small = w < 760;
      group.scale.setScalar(small ? 0.68 : 1);
      group.position.set(small ? 0 : 1.4, small ? 1.1 : 0, 0);
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    /* ---------- Animate (with vertex distortion) ---------- */
    const posAttr = wireMesh.geometry.attributes.position;
    const vertexCount = posAttr.count;

    function animate() {
      const t = clock.getElapsedTime();

      // Easing the crystal rotation toward the pointer
      crystal.rotation.y += (target.x - crystal.rotation.y) * 0.05;
      crystal.rotation.x += (target.y - crystal.rotation.x) * 0.05;
      crystal.rotation.z = Math.sin(t * 0.3) * 0.08;

      // Parallax whole group on scroll
      group.position.y += ((0 - scrollFactor * 2.2) - (group.position.y - (window.innerWidth < 760 ? 1.1 : 0))) * 0.06;

      // Vertex noise distortion on outer wireframe
      const distort = mouseDown ? 0.28 : 0.12;
      for (let i = 0; i < vertexCount; i++) {
        const ix = i * 3;
        const bx = basePositions[ix];
        const by = basePositions[ix + 1];
        const bz = basePositions[ix + 2];
        const n = Math.sin(t * 1.3 + bx * 1.8) * Math.cos(t * 1.1 + by * 1.7) * Math.sin(t * 0.9 + bz * 2.1);
        const f = 1 + n * distort;
        posAttr.array[ix]     = bx * f;
        posAttr.array[ix + 1] = by * f;
        posAttr.array[ix + 2] = bz * f;
      }
      posAttr.needsUpdate = true;
      wireMesh.geometry.computeVertexNormals?.();

      // Core subtle pulse
      const corePulse = 1 + Math.sin(t * 2.4) * 0.04;
      coreMesh.scale.setScalar(corePulse);
      orbMesh.scale.setScalar(1 + Math.sin(t * 3.2) * 0.1);
      orbMat.opacity = 0.6 + Math.sin(t * 2.1) * 0.2;

      // Second shell counter-rotation
      wireMesh2.rotation.x = t * 0.12;
      wireMesh2.rotation.y = -t * 0.18;

      // Rings
      ring1.rotation.z = t * 0.3;
      ring2.rotation.z = -t * 0.22;
      ring3.rotation.z = t * 0.15;

      // Satellites
      satellites.forEach((s) => {
        const d = s.userData;
        d.angle += d.speed * 0.01;
        s.position.x = Math.cos(d.angle) * d.radius;
        s.position.z = Math.sin(d.angle) * d.radius;
        s.position.y = Math.sin(d.angle * 0.9 + d.phase) * d.tilt;
        s.rotation.x += 0.02;
        s.rotation.y += 0.03;
      });

      // Starfield drift
      stars.rotation.y = t * 0.02;
      stars.rotation.x = Math.sin(t * 0.08) * 0.1;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    heroCanvas.classList.add("is-ready");
    animate();
  } catch (error) {
    heroCanvas.classList.add("is-ready");
    console.warn("3D hero could not load:", error);
  }
}

/* --------------- Load Three.js CDN lazily --------------- */
function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-threejs]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.THREE), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js";
    s.async = true;
    s.dataset.threejs = "true";
    s.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error("Three.js load failed")));
    s.onerror = () => reject(new Error("Three.js CDN failed"));
    document.head.appendChild(s);
  });
}

/* --------------- Boot --------------- */
setupNavigation();
setupReveal();
setupTiltCards();
setupEasterEgg();
setupParticles();
setupCursor();
setupMagnetic();
setupScrollUI();
setupClocks();
setupVisitCounter();

const startHero = () => setupThreeHero();
if ("requestIdleCallback" in window) {
  requestIdleCallback(startHero, { timeout: 900 });
} else {
  setTimeout(startHero, 120);
}
