

// Typing Animation
const subtitleEl = document.getElementById('subtitle');
const text = 'Game Programming Student / Aspiring Game Dev';
let idx = 0;
function type() {
  if (idx < text.length) {
    subtitleEl.textContent += text[idx++];
    setTimeout(type, 100);
  }
}
type();

// Section Reveal
const sections = document.querySelectorAll('section.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { 
      e.target.classList.add('visible');
      if (e.target.id === 'skills') {
        e.target.querySelectorAll('li').forEach(li => {
          const width = li.getAttribute('data-level') + '%';
          li.querySelector('::after');
          setTimeout(() => li.style.setProperty('--width', width), 100);
        });
      }
    }
  });
}, { threshold: 0.2 });
sections.forEach(s => observer.observe(s));

// Smooth Scroll & Scroll Spy
const navLinks = document.querySelectorAll('#navbar a');
navLinks.forEach(link => link.addEventListener('click', e => {
  e.preventDefault();
  document.querySelector(link.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
}));
window.addEventListener('scroll', () => {
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 50) {
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${sec.id}`));
    }
  });
});

// Filter Projects
const filters = document.querySelectorAll('.filter-tabs button');
const projects = document.querySelectorAll('.project');
filters.forEach(btn => btn.addEventListener('click', () => {
  filters.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const cat = btn.dataset.filter;
  projects.forEach(p => p.classList.toggle('hide', cat !== 'all' && p.dataset.category !== cat));
}));

// PDF Controls
const iframe = document.getElementById('resume-frame');
let zoom = 1;
document.getElementById('zoom-in').addEventListener('click', () => { zoom += 0.1; iframe.style.transform = `scale(${zoom})`; });
document.getElementById('zoom-out').addEventListener('click', () => { zoom = Math.max(0.5, zoom - 0.1); iframe.style.transform = `scale(${zoom})`; });

// Contact Form Validation
const form = document.getElementById('contact-form');
form.addEventListener('submit', e => {
  e.preventDefault();
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const message = form.message.value.trim();
  const error = document.getElementById('form-error');
  if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error.textContent = 'Please fill all fields with valid information.';
    return;
  }
  error.textContent = '';
  alert('Message sent!');
  form.reset();
});

// Scroll-to-top
const topBtn = document.getElementById('scroll-top');
window.addEventListener('scroll', () => topBtn.style.display = window.scrollY > 300 ? 'block' : 'none');
topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));


