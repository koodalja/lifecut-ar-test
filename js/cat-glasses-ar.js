/* 고영희씨 AR: 핑크 선글라스 + 고양이 귀(머리띠 없음) + 얼굴톤 보정
 * 기존 app.js / camera.js / cat-intro.js / index.html / CSS를 변경하지 않습니다.
 * 기존 FaceLandmarker 1개를 3개 기능이 공유합니다.
 * 준비 파일: images/cat-pink-glasses.svg, images/cat-ears-only.png
 * 주의: 이 버전은 얼굴 영역의 밝기/대비/채도를 부드럽게 조절하며
 *       피부 질감 리터칭이나 얼굴형 변경 기능은 아닙니다.
 */
(() => {
  'use strict';

  const MEDIAPIPE_VERSION = '1.2.3'; // 기존 프로젝트에서 작동한 버전 유지
  const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  const SETTINGS = Object.freeze({
    glassesScale: 2.15,   // 기존 확대 버전 유지
    earsScale: 1.38,      // 얼굴 윤곽 너비에 대한 '귀 두 개 전체' 폭
    earsBaseDrop: 0.08,  // 귀 밑변 위치: 이마 지점에서 얼굴 폭의 8% 아래
    toneBrightness: 1.06,
    toneContrast: 1.03,
    toneSaturation: 1.04,
    faceFeatherRatio: 0.035, // 얼굴 마스크 경계 부드럽게
    detectionInterval: 75   // 약 13fps로 얼굴 추적
  });

  // MediaPipe 얼굴 윤곽선: 이마 -> 오른쪽 턱 -> 턱끝 -> 왼쪽 턱 -> 이마
  const FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
  ];

  function init() {
    const screen = document.getElementById('capture-screen');
    const stage = document.getElementById('camera-stage');
    const video = document.getElementById('camera-video');
    const progress = document.getElementById('capture-progress');
    if (!screen || !stage || !video || !progress || document.getElementById('cat-ar-toggle')) return;

    if (typeof window.startCamera !== 'function' ||
        typeof window.stopCamera !== 'function' ||
        typeof window.captureShot !== 'function') {
      console.warn('[고영희 AR] 기존 카메라 함수를 찾지 못했습니다.');
      return;
    }

    if (!document.getElementById('cat-glasses-ar-css')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'cat-glasses-ar.css';
      style.id = 'cat-glasses-ar-css';
      document.head.appendChild(style);
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'cat-ar-toolbar';
    toolbar.innerHTML = `
      <button type="button" id="cat-ar-toggle" class="cat-ar-toggle" aria-pressed="false">😎 고영희씨 안경 OFF</button>
      <button type="button" id="cat-ears-toggle" class="cat-ar-toggle" aria-pressed="false">🐱 고양이 귀 OFF</button>
      <button type="button" id="cat-tone-toggle" class="cat-ar-toggle" aria-pressed="false">✨ 얼굴톤 OFF</button>
      <span id="cat-ar-status" class="cat-ar-status" role="status" aria-live="polite">기본 촬영</span>`;
    progress.insertAdjacentElement('afterend', toolbar);

    const glassesButton = toolbar.querySelector('#cat-ar-toggle');
    const earsButton = toolbar.querySelector('#cat-ears-toggle');
    const toneButton = toolbar.querySelector('#cat-tone-toggle');
    const status = toolbar.querySelector('#cat-ar-status');
    const overlay = document.createElement('canvas');
    overlay.id = 'cat-ar-overlay';
    overlay.className = 'cat-ar-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    stage.appendChild(overlay);

    const glassesGraphic = new Image();
    glassesGraphic.decoding = 'async';
    glassesGraphic.src = 'images/cat-pink-glasses.svg';

    const earsGraphic = new Image();
    earsGraphic.decoding = 'async';
    earsGraphic.src = 'images/cat-ears-only.png';

    let glassesEnabled = false;
    let earsEnabled = false;
    let toneEnabled = false;
    let detector = null;
    let loadPromise = null;
    let raf = null;
    let lastDetectionAt = -Infinity;
    let latestFace = null;
    let lastTimestamp = 0;

    // 재사용하는 작업 캔버스: 촬영 미리보기에서 반복 생성 방지
    const toneCanvas = document.createElement('canvas');
    const faceMaskCanvas = document.createElement('canvas');
    const toneContext = toneCanvas.getContext('2d');
    const maskContext = faceMaskCanvas.getContext('2d');

    const anyEnabled = () => glassesEnabled || earsEnabled || toneEnabled;

    function updateStatus(message) {
      status.textContent = message;
    }

    function updateButtons() {
      glassesButton.setAttribute('aria-pressed', String(glassesEnabled));
      glassesButton.textContent = glassesEnabled ? '😎 고영희씨 안경 ON' : '😎 고영희씨 안경 OFF';
      earsButton.setAttribute('aria-pressed', String(earsEnabled));
      earsButton.textContent = earsEnabled ? '🐱 고양이 귀 ON' : '🐱 고양이 귀 OFF';
      toneButton.setAttribute('aria-pressed', String(toneEnabled));
      toneButton.textContent = toneEnabled ? '✨ 얼굴톤 ON' : '✨ 얼굴톤 OFF';
    }

    async function loadDetector() {
      if (detector) return detector;
      if (!loadPromise) {
        loadPromise = (async () => {
          const mediapipe = await import(`${CDN}/vision_bundle.mjs`);
          const { FilesetResolver, FaceLandmarker } = mediapipe;
          if (!FilesetResolver || !FaceLandmarker) throw new Error('얼굴 추적 모듈을 불러오지 못했습니다.');
          const fileset = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
          const options = {
            baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: false
          };
          try {
            return await FaceLandmarker.createFromOptions(fileset, options);
          } catch (gpuError) {
            console.warn('[고영희 AR] GPU 불가, CPU로 재시도:', gpuError);
            options.baseOptions.delegate = 'CPU';
            return FaceLandmarker.createFromOptions(fileset, options);
          }
        })().then(value => {
          detector = value;
          return value;
        }).catch(error => {
          loadPromise = null;
          throw error;
        });
      }
      return loadPromise;
    }

    function clearOverlay() {
      const context = overlay.getContext('2d');
      if (context) context.clearRect(0, 0, overlay.width, overlay.height);
    }

    function stopTracking() {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      latestFace = null;
      lastDetectionAt = -Infinity;
      clearOverlay();
    }

    function videoActive() {
      return Boolean(video.srcObject && video.videoWidth && video.videoHeight && video.readyState >= 2);
    }

    function detectFace() {
      if (!detector || !videoActive()) return null;
      const now = performance.now();
      lastTimestamp = Math.max(now, lastTimestamp + 1);
      const results = detector.detectForVideo(video, lastTimestamp);
      return results?.faceLandmarks?.[0] ?? null;
    }

    // 기존 잘 작동하는 선글라스 위치·회전을 그대로 사용합니다.
    function drawGlasses(context, face, width, height) {
      if (!face || !glassesGraphic.complete || !glassesGraphic.naturalWidth) return false;
      const left = face[33];
      const right = face[263];
      if (!left || !right) return false;
      const dx = (right.x - left.x) * width;
      const dy = (right.y - left.y) * height;
      const span = Math.hypot(dx, dy);
      if (!Number.isFinite(span) || span < 12) return false;
      const x = ((left.x + right.x) / 2) * width;
      const y = ((left.y + right.y) / 2) * height;
      const glassesWidth = span * SETTINGS.glassesScale;
      const glassesHeight = glassesWidth * (180 / 440);
      context.save();
      context.translate(x, y);
      context.rotate(Math.atan2(dy, dx));
      context.drawImage(glassesGraphic, -glassesWidth / 2, -glassesHeight * 0.50, glassesWidth, glassesHeight);
      context.restore();
      return true;
    }

    // 고양이 귀만 이마 위에 배치합니다. 머리띠 이미지는 사용하지 않습니다.
    function drawEars(context, face, width, height) {
      if (!face || !earsGraphic.complete || !earsGraphic.naturalWidth) return false;
      const forehead = face[10];
      const leftSide = face[234];
      const rightSide = face[454];
      const leftEye = face[33];
      const rightEye = face[263];
      if (!forehead || !leftSide || !rightSide || !leftEye || !rightEye) return false;

      const faceWidth = Math.hypot(
        (rightSide.x - leftSide.x) * width,
        (rightSide.y - leftSide.y) * height
      );
      if (!Number.isFinite(faceWidth) || faceWidth < 25) return false;
      const roll = Math.atan2(
        (rightEye.y - leftEye.y) * height,
        (rightEye.x - leftEye.x) * width
      );
      const drawWidth = faceWidth * SETTINGS.earsScale;
      const drawHeight = drawWidth * earsGraphic.naturalHeight / earsGraphic.naturalWidth;

      context.save();
      context.translate(forehead.x * width, forehead.y * height);
      context.rotate(roll);
      // PNG의 양쪽 귀 하단이 이마(특징점 10) 바로 위에서 닿도록
      context.drawImage(
        earsGraphic,
        -drawWidth / 2,
        faceWidth * SETTINGS.earsBaseDrop - drawHeight,
        drawWidth,
        drawHeight
      );
      context.restore();
      return true;
    }

    // 얼굴 윤곽을 부드럽게 마스킹해 톤 보정이 주변 배경에 적용되지 않게 합니다.
    // 이마, 눈, 코, 입까지 포함하는 얼굴 영역이며 정밀 피부 분할은 아닙니다.
    function applyFaceTone(context, source, face, imageWidth, imageHeight) {
      if (!toneEnabled || !toneContext || !maskContext || !face || !source) return false;
      const vertices = FACE_OVAL.map(index => face[index]).filter(Boolean);
      if (vertices.length !== FACE_OVAL.length) return false;

      const pts = vertices.map(p => ({ x: p.x * imageWidth, y: p.y * imageHeight }));
      const xs = pts.map(p => p.x);
      const ys = pts.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const fw = maxX - minX;
      if (!Number.isFinite(fw) || fw < 25) return false;
      const feather = Math.max(3, Math.round(fw * SETTINGS.faceFeatherRatio));
      const x0 = Math.max(0, Math.floor(minX - feather * 3));
      const y0 = Math.max(0, Math.floor(minY - feather * 3));
      const x1 = Math.min(imageWidth, Math.ceil(maxX + feather * 3));
      const y1 = Math.min(imageHeight, Math.ceil(maxY + feather * 3));
      const rw = Math.max(1, x1 - x0);
      const rh = Math.max(1, y1 - y0);
      if (rw < 2 || rh < 2) return false;

      toneCanvas.width = rw;
      toneCanvas.height = rh;
      faceMaskCanvas.width = rw;
      faceMaskCanvas.height = rh;
      toneContext.clearRect(0, 0, rw, rh);
      toneContext.filter = `brightness(${SETTINGS.toneBrightness}) contrast(${SETTINGS.toneContrast}) saturate(${SETTINGS.toneSaturation})`;
      toneContext.drawImage(source, x0, y0, rw, rh, 0, 0, rw, rh);
      toneContext.filter = 'none';

      maskContext.clearRect(0, 0, rw, rh);
      maskContext.fillStyle = '#fff';
      maskContext.filter = `blur(${feather}px)`;
      maskContext.beginPath();
      maskContext.moveTo(pts[0].x - x0, pts[0].y - y0);
      for (let i = 1; i < pts.length; i++) {
        maskContext.lineTo(pts[i].x - x0, pts[i].y - y0);
      }
      maskContext.closePath();
      maskContext.fill();
      maskContext.filter = 'none';

      toneContext.save();
      toneContext.globalCompositeOperation = 'destination-in';
      toneContext.drawImage(faceMaskCanvas, 0, 0);
      toneContext.restore();
      context.drawImage(toneCanvas, x0, y0);
      return true;
    }

    function drawSelected(context, face, width, height, source) {
      // 톤 보정 먼저, 그 위에 소품 합성: 소품의 원래 색을 보존합니다.
      if (toneEnabled) applyFaceTone(context, source, face, width, height);
      if (earsEnabled) drawEars(context, face, width, height);
      if (glassesEnabled) drawGlasses(context, face, width, height);
    }

    function paintPreview() {
      if (!videoActive()) return;
      const bounds = stage.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      if (width <= 0 || height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (overlay.width !== w || overlay.height !== h) {
        overlay.width = w;
        overlay.height = h;
      }
      const context = overlay.getContext('2d');
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      if (!latestFace) return;
      const imageW = video.videoWidth;
      const imageH = video.videoHeight;
      const cover = Math.max(width / imageW, height / imageH);
      const offsetX = (width - imageW * cover) / 2;
      const offsetY = (height - imageH * cover) / 2;
      context.save();
      context.translate(offsetX, offsetY);
      context.scale(cover, cover);
      drawSelected(context, latestFace, imageW, imageH, video);
      context.restore();
    }

    function trackingLoop(timestamp) {
      if (!anyEnabled() || !video.srcObject) {
        stopTracking();
        return;
      }
      if (videoActive() && timestamp - lastDetectionAt >= SETTINGS.detectionInterval) {
        lastDetectionAt = timestamp;
        try {
          latestFace = detectFace();
        } catch (error) {
          console.error('[고영희 AR] 얼굴 추적 오류:', error);
          latestFace = null;
          glassesEnabled = false;
          earsEnabled = false;
          toneEnabled = false;
          updateButtons();
          updateStatus('얼굴 추적 오류 · OFF 후 다시 시도');
          stopTracking();
          return;
        }
        updateStatus(latestFace ? '얼굴 추적 중' : '얼굴을 카메라 중앙에 맞춰 주세요');
        paintPreview(); // 색보정은 매 프레임 대신 약 13fps로 갱신
      }
      raf = requestAnimationFrame(trackingLoop);
    }

    function startTracking() {
      if (!anyEnabled() || !detector || !video.srcObject || raf !== null) return;
      raf = requestAnimationFrame(trackingLoop);
    }

    async function toggleFilter(which) {
      const current = which === 'glasses' ? glassesEnabled : which === 'ears' ? earsEnabled : toneEnabled;
      if (current) {
        if (which === 'glasses') glassesEnabled = false;
        else if (which === 'ears') earsEnabled = false;
        else toneEnabled = false;
        updateButtons();
        if (!anyEnabled()) {
          stopTracking();
          updateStatus('기본 촬영');
        } else {
          paintPreview();
        }
        return;
      }

      const selectedButton = which === 'glasses' ? glassesButton : which === 'ears' ? earsButton : toneButton;
      selectedButton.disabled = true;
      updateStatus('얼굴 추적 모델 불러오는 중…');
      try {
        if (which === 'ears') await earsGraphic.decode();
        if (which === 'glasses') await glassesGraphic.decode();
        await loadDetector();
        if (which === 'glasses') glassesEnabled = true;
        else if (which === 'ears') earsEnabled = true;
        else toneEnabled = true;
        updateButtons();
        updateStatus(videoActive() ? '얼굴 추적 중' : '준비 완료 · 촬영 시작을 눌러 주세요');
        startTracking();
        paintPreview();
      } catch (error) {
        console.error('[고영희 AR] 초기화 실패:', error);
        updateButtons();
        updateStatus(which === 'ears'
          ? '고양이 귀 이미지 또는 얼굴 추적 모듈 연결 실패'
          : which === 'glasses' ? '선글라스 이미지 또는 얼굴 추적 모듈 연결 실패'
            : '얼굴톤 보정 모델 연결 실패 · 인터넷 확인');
      } finally {
        selectedButton.disabled = false;
      }
    }

    glassesButton.addEventListener('click', () => toggleFilter('glasses'));
    earsButton.addEventListener('click', () => toggleFilter('ears'));
    toneButton.addEventListener('click', () => toggleFilter('tone'));

    const originalStartCamera = window.startCamera;
    const originalStopCamera = window.stopCamera;
    const originalCaptureShot = window.captureShot;

    // 기존 카메라 및 저장 흐름을 그대로 사용합니다.
    window.startCamera = async function (...args) {
      const stream = await originalStartCamera.apply(this, args);
      startTracking();
      return stream;
    };
    window.stopCamera = function (...args) {
      stopTracking();
      return originalStopCamera.apply(this, args);
    };
    window.captureShot = async function (...args) {
      const shot = await originalCaptureShot.apply(this, args);
      if (!anyEnabled() || !detector || !shot || typeof shot.getContext !== 'function') return shot;
      try {
        const freshFace = detectFace() || latestFace;
        if (freshFace) {
          const context = shot.getContext('2d');
          if (context) drawSelected(context, freshFace, shot.width, shot.height, shot);
        }
      } catch (error) {
        console.warn('[고영희 AR] AR 또는 보정 적용 실패: 기본 사진을 유지합니다.', error);
      }
      return shot;
    };

    window.addEventListener('pagehide', stopTracking);
    updateButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
