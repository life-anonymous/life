'use strict';

function reviewedMediaQuery(id) {
  return ["real-world-full", "mixed-direct", "mixed-life", "mattress-life", "curb-life", "curb-direct"].includes(id) ? '?v=20261125' : '';
}

// Author-specified Geo. observations; other outcomes remain provisional pending exceptions.
const clipOutcomes = {
  'grass-life':'Success', 'grass-geo':'Noticeable hesitation',
  'stairs-life':'Success', 'stairs-geo':'Unsafe near stair end', 'stairs-direct':'Failure',
  'mixed-life':'Success', 'mixed-direct':'Failure',
  'indoor-life':'Success', 'indoor-direct':'Failure',
  'curb-life':'Success', 'curb-direct':'Failure',
  'mattress-life':'Success', 'mattress-direct':'Failure',
  'descent-life':'Success', 'descent-direct':'Failure'
};

const outcomeClasses = {
  'Success':'outcome-success',
  'Noticeable hesitation':'outcome-hesitation',
  'Unsafe near stair end':'outcome-unsafe',
  'Failure':'outcome-failure'
};

const comparisons = {
  'risk-scenes': [
    {id:'risk-grassy-mounds', title:'Grassy Mounds', clips:[['grass-life','LIFE'],['grass-geo','Geo.']]},
    {id:'risk-outdoor-stairs', title:'Outdoor Stairs', clips:[['stairs-life','LIFE'],['stairs-geo','Geo.']]}
  ],
  'command-scenes': [
    {id:'command-mixed-terrain', title:'Indoor Mixed Terrain', clips:[['mixed-life','LIFE'],['mixed-direct','Direct']]},
    {id:'command-stair-ascent', title:'Outdoor Stair Ascent', clips:[['stairs-life','LIFE'],['stairs-direct','Direct']]},
    {id:'command-indoor-stairs', title:'Indoor Marble Stairs', clips:[['indoor-life','LIFE'],['indoor-direct','Direct']]},
    {id:'command-curb', title:'Curb Traversal', clips:[['curb-life','LIFE'],['curb-direct','Direct']]},
    {id:'command-deformable-terrain', title:'Inflatable Mattress', clips:[['mattress-life','LIFE'],['mattress-direct','Direct']]},
    {id:'command-stair-descent', title:'Outdoor Stair Descent', clips:[['descent-life','LIFE'],['descent-direct','Direct']]}
  ]
};

for (const [listId, scenes] of Object.entries(comparisons)) {
document.getElementById(listId).innerHTML = scenes.map(scene => `
  <article class="scene comparison-group" id="${scene.id}" aria-labelledby="${scene.id}-title">
    <div class="scene-header">
      <h4 id="${scene.id}-title">${scene.title}</h4>
    </div>
      <div class="scene-tools" role="group" aria-label="${scene.title} playback controls">
        <button class="play-group" type="button">Play all clips</button>
        <button class="restart-group" type="button">Restart clips</button>
        <label for="speed-${scene.id}">Speed</label>
        <select id="speed-${scene.id}" class="speed-group"><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5" selected>1.5×</option><option value="2">2×</option></select>
      </div>
    <div class="scene-grid">
      ${scene.clips.map(([id,label]) => `<div class="video-card ${label==='LIFE'?'ours':''}">
        <video controls muted playsinline preload="none" data-poster="assets/images/${id}.jpg${reviewedMediaQuery(id)}" data-src="assets/videos/${id}.mp4${reviewedMediaQuery(id)}" aria-label="${scene.title}: ${label}"></video>
        <div class="video-label"><strong class="method-name">${label}</strong> : <span class="clip-outcome ${outcomeClasses[clipOutcomes[id]] || ''}">${clipOutcomes[id]}</span></div>
        <p class="clip-error" hidden>Unable to load this clip. <a href="assets/videos/${id}.mp4${reviewedMediaQuery(id)}">Open video directly</a>.</p>
      </div>`).join('')}
    </div>
    <p class="group-status" role="status" aria-live="polite"></p>
  </article>`).join('');
}

const resumeTimes = new WeakMap();
function loadVideo(video, preload = 'auto') {
  video.preload = preload;
  if (!video.getAttribute('src')) {
    video.src = video.dataset.src;
    video.load();
  }
}
const videos = [...document.querySelectorAll('video[data-src]')];
function releaseVideo(video) {
  if (!video.hasAttribute('src')) return;
  if (video.readyState >= 1) resumeTimes.set(video, video.ended ? 0 : video.currentTime);
  video.pause();
  video.removeAttribute('src');
  video.preload = 'none';
  video.load(); // Abort media requests and release the old buffer.
}
function visible(video) {
  const r = video.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}
