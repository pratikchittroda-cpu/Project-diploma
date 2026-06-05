const header = document.querySelector('[data-header]');
const showcase = document.querySelector('[data-scroll-showcase]');
const steps = showcase ? [...showcase.querySelectorAll('[data-step]')] : [];

const updateHeader = () => {
  if (!header) return;
  header.classList.toggle('is-scrolled', window.scrollY > 18);
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const updateShowcase = () => {
  if (!showcase || steps.length === 0) return;

  const rect = showcase.getBoundingClientRect();
  const scrollableDistance = Math.max(1, rect.height - window.innerHeight);
  const progress = clamp(-rect.top / scrollableDistance, 0, 1);
  const activeStep = clamp(Math.floor(progress * steps.length), 0, steps.length - 1);
  const rotate = -18 + progress * 38;
  const tilt = 5 - progress * 10;

  showcase.style.setProperty('--phone-rotate', `${rotate.toFixed(2)}deg`);
  showcase.style.setProperty('--phone-tilt', `${tilt.toFixed(2)}deg`);
  showcase.style.setProperty('--active-step', activeStep);

  steps.forEach((step, index) => {
    step.classList.toggle('is-active', index === activeStep);
  });
};

updateHeader();
updateShowcase();
window.addEventListener('scroll', updateHeader, { passive: true });
window.addEventListener('scroll', updateShowcase, { passive: true });
window.addEventListener('resize', updateShowcase);
