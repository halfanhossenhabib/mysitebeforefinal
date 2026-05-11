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

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function setHeaderState() {
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

  navLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: "-45% 0px -45% 0px" });

  sections.forEach((section) => observer.observe(section));
}

function setupReveal() {
  if (prefersReducedMotion) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  revealItems.forEach((item) => observer.observe(item));
}

function setupTiltCards() {
  if (prefersReducedMotion) return;

  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

  tiltCards.forEach((card) => {
    if (hasFinePointer) {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${y * -8}deg) rotateY(${x * 10}deg) translateY(-4px)`;
      });
    }

    card.addEventListener("pointerdown", () => {
      card.classList.add("is-touched");
    });

    card.addEventListener("pointerup", () => {
      window.setTimeout(() => card.classList.remove("is-touched"), 140);
    });

    card.addEventListener("pointercancel", () => {
      card.classList.remove("is-touched");
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
      card.classList.remove("is-touched");
    });
  });
}

function setupEasterEgg() {
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

  for (let index = 0; index < 16; index += 1) {
    const spark = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 16;
    const distance = 36 + Math.random() * 48;
    spark.className = "spark";
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.color = index % 3 === 0 ? "var(--pink)" : index % 3 === 1 ? "var(--cyan)" : "var(--mint)";
    spark.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--ty", `${Math.sin(angle) * distance}px`);
    document.body.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
  }
}

function setupParticles() {
  const context = particleCanvas.getContext("2d");
  let width = 0;
  let height = 0;
  let particles = [];
  let animationFrame = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    particleCanvas.width = Math.floor(width * ratio);
    particleCanvas.height = Math.floor(height * ratio);
    particleCanvas.style.width = `${width}px`;
    particleCanvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const count = Math.min(95, Math.max(38, Math.floor(width / 18)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      size: 0.8 + Math.random() * 1.8
    }));
  }

  function draw() {
    context.clearRect(0, 0, width, height);

    particles.forEach((particle, index) => {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0 || particle.x > width) particle.vx *= -1;
      if (particle.y < 0 || particle.y > height) particle.vy *= -1;

      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fillStyle = index % 4 === 0 ? "rgba(255, 79, 216, 0.62)" : "rgba(56, 232, 255, 0.72)";
      context.fill();

      for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
        const other = particles[otherIndex];
        const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
        if (distance > 118) continue;
        context.strokeStyle = `rgba(120, 205, 255, ${0.12 * (1 - distance / 118)})`;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(other.x, other.y);
        context.stroke();
      }
    });

    animationFrame = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  if (!prefersReducedMotion) {
    draw();
  } else {
    context.fillStyle = "rgba(56, 232, 255, 0.24)";
    particles.forEach((particle) => {
      context.fillRect(particle.x, particle.y, 2, 2);
    });
  }

  return () => cancelAnimationFrame(animationFrame);
}

async function setupThreeHero() {
  if (!heroCanvas || prefersReducedMotion) return;

  try {
    const THREE = await loadThree();

    const renderer = new THREE.WebGLRenderer({
      canvas: heroCanvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const laptop = new THREE.Group();
    const pointer = { x: 0, y: 0 };
    const targetRotation = { x: -0.1, y: -0.34 };
    const heroPlacement = { baseY: 0.12 };
    const clock = new THREE.Clock();

    camera.position.set(0, 1.1, 6.2);
    scene.add(laptop);

    const keyMaterial = new THREE.MeshStandardMaterial({
      color: 0x13243c,
      roughness: 0.48,
      metalness: 0.72
    });
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1526,
      roughness: 0.32,
      metalness: 0.88,
      emissive: 0x06111f,
      emissiveIntensity: 0.35
    });
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x38e8ff,
      roughness: 0.25,
      metalness: 0.45,
      emissive: 0x15b8ff,
      emissiveIntensity: 1.6
    });
    const screenGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x38e8ff,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide
    });
    const violetGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xa06bff,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    });

    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.92), bodyMaterial);
    base.position.y = -0.54;
    laptop.add(base);

    const trackpad = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.018, 0.48), edgeMaterial);
    trackpad.position.set(0, -0.45, 0.46);
    laptop.add(trackpad);

    const screenShell = new THREE.Mesh(new THREE.BoxGeometry(2.72, 1.72, 0.08), bodyMaterial);
    screenShell.position.set(0, 0.36, -0.72);
    screenShell.rotation.x = -0.18;
    laptop.add(screenShell);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.42, 1.36), screenGlowMaterial);
    screen.position.set(0, 0.37, -0.66);
    screen.rotation.x = -0.18;
    laptop.add(screen);

    const screenCore = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.62), violetGlowMaterial);
    screenCore.position.set(0.05, 0.42, -0.61);
    screenCore.rotation.x = -0.18;
    laptop.add(screenCore);

    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.35, 24), edgeMaterial);
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(0, -0.42, -0.74);
    laptop.add(hinge);

    const keyGeometry = new THREE.BoxGeometry(0.18, 0.025, 0.12);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 10; column += 1) {
        const key = new THREE.Mesh(keyGeometry, keyMaterial);
        key.position.set(-1.04 + column * 0.23, -0.43, -0.28 + row * 0.18);
        laptop.add(key);
      }
    }

    const ringOne = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.009, 12, 120), edgeMaterial);
    const ringTwo = new THREE.Mesh(new THREE.TorusGeometry(2.34, 0.008, 12, 120), violetGlowMaterial);
    ringOne.rotation.x = Math.PI / 2.4;
    ringTwo.rotation.x = Math.PI / 2.1;
    laptop.add(ringOne, ringTwo);

    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = [];
    for (let index = 0; index < 180; index += 1) {
      const radius = 1.8 + Math.random() * 1.3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      particlePositions.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi) * 0.55,
        radius * Math.sin(phi) * Math.sin(theta)
      );
    }
    particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x7eeeff,
      size: 0.025,
      transparent: true,
      opacity: 0.8
    });
    const particleField = new THREE.Points(particleGeometry, particleMaterial);
    laptop.add(particleField);

    const cyanLight = new THREE.PointLight(0x38e8ff, 8, 8);
    cyanLight.position.set(-2.5, 2.4, 2.2);
    scene.add(cyanLight);

    const violetLight = new THREE.PointLight(0xa06bff, 6, 7);
    violetLight.position.set(2.8, 1.6, 1.8);
    scene.add(violetLight);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    function resize() {
      const rect = heroCanvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const isSmall = width < 760;
      heroPlacement.baseY = isSmall ? 2.42 : 0.12;
      laptop.scale.setScalar(isSmall ? 0.52 : 0.9);
      laptop.position.set(isSmall ? 0.42 : 1.55, heroPlacement.baseY, 0);
    }

    function updatePointer(clientX, clientY) {
      pointer.x = (clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (clientY / window.innerHeight - 0.5) * 2;
      targetRotation.y = -0.34 + pointer.x * 0.18;
      targetRotation.x = -0.1 + pointer.y * -0.12;
    }

    function onPointerMove(event) {
      updatePointer(event.clientX, event.clientY);
    }

    function onTouchMove(event) {
      const touch = event.touches[0];
      if (touch) {
        updatePointer(touch.clientX, touch.clientY);
      }
    }

    function animate() {
      const elapsed = clock.getElapsedTime();
      laptop.rotation.x += (targetRotation.x - laptop.rotation.x) * 0.045;
      laptop.rotation.y += (targetRotation.y - laptop.rotation.y) * 0.045;
      laptop.rotation.z = Math.sin(elapsed * 0.7) * 0.025;
      laptop.position.y += (Math.sin(elapsed * 1.05) * 0.07 - laptop.position.y + heroPlacement.baseY) * 0.015;
      ringOne.rotation.z = elapsed * 0.34;
      ringTwo.rotation.z = -elapsed * 0.22;
      particleField.rotation.y = elapsed * 0.08;
      particleField.rotation.x = Math.sin(elapsed * 0.2) * 0.12;
      screen.material.opacity = 0.42 + Math.sin(elapsed * 2.4) * 0.06;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    heroCanvas.classList.add("is-ready");
    animate();
  } catch (error) {
    heroCanvas.classList.add("is-ready");
    heroCanvas.dataset.fallback = "true";
    console.warn("3D hero could not load:", error);
  }
}

function loadThree() {
  if (window.THREE) {
    return Promise.resolve(window.THREE);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector("script[data-threejs]");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.THREE), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js";
    script.async = true;
    script.dataset.threejs = "true";
    script.onload = () => {
      if (window.THREE) {
        resolve(window.THREE);
      } else {
        reject(new Error("Three.js loaded, but window.THREE was not found."));
      }
    };
    script.onerror = () => reject(new Error("Three.js CDN failed to load."));
    document.head.appendChild(script);
  });
}

setupNavigation();
setupReveal();
setupTiltCards();
setupEasterEgg();
setupParticles();

const startHero = () => setupThreeHero();
if ("requestIdleCallback" in window) {
  requestIdleCallback(startHero, { timeout: 900 });
} else {
  window.setTimeout(startHero, 120);
}