function playbackVisible(video) {
  const group = video.closest('.comparison-group');
  return group ? [...group.querySelectorAll('video')].some(visible) : visible(video);
}
let focusTimer;
function updateVideoFocus() {
  if (document.hidden) { videos.forEach(releaseVideo); return; }
  const playing = videos.filter(v => !v.paused && playbackVisible(v));
  const candidates = videos.filter(v => {
    const r = v.getBoundingClientRect();
    return visible(v) && r.top < innerHeight * .75 && r.bottom > innerHeight * .25;
  });
  const distance = v => {
    const r = v.getBoundingClientRect();
    return Math.abs((r.top + r.bottom) / 2 - innerHeight / 2);
  };
  candidates.sort((a, b) => distance(a) - distance(b));
  const selected = playing.length ? playing : candidates.slice(0, 1);
  videos.filter(v => !playbackVisible(v)).forEach(releaseVideo);
  // Give visible native controls a source without requesting their media yet.
  // Only the focused video preloads metadata; clicking another starts it normally.
  videos.filter(visible).forEach(v => {
    if (!v.hasAttribute('src')) loadVideo(v, 'none');
    if (v.paused && !selected.includes(v)) v.preload = 'none';
  });
  if (!playing.length && selected[0]) loadVideo(selected[0], 'metadata');
}
function scheduleVideoFocus() {
  // Cancel offscreen downloads immediately; wait for scrolling to settle before preloading.
  videos.filter(v => !playbackVisible(v)).forEach(releaseVideo);
  clearTimeout(focusTimer);
  focusTimer = setTimeout(updateVideoFocus, 200);
}
videos.forEach(video => {
  video.addEventListener('loadedmetadata', () => {
    const time = resumeTimes.get(video);
    if (time > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(time, video.duration);
    video.playbackRate = video.defaultPlaybackRate;
  });
  video.addEventListener('play', () => {
    video.preload = 'auto';
    scheduleVideoFocus();
  });
  video.addEventListener('error', () => {
    if (!video.hasAttribute('src')) return;
    const error = video.closest('.video-card, .demonstration, .demo-slot')?.querySelector('.clip-error');
    if (error) error.hidden = false;
  });
});

if ('IntersectionObserver' in window) {
  const posters = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const video = entry.target;
        if (video.dataset.poster) video.poster = video.dataset.poster;
        posters.unobserve(video);
      }
    });
  }, {rootMargin:'200px'});
  videos.forEach(video => posters.observe(video));
} else videos.forEach(video => { if (video.dataset.poster) video.poster = video.dataset.poster; });
window.addEventListener('scroll', scheduleVideoFocus, {passive:true});
window.addEventListener('resize', scheduleVideoFocus);
scheduleVideoFocus();

document.querySelectorAll('.comparison-group').forEach(scene => {
  const group = [...scene.querySelectorAll('video')];
  const button = scene.querySelector('.play-group');
  const status = scene.querySelector('.group-status');
  const speedControl = scene.querySelector('.speed-group');
  const applyGroupSpeed = () => {
    const rate = Number(speedControl.value);
    group.forEach(video => {
      video.defaultPlaybackRate = rate;
      video.playbackRate = rate;
    });
  };
  applyGroupSpeed();
  const updateButton = () => {
    const playing = group.some(v => !v.paused && !v.ended);
    button.textContent = playing ? 'Pause all clips' : 'Play all clips';
    button.setAttribute('aria-pressed', String(playing));
  };
  async function playGroup() {
    status.textContent = '';
    const attempts = group.map(video => {
      loadVideo(video);
      if (video.ended) video.currentTime = 0;
      return video.play();
    });
    const results = await Promise.allSettled(attempts);
    if (results.some((result, i) => result.status === 'rejected' && group[i].hasAttribute('src') && result.reason?.name !== 'AbortError')) status.textContent = 'A clip could not start. Use its individual play control to try again.';
    updateButton();
  }
  button.addEventListener('click', () => {
    if (group.some(v => !v.paused && !v.ended)) group.forEach(v => v.pause());
    else playGroup();
  });
  scene.querySelector('.restart-group').addEventListener('click', () => {
    group.forEach(video => {resumeTimes.delete(video);loadVideo(video);video.currentTime = 0;});
    playGroup();
  });
  speedControl.addEventListener('change', applyGroupSpeed);
  group.forEach(video => ['play','pause','ended'].forEach(event => video.addEventListener(event, updateButton)));
  updateButton();
});

document.addEventListener('visibilitychange', () => {
  clearTimeout(focusTimer);
  if (document.hidden) videos.forEach(releaseVideo);
  else scheduleVideoFocus();
});

const navLinks = [...document.querySelectorAll('.scene-nav a')];
let scrollQueued = false;
function updateActiveScene() {
  scrollQueued = false;
  let active = null;
  for (const scene of document.querySelectorAll('.experiment-block')) {
    const rect = scene.getBoundingClientRect();
    if (rect.top <= 180 && rect.bottom > 100) active = scene.id;
  }
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
    active = document.querySelector('.experiment-block:last-of-type')?.id || active;
  }
  navLinks.forEach(link => {
    if (link.hash === `#${active}`) link.setAttribute('aria-current','true');
    else link.removeAttribute('aria-current');
  });
}
window.addEventListener('scroll', () => {
  if (!scrollQueued) { scrollQueued=true; requestAnimationFrame(updateActiveScene); }
}, {passive:true});
updateActiveScene();

const dialog = document.querySelector('#image-dialog');
document.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => {
  dialog.querySelector('img').src = button.dataset.image;
  dialog.showModal();
}));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {if(event.target === dialog) dialog.close();});
