// ── Écran de connexion (boot) ───────────────────────────
(function () {
  var screen = document.getElementById('boot-screen');
  if (!screen) return;
  var status = document.getElementById('bootStatus');
  var barFill = document.getElementById('bootBarFill');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var steps = [
    { text: 'Connexion en cours', pct: 15, delay: 0 },
    { text: 'Liaison holonet établie', pct: 40, delay: 600 },
    { text: 'Authentification République', pct: 65, delay: 600 },
    { text: 'Chargement des données 501st', pct: 90, delay: 600 },
    { text: 'Accès autorisé', pct: 100, delay: 500 }
  ];

  var finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    screen.classList.add('done');
    document.body.classList.remove('booting');
    setTimeout(function () { screen.remove(); }, 800);
  }

  screen.addEventListener('click', finish);
  window.addEventListener('keydown', finish, { once: true });

  if (reduced) { finish(); return; }

  var t = 0;
  steps.forEach(function (step, i) {
    t += step.delay;
    setTimeout(function () {
      if (finished) return;
      status.textContent = step.text;
      barFill.style.width = step.pct + '%';
      if (i === steps.length - 1) setTimeout(finish, 450);
    }, t);
  });

  setTimeout(finish, 6000);
})();

// ── Menu mobile (hamburger) ─────────────────────────────
(function () {
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  if (!navToggle || !navLinks) return;
  var mobileMQ = window.matchMedia('(max-width: 1100px)');

  function closeMenu() {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  navToggle.addEventListener('click', function () {
    var isOpen = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  navLinks.addEventListener('click', function (e) {
    if (!mobileMQ.matches) return;
    if (e.target.closest('a')) closeMenu();
  });

  mobileMQ.addEventListener('change', function (mq) {
    if (!mq.matches) closeMenu();
  });
})();

// ── Étoiles + étoiles filantes ──────────────────────────
(function () {
  var canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W, H, stars = [], shooters = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkStar() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random(),
      da: (Math.random() * 0.004 + 0.001) * (Math.random() < 0.5 ? 1 : -1),
      blue: Math.random() < 0.3
    };
  }

  function initStars(n) {
    n = n || 280;
    stars = Array.from({ length: n }, mkStar);
  }

  function mkShooter() {
    var angle = Math.PI / 6 + Math.random() * Math.PI / 8;
    var speed = 6 + Math.random() * 6;
    return {
      x: Math.random() * W * 0.7,
      y: Math.random() * H * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      len: 60 + Math.random() * 80,
      life: 1,
      decay: 0.018 + Math.random() * 0.012
    };
  }

  var shooterTimer = 0;

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.a += s.da;
      if (s.a > 1) s.da *= -1;
      if (s.a < 0.1) s.da *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.blue ? 'rgba(91,124,255,' + (s.a * 0.9) + ')' : 'rgba(220,222,255,' + (s.a * 0.85) + ')';
      ctx.fill();
    }

    shooterTimer++;
    if (shooterTimer > 180 + Math.random() * 200) {
      shooters.push(mkShooter());
      shooterTimer = 0;
    }

    for (var j = shooters.length - 1; j >= 0; j--) {
      var sh = shooters[j];
      sh.x += sh.vx; sh.y += sh.vy; sh.life -= sh.decay;
      if (sh.life <= 0) { shooters.splice(j, 1); continue; }

      var norm = sh.len / Math.hypot(sh.vx, sh.vy);
      var grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * norm, sh.y - sh.vy * norm);
      grad.addColorStop(0, 'rgba(140,160,255,' + (sh.life * 0.9) + ')');
      grad.addColorStop(1, 'rgba(140,160,255,0)');

      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(sh.x - sh.vx * norm, sh.y - sh.vy * norm);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5 * sh.life;
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', function () { resize(); initStars(); });
  resize();
  initStars();
  requestAnimationFrame(draw);
})();
