/* 고영희씨 팝아트 v3: 인트로 -> STEP 01 -> 촬영 -> 결과.
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
        <button class="cat-pop-start" type="button" aria-label="터트릴까? 말까? 누르면 사진 컷 수 선택으로 이동합니다"></button>
        <span class="cat-pop-burst" aria-hidden="true">팡!</span>
        <span class="cat-pop-ring" aria-hidden="true"></span>
      </div>
      <p class="cat-pop-note">터뜨리면, 시작!</p>`;
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
