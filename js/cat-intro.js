/* 고영희씨 팝아트: 풍선껌 터치 -> STEP 01 -> 촬영 -> 결과.
   원본 index.html/style.css/app.js/camera.js/frame.js/filters.js 변경 없음. */
(() => {
  'use strict';
  function initCatIntro() {
    const shell = document.getElementById('app-shell');
    const selection = document.getElementById('selection-screen');
    const capture = document.getElementById('capture-screen');
    const restart = document.getElementById('restart-button');
    const cameraStage = document.getElementById('camera-stage');
    const countdown = document.getElementById('countdown');
    if (!shell || !selection || !capture || document.getElementById('cat-pop-hero')) return;

    if (!document.getElementById('cat-pop-styles')) {
      const style = document.createElement('link');
      style.id = 'cat-pop-styles';
      style.rel = 'stylesheet';
      style.href = 'cat-intro.css';
      document.head.appendChild(style);
    }

    // 원본 이미지의 풍선껌 위치에 실제 클릭 영역을 배치합니다.
    // 원본 '터트릴까? 말까?' 글자는 이미지 일부이므로 디자인만 남습니다.
    const bubbleStyles = document.createElement('style');
    bubbleStyles.id = 'cat-pop-bubble-styles';
    bubbleStyles.textContent = `
      /* 카운트다운이 얼굴 중앙을 가리지 않도록 우상단 이동 + 연한 색상 */
      body:not(.cat-pop-selection):not(.cat-pop-intro) #camera-stage #countdown {
        top: 12px; right: 12px; bottom: auto; left: auto;
        width: 76px; height: 76px;
        border: 2px solid rgba(255,255,255,.88);
        background: rgba(255, 131, 167, 0.22);
        color: #fff;
        font-size: clamp(32px, 9vw, 44px);
        font-weight: 900;
        text-shadow: 0 2px 8px rgba(96,15,44,.92), 0 0 3px rgba(96,15,44,.85);
        box-shadow: 0 0 0 2px rgba(255,255,255,.15);
        backdrop-filter: none;
        pointer-events: none;
      }
      @media (max-width: 420px) {
        body:not(.cat-pop-selection):not(.cat-pop-intro) #camera-stage #countdown {
          top: 9px; right: 9px; width: 64px; height: 64px;
          font-size: 36px;
        }
      }
      #cat-pop-hero .cat-pop-artwork .cat-pop-start {
        left:41.2%; top:44.1%; width:19.1%; height:33.2%;
        border-radius:50%; z-index:5; touch-action:manipulation;
        overflow:visible; -webkit-tap-highlight-color:transparent;
      }
      #cat-pop-hero .cat-pop-start::before {
        content:''; position:absolute; inset:-5%; border:2px dashed rgba(255,255,255,.95);
        border-radius:50%; animation:cat-bubble-hint 1.65s ease-in-out infinite;
        pointer-events:none;
      }
      #cat-pop-hero .cat-pop-start:focus-visible { outline:3px solid #f51c3b; outline-offset:4px; }
      #cat-pop-hero .cat-pop-burst, #cat-pop-hero .cat-pop-ring {
        left:50.75%; top:60.7%; z-index:7;
      }
      #cat-pop-hero .cat-bubble-expand, #cat-pop-hero .cat-bubble-flash {
        position:absolute; inset:0; pointer-events:none; opacity:0;
      }
      #cat-pop-hero .cat-bubble-expand {
        width:100%; height:100%; object-fit:fill;
        clip-path:ellipse(9.35% 16.1% at 50.75% 60.7%);
        transform-origin:50.75% 60.7%; z-index:4;
      }
      #cat-pop-hero .cat-bubble-flash {
        z-index:6; inset:auto; left:50.75%; top:60.7%;
        width:26%; height:41%; background:#fff5fa;
        clip-path:polygon(50% 0%,60% 25%,82% 4%,79% 31%,100% 27%,87% 49%,100% 72%,76% 72%,79% 100%,57% 82%,50% 100%,38% 79%,14% 97%,23% 72%,0% 73%,14% 50%,0% 27%,23% 30%,19% 4%,42% 25%);
        transform:translate(-50%,-50%) scale(.05);
      }
      #cat-pop-hero.cat-pop-bursting .cat-pop-start { pointer-events:none; }
      #cat-pop-hero.cat-pop-bursting .cat-pop-start::before { animation:none; opacity:0; }
      #cat-pop-hero.cat-pop-bursting .cat-bubble-expand { animation:cat-bubble-grow .61s ease both; }
      #cat-pop-hero.cat-pop-bursting .cat-bubble-flash { animation:cat-bubble-pop .61s ease both; }
      #cat-pop-hero.cat-pop-bursting .cat-pop-burst { animation:cat-bubble-word .61s ease both; }
      #cat-pop-hero.cat-pop-bursting .cat-pop-ring { animation:cat-pop-ripple .43s .18s ease-out both; }
      @keyframes cat-bubble-hint { 0%,100%{opacity:0;transform:scale(.97)} 40%,65%{opacity:.9;transform:scale(1.09)} }
      @keyframes cat-bubble-grow { 0%{opacity:1;transform:scale(1)} 32%{opacity:1;transform:scale(1.27)} 39%,100%{opacity:0;transform:scale(1.27)} }
      @keyframes cat-bubble-pop { 0%,28%{opacity:0;transform:translate(-50%,-50%) scale(.05)} 42%{opacity:1;transform:translate(-50%,-50%) scale(1.55)} 100%{opacity:1;transform:translate(-50%,-50%) scale(1.65)} }
      @keyframes cat-bubble-word { 0%,28%{opacity:0;transform:translate(-50%,-50%) scale(.15) rotate(-20deg)} 48%{opacity:1;transform:translate(-50%,-50%) scale(1.15) rotate(-9deg)} 100%{opacity:1;transform:translate(-50%,-50%) scale(1.03) rotate(-9deg)} }
      @media(prefers-reduced-motion:reduce) {
        #cat-pop-hero .cat-pop-start::before {animation:none;opacity:.8}
        #cat-pop-hero.cat-pop-bursting .cat-bubble-expand,
        #cat-pop-hero.cat-pop-bursting .cat-bubble-flash,
        #cat-pop-hero.cat-pop-bursting .cat-pop-burst,
        #cat-pop-hero.cat-pop-bursting .cat-pop-ring {animation:none}
      }
    `;
    document.head.appendChild(bubbleStyles);

    const hero = document.createElement('section');
    hero.id = 'cat-pop-hero';
    hero.className = 'cat-pop-hero';
    hero.setAttribute('aria-label', '고영희씨 인생네컷 시작 화면');
    hero.innerHTML = `
      <div class="cat-pop-topbar">
        <p class="cat-pop-brand"><img src="images/brand-title.png" alt="인생네컷"></p>
      </div>
      <div class="cat-pop-artwork">
        <img class="cat-pop-main-image" src="images/cat-hero.png" alt="고영희씨, 우짠일인교? 오늘도 달콤상콤한 사고 발생? 풍선껌을 불고 있는 고양이">
        <button class="cat-pop-start" type="button" aria-label="풍선껌 터뜨리기, 사진 컷 수 선택으로 이동"></button>
        <img class="cat-bubble-expand" src="images/cat-hero.png" alt="" aria-hidden="true">
        <span class="cat-bubble-flash" aria-hidden="true"></span>
        <span class="cat-pop-burst" aria-hidden="true">팡!</span>
        <span class="cat-pop-ring" aria-hidden="true"></span>
      </div>
      <p class="cat-pop-note">풍선껌을 톡! 눌러 시작해요</p>`;
    selection.parentNode.insertBefore(hero, selection);
    let introPassed = false;
    let bursting = false;
    const startButton = hero.querySelector('.cat-pop-start');
    const photo = hero.querySelector('.cat-pop-main-image');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const showScreen = () => {
      const inSelection = !selection.classList.contains('hidden') && !selection.hidden;
      document.body.classList.toggle('cat-pop-selection', inSelection);
      document.body.classList.toggle('cat-pop-intro', inSelection && !introPassed);
      hero.hidden = !inSelection || introPassed;
    };
    const observer = new MutationObserver(showScreen);
    observer.observe(selection, {attributes:true, attributeFilter:['class','hidden']});
    showScreen();

    // 이미지 파일이 없는 경우 기존 선택 버튼을 사용할 수 있도록 자동 우회합니다.
    photo.addEventListener('error', () => { introPassed = true; showScreen(); }, {once:true});
    if (photo.complete && photo.naturalWidth === 0) { introPassed = true; showScreen(); }

    startButton.addEventListener('click', () => {
      if (bursting) return;
      bursting = true;
      hero.classList.add('cat-pop-bursting');
      window.setTimeout(() => {
        introPassed = true;
        hero.classList.remove('cat-pop-bursting');
        showScreen();
        selection.scrollIntoView({behavior:reducedMotion?'auto':'smooth', block:'start'});
        const firstCut = document.getElementById('select-two-button');
        if (firstCut && document.activeElement === startButton) firstCut.focus({preventScroll:true});
        bursting = false;
      }, reducedMotion ? 40 : 610);
    });

    // 컷 수 다시 고르기는 STEP 01로, 결과의 처음으로는 고양이 인트로로.
    if (restart) {
      restart.addEventListener('click', () => {
        introPassed = false;
        window.requestAnimationFrame(() => {
          showScreen();
          window.scrollTo({top:0, behavior:'instant'});
        });
      });
    }

    // 카메라 위 장식만 추가합니다. 실제 촬영 영상/결과물에는 들어가지 않음.
    if (cameraStage && !cameraStage.querySelector('.cat-camera-decor')) {
      const frame = document.createElement('div');
      frame.className = 'cat-camera-decor';
      frame.setAttribute('aria-hidden','true');
      frame.innerHTML = `
        <span class="cat-camera-photo-tag">✦ PHOTO</span>
        <span class="cat-camera-corner tl"></span><span class="cat-camera-corner tr"></span>
        <span class="cat-camera-corner bl"></span><span class="cat-camera-corner br"></span>`;
      cameraStage.appendChild(frame);
    }
    if (cameraStage && countdown) {
      let lastText = '';
      const updateCountdown = () => {
        const label = countdown.textContent.trim();
        if (label === '찰칵!' && lastText !== '찰칵!') {
          cameraStage.classList.remove('cat-camera-snap');
          // 재시작을 위해 애니메이션 상태를 확정한 뒤 다시 적용.
          void cameraStage.offsetWidth;
          cameraStage.classList.add('cat-camera-snap');
          window.setTimeout(() => cameraStage.classList.remove('cat-camera-snap'), 300);
        }
        lastText = label;
      };
      const watchCountdown = new MutationObserver(updateCountdown);
      watchCountdown.observe(countdown, {childList:true, characterData:true, subtree:true});
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCatIntro, {once:true});
  } else { initCatIntro(); }
})();
