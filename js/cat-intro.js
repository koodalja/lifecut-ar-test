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

/*
 * 고영희씨 v4 확장: 기존 2·4컷 기능을 보존하면서 6·8컷 촬영/프레임을 추가.
 * 별도의 앱 초기화/촬영 핸들러를 교체하지 않고 확장합니다.
 * 상단 안내문 정렬 및 풍선껌 팝 연출만 개선합니다.
 */
(() => {
  'use strict';
  const SUPPORTED_EXTRA = [6, 8];
  const extra = { count: 0, shots: [], filter: 'original', busy: false };

  function e(id) { return document.getElementById(id); }
  function focusSafe(element) {
    if (element && typeof element.focus === 'function') element.focus({preventScroll:true});
  }

  function makeCutOption(count, description) {
    const button = document.createElement('button');
    button.id = count === 6 ? 'select-six-button' : 'select-eight-button';
    button.className = 'cut-option';
    button.type = 'button';
    button.dataset.cutCount = String(count);
    button.setAttribute('aria-pressed', 'false');
    const mini = document.createElement('span');
    mini.className = 'mini-frame mini-frame-' + count;
    mini.setAttribute('aria-hidden', 'true');
    for (let index=0; index<count; index++) {
      const cell=document.createElement('span');
      cell.className = 'mini-frame-photo';
      mini.appendChild(cell);
    }
    const label=document.createElement('span');
    label.className='cut-option-label';
    label.textContent=count+'컷';
    const desc=document.createElement('span');
    desc.className='cut-option-description';
    desc.textContent=description;
    button.append(mini,label,desc);
    return button;
  }

  function layoutMoreShots(shots) {
    if (![6,8].includes(shots.length)) throw new Error('6컷 또는 8컷 사진을 확인해 주세요.');
    // 2컷·4컷은 원래 세로형, 6컷·8컷은 가로 2열의 3·4행으로 구성.
    const cols=2;
    const rows=shots.length/cols;
    const canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d');
    if(!ctx) throw new Error('사진 프레임을 준비하지 못했습니다.');
    const frameWidth=720;
    const padX=42;
    const gapX=18;
    const gapY=18;
    const cellW=(frameWidth-2*padX-gapX)/cols;
    const cellH=cellW*3/4;
    const top=42;
    const foot=142;
    canvas.width=frameWidth;
    canvas.height=Math.ceil(top+rows*cellH+(rows-1)*gapY+foot);
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    shots.forEach((shot,index)=>{
      if(!shot || !shot.width || !shot.height) throw new Error((index+1)+'번째 사진이 비어 있습니다.');
      const targetRatio=cellW/cellH;
      const ratio=shot.width/shot.height;
      let sx=0,sy=0,sw=shot.width,sh=shot.height;
      if(ratio>targetRatio) {sw=shot.height*targetRatio;sx=(shot.width-sw)/2;}
      else {sh=shot.width/targetRatio;sy=(shot.height-sh)/2;}
      const row=Math.floor(index/cols);
      const col=index%cols;
      const dx=padX+col*(cellW+gapX);
      const dy=top+row*(cellH+gapY);
      ctx.drawImage(shot,sx,sy,sw,sh,dx,dy,cellW,cellH);
    });
    const footerY=top+rows*cellH+(rows-1)*gapY;
    const date=new Date();
    const dateText=date.getFullYear()+'.'+String(date.getMonth()+1).padStart(2,'0')+'.'+String(date.getDate()).padStart(2,'0');
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillStyle='#302b28';
    ctx.font="700 30px 'Noto Sans KR',sans-serif";
    ctx.fillText('인생네컷',frameWidth/2,footerY+51);
    ctx.fillStyle='#8b7b70';
    ctx.font="500 18px 'Noto Sans KR',sans-serif";
    ctx.fillText(dateText,frameWidth/2,footerY+91);
    return canvas;
  }

  function renderExtraResult() {
    if(extra.shots.length!==extra.count) throw new Error('촬영한 사진이 모두 준비되지 않았어요.');
    const filtered=extra.shots.map(shot=>window.applyFilter(shot,extra.filter));
    const strip=layoutMoreShots(filtered);
    const frame=e('final-frame');
    const ctx=frame.getContext('2d');
    if(!ctx) throw new Error('최종 사진을 표시하지 못했습니다.');
    frame.width=strip.width;
    frame.height=strip.height;
    ctx.drawImage(strip,0,0);
  }

  function chooseExtraCount(count) {
    extra.count=count;
    extra.shots=[];
    extra.filter='original';
    const selected=e('selected-count');
    const countLabel=e('progress-count');
    const cameraStatus=e('camera-status');
    const previewList=e('shot-previews');
    e('selection-screen').classList.add('hidden');
    e('result-screen').classList.add('hidden');
    e('capture-screen').classList.remove('hidden');
    document.querySelectorAll('#cut-options .cut-option').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.cutCount)===count)));
    selected.textContent=count+'컷 촬영';
    countLabel.textContent='0 / '+count;
    cameraStatus.textContent='시작 버튼을 누르면 '+count+'번 자동으로 촬영합니다.';
    e('selection-status').textContent=count+'컷을 선택했어요.';
    e('preview-count').textContent='0장';
    previewList.replaceChildren();
    e('camera-placeholder').classList.remove('hidden');
    e('camera-video').classList.add('hidden');
    e('start-capture-button').textContent='촬영 시작';
  }

  async function takeExtraShots() {
    if(!extra.count || extra.busy) return;
    const count=extra.count;
    const video=e('camera-video');
    const countdown=e('countdown');
    const status=e('camera-status');
    const preview=e('shot-previews');
    const previewCount=e('preview-count');
    const progress=e('progress-count');
    const start=e('start-capture-button');
    const back=e('back-to-selection-button');
    extra.busy=true;
    extra.shots=[];
    extra.filter='original';
    start.disabled=true;
    back.disabled=true;
    preview.replaceChildren();
    previewCount.textContent='0장';
    progress.textContent='0 / '+count;
    countdown.classList.add('hidden');
    status.textContent='카메라를 연결하고 있어요.';
    try {
      // 동적으로 호출해 기존 AR ON/OFF 및 촬영사진 합성을 그대로 이용.
      await window.startCamera(video);
      e('camera-placeholder').classList.add('hidden');
      for(let i=0;i<count;i++) {
        const number=i+1;
        progress.textContent=number+' / '+count;
        status.textContent=number+'번째 사진을 준비하고 있어요.';
        await window.runCountdown(countdown,status);
        const shot=await window.captureShot(video);
        extra.shots.push(shot);
        window.addShotPreview(shot,number,preview);
        previewCount.textContent=extra.shots.length+'장';
        if(number<count) {
          status.textContent='다음 사진을 준비하고 있어요.';
          await window.wait(700);
        }
      }
      window.stopCamera(video);
      video.classList.add('hidden');
      renderExtraResult();
      const filters=e('filters');
      filters.querySelectorAll('.filter-btn').forEach(b=>{
        const current=b.id==='filter-button-original';
        b.classList.toggle('active',current);
        b.setAttribute('aria-pressed',String(current));
      });
      e('capture-screen').classList.add('hidden');
      e('result-screen').classList.remove('hidden');
      e('result-status').textContent=count+'장의 사진으로 프레임을 만들었어요.';
    } catch(error) {
      console.error('[고영희씨 6/8컷] 촬영 오류:',error);
      try {window.stopCamera(video);} catch(e) {}
      video.classList.add('hidden');
      e('camera-placeholder').classList.remove('hidden');
      countdown.classList.add('hidden');
      const reason=typeof window.getCameraErrorMessage==='function' ? window.getCameraErrorMessage(error) : (error.message || '촬영 오류');
      status.textContent=reason+' 다시 촬영하거나 컷 수를 다시 골라 주세요.';
      progress.textContent=extra.shots.length+' / '+count;
      start.textContent='다시 촬영하기';
    } finally {
      extra.busy=false;
      start.disabled=false;
      back.disabled=false;
    }
  }

  function initCutsAndIntro() {
    const cutOptions=e('cut-options');
    const start=e('start-capture-button');
    const filters=e('filters');
    const pageIntro=e('page-intro');
    if(!cutOptions || !start || !filters || e('select-six-button')) return;
    // 기존 인트로 문구의 '사진'이 줄 끝에서 갈라지지 않도록 의미 단위로 두 줄 고정.
    if(pageIntro){
      pageIntro.innerHTML='<span class="cat-intro-line">원하는 컷 수를 고르고</span><span class="cat-intro-line">나만의 사진을 남겨 보세요.</span>';
    }
    const badge=e('selection-badge');
    if(badge) badge.textContent='2 · 4 · 6 · 8컷';
    const hint=e('selection-status');
    if(hint) hint.textContent='2컷, 4컷, 6컷, 8컷 중 선택해 주세요.';
    cutOptions.append(makeCutOption(6,'다양하게 여섯 장'),makeCutOption(8,'풍성하게 여덟 장'));
    SUPPORTED_EXTRA.forEach(count=>{
      e(count===6?'select-six-button':'select-eight-button')
        .addEventListener('click',()=>chooseExtraCount(count));
    });
    ['select-two-button','select-four-button'].forEach(id=>{
      e(id)?.addEventListener('click',()=>{extra.count=0;extra.shots=[];});
    });
    // 앱의 2·4컷 클릭 핸들러는 유지하고 6·8컷을 선택한 경우만 차단/대체.
    start.addEventListener('click',event=>{
      if(!extra.count) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void takeExtraShots();
    },{capture:true});
    filters.addEventListener('click',event=>{
      if(!extra.count || extra.shots.length!==extra.count) return;
      const button=event.target.closest('.filter-btn');
      if(!button || !filters.contains(button)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      extra.filter=button.id.replace('filter-button-','');
      filters.querySelectorAll('.filter-btn').forEach(b=>{
        const active=b===button;
        b.classList.toggle('active',active);
        b.setAttribute('aria-pressed',String(active));
      });
      try {
        renderExtraResult();
        e('result-status').textContent=button.textContent+' 필터를 적용했어요.';
      } catch(error) {
        console.error('[고영희씨 6/8컷] 필터 오류:',error);
        e('result-status').textContent=error.message || '필터를 적용하지 못했어요.';
      }
    },{capture:true});
    const resetExtra=()=>{
      extra.count=0;
      extra.shots=[];
      extra.filter='original';
      document.querySelectorAll('#cut-options .cut-option').forEach(b=>b.setAttribute('aria-pressed','false'));
    };
    e('back-to-selection-button')?.addEventListener('click',()=>{if(!extra.busy)resetExtra();});
    e('restart-button')?.addEventListener('click',resetExtra);

    // 풍선껌 터짐: 본래 이미지 보존, 흰 번쩍임/별 파편/짧은 카툰 팡 효과 강화.
    const hero=e('cat-pop-hero');
    const artwork=hero?.querySelector('.cat-pop-artwork');
    const bubble=hero?.querySelector('.cat-pop-start');
    if(!hero || !artwork || !bubble) return;
    const flash=document.createElement('span');
    flash.className='cat-pop-impact-flash';
    flash.setAttribute('aria-hidden','true');
    artwork.appendChild(flash);
    const pieces=[];
    for(let i=0;i<10;i++) {
      const part=document.createElement('span');
      part.className='cat-pop-confetti';
      part.setAttribute('aria-hidden','true');
      part.style.setProperty('--angle',String(i*36)+'deg');
      part.style.setProperty('--turn',String((i%2?1:-1)*130)+'deg');
      artwork.appendChild(part);
      pieces.push(part);
    }
    const popSound=()=>{
      try {
        const AudioCtx=window.AudioContext||window.webkitAudioContext;
        if(!AudioCtx) return;
        const audio=new AudioCtx();
        const osc=audio.createOscillator();
        const gain=audio.createGain();
        osc.type='triangle';
        osc.frequency.setValueAtTime(520,audio.currentTime);
        osc.frequency.exponentialRampToValueAtTime(115,audio.currentTime+.13);
        gain.gain.setValueAtTime(.045,audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.15);
        osc.connect(gain);gain.connect(audio.destination);
        osc.start();osc.stop(audio.currentTime+.16);
        osc.onended=()=>{void audio.close().catch(()=>{});};
      } catch(error) { /* 소리를 못 내도 화면 전환은 정상 진행 */ }
    };
    bubble.addEventListener('click',()=>{
      const radius=Math.min(artwork.clientWidth*.23,155);
      pieces.forEach((part,i)=>{
        const rad=2*Math.PI*i/pieces.length;
        part.style.setProperty('--dx',Math.cos(rad)*radius+'px');
        part.style.setProperty('--dy',Math.sin(rad)*radius*.82+'px');
      });
      popSound();
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initCutsAndIntro,{once:true});
  else initCutsAndIntro();
})();
