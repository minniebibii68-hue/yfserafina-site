const desktop = window.matchMedia('(min-width: 681px)');
function setBookLayout() {
  document.querySelectorAll('.card details').forEach(notes => { notes.open = desktop.matches; });
}
setBookLayout();
desktop.addEventListener('change', setBookLayout);
document.querySelector('#copy').addEventListener('click', async () => {
  const email = document.querySelector('.email').textContent;
  const status = document.querySelector('[role="status"]');
  try {
    await navigator.clipboard.writeText(email);
    status.textContent = ' Email address copied.';
  } catch {
    status.textContent = ' Select the email address to copy it.';
  }
});

const heroPicture = document.querySelector('.hero picture');
function finishOpening() {
  heroPicture.querySelector('source')?.remove();
}
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  finishOpening();
} else {
  window.setTimeout(finishOpening, 3000);
}
const entrances = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('entered');
      entrances.unobserve(entry.target);
    }
  }
}, { threshold: 0.18 });
document.querySelectorAll('.card').forEach(card => entrances.observe(card));

for (const [index, card] of [...document.querySelectorAll('.card')].entries()) {
  const notes = card.querySelector('details');
  const cover = card.querySelector('.cover');
  notes.id = 'reading-notes-' + index;
  cover.setAttribute('aria-controls', notes.id);
  const sync = () => cover.setAttribute('aria-expanded', String(notes.open));
  sync();
  notes.addEventListener('toggle', sync);
  cover.addEventListener('click', () => { notes.open = !notes.open; });
}

const hero = document.querySelector('.hero');
const canvas = hero.querySelector('.starfield');
const pen = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const patterns = [
  [[-.9,.3],[-.55,-.6],[-.05,-.15],[.35,-.75],[.9,-.4],[.55,.35],[.0,.7]],
  [[-.9,-.45],[-.45,.25],[0,-.65],[.38,.45],[.9,-.15]],
  [[-.85,.6],[-.65,-.25],[-.1,-.75],[.25,-.05],[.85,.3],[.35,.65],[-.1,.25]]
];
const destinations = ['overclocked', 'universe'];
const starLink = hero.querySelector('.star-link');
const traceButton = hero.querySelector('.trace');
traceButton.after(starLink);
starLink.addEventListener('click', () => {
  const notes = document.getElementById(destinations[constellation % destinations.length]).querySelector('details');
  if (notes) notes.open = true;
});
let constellation = -1;
let drawing = 0;
function traceStars(x, y, advance) {
  const width = hero.clientWidth, height = hero.clientHeight;
  const compact = width <= 680;
  const scale = compact ? width * .13 : Math.min(width * .17, height * .32);
  const leftEdge = compact ? width * .63 : width * .49;
  x = Math.max(x, leftEdge + scale);
  x = Math.max(scale, Math.min(width - scale, x));
  y = Math.max(scale, Math.min(height - scale, y));
  cancelAnimationFrame(drawing);
  const density = Math.min(devicePixelRatio, 2);
  canvas.width = width * density;
  canvas.height = height * density;
  pen.scale(density, density);
  if (advance) constellation = (constellation + 1) % patterns.length;
  const destination = document.getElementById(destinations[constellation % destinations.length]);
  starLink.href = '#' + destination.id;
  starLink.textContent = destination.querySelector('h2,h3').textContent.trim() + ' ↓';
  starLink.hidden = false;
  const points = patterns[constellation].map(([dx, dy]) => [x + dx * scale, y + dy * scale]);
  const start = performance.now();
  function paint(now) {
    const progress = reduced.matches || !advance ? 1 : Math.min(1, (now-start)/760);
    pen.clearRect(0,0,width,height);
    pen.strokeStyle = '#f8d69c'; pen.fillStyle = '#fff2cb'; pen.shadowColor = '#efbc64'; pen.shadowBlur = 8;
    const reach = progress * (points.length-1);
    pen.beginPath(); pen.moveTo(...points[0]);
    for(let i=1;i<points.length;i++){
      const t=Math.max(0,Math.min(1,reach-i+1));
      const [a,b]=points[i-1], [c,d]=points[i];
      pen.lineTo(a+(c-a)*t,b+(d-b)*t);
    }
    pen.stroke();
    points.slice(0,Math.floor(reach)+1).forEach(([a,b],i)=>{
      pen.beginPath(); pen.arc(a,b,i%2?2:3.2,0,2*Math.PI); pen.fill();
    });
    if(progress<1) drawing=requestAnimationFrame(paint);
  }
  paint(start);
}
hero.querySelector('.trace').addEventListener('click',()=>traceStars(hero.clientWidth*.76,hero.clientHeight*.45,true));
hero.addEventListener('pointerdown',event=>{
  if(event.target.closest('button,a')) return;
  const rect=hero.getBoundingClientRect();
  traceStars(event.clientX-rect.left,event.clientY-rect.top,true);
});
