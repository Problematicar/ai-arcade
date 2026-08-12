(function () {
  'use strict';

  let games = [];
  let selectedIndex = 0;
  let audioCtx = null;

  let loadOverlay = null;
  let loadTimeout = null;
  let scrollTimer = null;

  /* ─── Audio ─── */
  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone(freq, duration, type, vol) {
    try {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime((vol || 0.08), audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playSelect() { playTone(600, 0.08, 'square', 0.06); }
  function playConfirm() {
    playTone(523, 0.1, 'sine', 0.08);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.08), 100);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.08), 200);
  }
  function playAmbient() {
    try {
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      // Low rumble
      const bufferSize = audioCtx.sampleRate * 4;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.02;
      }
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, audioCtx.currentTime);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      source.start();

      // Subtle tone
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, audioCtx.currentTime);
      oscGain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      osc.start();
    } catch (e) {}
  }

  /* ─── Stars ─── */
  function createStars() {
    const container = document.getElementById('stars') || (function () {
      const el = document.createElement('div');
      el.id = 'stars';
      document.getElementById('arcade').prepend(el);
      return el;
    })();
    for (let i = 0; i < 120; i++) {
      const star = document.createElement('div');
      const size = 1 + Math.random() * 2;
      star.style.cssText = `
        position: absolute;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 70}%;
        width: ${size}px;
        height: ${size}px;
        background: white;
        border-radius: 50%;
        opacity: ${0.2 + Math.random() * 0.6};
        animation: twinkle ${2 + Math.random() * 4}s ease-in-out infinite;
        animation-delay: ${Math.random() * 4}s;
      `;
      container.appendChild(star);
    }
    const style = document.createElement('style');
    style.textContent = `
      @keyframes twinkle {
        0%, 100% { opacity: 0.2; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.3); }
      }
    `;
    document.head.appendChild(style);
  }

  /* ─── Cabinet Rendering ─── */
  function createCabinet(game, index) {
    const cab = document.createElement('div');
    cab.className = 'cabinet' + (index === 0 ? ' selected' : '');
    cab.style.setProperty('--cabinet-color', game.color || '#44cc44');
    cab.dataset.index = index;

    const emoji = game.emoji || '';
    cab.innerHTML = `
      <div class="cabinet-glow"></div>
      <div class="marquee"><div class="marquee-text"><span class="marquee-emoji">${emoji}</span> ${escHtml(game.title)}</div></div>
      <div class="screen-bezel">
        <div class="screen">
          <div class="screen-emoji">${emoji}</div>
          <div class="screen-game-title">${escHtml(game.title)}</div>
          <div class="screen-desc">${escHtml(game.description || '')}</div>
          <div class="screen-controls">${escHtml(game.controls || '')}</div>
          <div class="screen-idle">▼ PLAY ▼</div>
        </div>
      </div>
      <div class="control-panel">
        <div class="control-btn"></div>
        <div class="control-stick"></div>
        <div class="control-btn"></div>
      </div>
      <div class="cabinet-base"><span class="cabinet-base-text">● AI ARCADE ●</span></div>
    `;

    cab.addEventListener('click', (e) => {
      if (e.target.closest('.cabinet')) {
        selectCabinet(index);
        setTimeout(() => launchGame(index), 300);
      }
    });

    cab.addEventListener('mouseenter', () => {
      // selectCabinet() plays the select tone; only run it when the selection
      // actually changes so hovering the same cabinet stays silent.
      if (selectedIndex !== index) selectCabinet(index);
    });

    return cab;
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function scrollDescription(cab) {
    const desc = cab && cab.querySelector('.screen-desc');
    if (!desc) return;
    const maxScroll = desc.scrollHeight - desc.clientHeight;
    if (maxScroll <= 0) return;
    scrollTimer = setInterval(() => {
      if (!cab.classList.contains('selected')) { desc.scrollTop = 0; clearInterval(scrollTimer); return; }
      if (desc.scrollTop >= maxScroll) { clearInterval(scrollTimer); return; }
      desc.scrollTop += 1;
    }, 80);
  }

  /* ─── Selection ─── */
  function selectCabinet(index) {
    const cabs = document.querySelectorAll('.cabinet');
    cabs.forEach((c, i) => {
      c.classList.toggle('selected', i === index);
    });
    selectedIndex = index;
    updateHUD();
    playSelect();

    // Stop previous scroll
    if (scrollTimer) { clearInterval(scrollTimer); scrollTimer = null; }
    // Reset all descriptions to top
    cabs.forEach(c => { const d = c.querySelector('.screen-desc'); if (d) d.scrollTop = 0; });

    const container = document.getElementById('cabinet-container');
    const cab = cabs[index];
    if (cab) {
      const scrollLeft = cab.offsetLeft - container.offsetWidth / 2 + cab.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }

    // Remove old arrows
    document.querySelectorAll('.selection-arrow').forEach(a => a.remove());
    if (cab) {
      const arrow = document.createElement('div');
      arrow.className = 'selection-arrow';
      arrow.textContent = '▼';
      cab.appendChild(arrow);
      // Start auto-scroll
      scrollDescription(cab);
    }
  }

  function updateHUD() {
    const el = document.getElementById('game-count');
    if (el) el.textContent = `${selectedIndex + 1} / ${games.length}`;
  }

  function cancelLaunch() {
    if (loadOverlay) {
      loadOverlay.remove();
      loadOverlay = null;
    }
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
    }
  }

  /* ─── Launch ─── */
  function launchGame(index) {
    if (!games[index]) return;
    cancelLaunch();
    playConfirm();
    const game = games[index];
    const path = game.path || game.folder + '/index.html';

    loadOverlay = document.createElement('div');
    loadOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 200;
      background: #0a0a12;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      opacity: 0;
      transition: opacity 0.5s;
      color: ${game.color || '#44cc44'};
      font-family: 'Courier New', monospace;
    `;
    loadOverlay.innerHTML = `
      <div style="position:absolute;top:1.5rem;left:1.5rem;font-size:0.8rem;color:#666;cursor:pointer;padding:8px 16px;border:1px solid #444;border-radius:4px;transition:color 0.2s,border-color 0.2s;" id="back-btn">← BACK</div>
      <div style="font-size:2rem;font-weight:800;letter-spacing:0.2em;text-shadow:0 0 30px currentColor;">
        NOW LOADING
      </div>
      <div style="margin-top:1rem;font-size:0.9rem;color:#888;">
        ${escHtml(game.title)}
      </div>
      <div style="margin-top:2rem;width:200px;height:3px;background:#222;border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:0%;background:${game.color || '#44cc44'};border-radius:2px;transition:width 0.8s;" id="load-bar"></div>
      </div>
    `;
    document.body.appendChild(loadOverlay);

    const backBtn = loadOverlay.querySelector('#back-btn');
    backBtn.addEventListener('click', cancelLaunch);
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.color = '#aaa';
      backBtn.style.borderColor = '#888';
    });
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.color = '#666';
      backBtn.style.borderColor = '#444';
    });

    requestAnimationFrame(() => {
      // The overlay can be cancelled (Escape / another launch) before this
      // frame fires — bail out instead of touching a removed node.
      if (!loadOverlay) return;
      loadOverlay.style.opacity = '1';
      const bar = document.getElementById('load-bar');
      if (bar) bar.style.width = '100%';
    });

    loadTimeout = setTimeout(() => {
      if (loadOverlay) window.location.href = path;
    }, 1200);
  }

  /* ─── Init ─── */
  function init() {
    createStars();

    // Load game data from embedded script (works with file:// protocol)
    games = window.ARCADE_GAMES || [];

    if (!games || games.length === 0) {
      document.getElementById('cabinet-container').innerHTML =
        '<div style="color:#666;text-align:center;padding:4rem;">No games found.<br>Run <strong>refresh-games.ps1</strong> to scan for games.</div>';
      document.getElementById('game-count').textContent = '0 / 0';
      return;
    }

    // Build cabinets (clear first in case of bfcache restore)
    const container = document.getElementById('cabinet-container');
    container.innerHTML = '';
    games.forEach((game, i) => {
      container.appendChild(createCabinet(game, i));
    });

    // Set initial count and select the first cabinet synchronously. Using a
    // deferred timeout here lets a quick key press after the splash race with
    // the pending selectCabinet(0), which would snap the user's selection back.
    updateHUD();
    selectCabinet(0);
  }

  /* ─── Single unified key handler ─── */
  function handleKey(e) {
    const splash = document.getElementById('splash');
    const showingSplash = splash && !splash.classList.contains('hidden');

    if (showingSplash) {
      splash.classList.add('hidden');
      document.getElementById('floor').classList.add('visible');
      initAudio();
      playAmbient();
      init();
      return;
    }

    if (e.key === 'Escape') { cancelLaunch(); return; }
    if (loadOverlay) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      selectCabinet((selectedIndex + 1) % games.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      selectCabinet((selectedIndex - 1 + games.length) % games.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      launchGame(selectedIndex);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', handleKey);
    document.addEventListener('click', () => {
      const splash = document.getElementById('splash');
      if (splash && !splash.classList.contains('hidden')) {
        splash.classList.add('hidden');
        document.getElementById('floor').classList.add('visible');
        initAudio();
        playAmbient();
        init();
      }
    });
  });

})();
