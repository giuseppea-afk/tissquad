// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// Mobile menu toggle
document.getElementById('nav-toggle').addEventListener('click', () => {
  document.getElementById('nav-links').classList.toggle('open');
});

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('nav-links').classList.remove('open');
  });
});

// Tracking form (demo)
document.getElementById('tracking-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = document.getElementById('tracking-input').value.trim();
  if (!code) return;

  document.getElementById('tracking-display-id').textContent = code;
  document.getElementById('tracking-result').classList.remove('hidden');
});

// Contact form (demo)
document.getElementById('contact-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Richiesta Inviata!';
  btn.style.background = '#10b981';
  btn.disabled = true;

  setTimeout(() => {
    btn.textContent = 'Invia Richiesta';
    btn.style.background = '';
    btn.disabled = false;
    e.target.reset();
  }, 3000);
});

// Animated counter for stats
const animateCounters = () => {
  const counters = document.querySelectorAll('.stat-number[data-target]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      const target = parseInt(el.dataset.target);
      const duration = 2000;
      const start = performance.now();

      const update = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);

        el.textContent = current.toLocaleString('it-IT');
        if (target === 98) el.textContent += '%';
        if (target === 50000) el.textContent = current.toLocaleString('it-IT') + '+';
        if (target === 120) el.textContent = current + '+';
        if (target === 500) el.textContent = current + '+';

        if (progress < 1) requestAnimationFrame(update);
      };

      requestAnimationFrame(update);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
};

animateCounters();

// Smooth reveal animation
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.service-card, .testimonial-card, .about-box, .contact-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  revealObserver.observe(el);
});

// Add revealed styles
const style = document.createElement('style');
style.textContent = '.revealed { opacity: 1 !important; transform: translateY(0) !important; }';
document.head.appendChild(style);
