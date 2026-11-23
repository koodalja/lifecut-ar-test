/* 고영희씨 AR: 핑크 선글라스 + 고양이 귀 머리띠
 * 기존 app.js / camera.js / cat-intro.js / index.html은 수정하지 않습니다.
 * 기존 선글라스의 FaceLandmarker와 촬영 합성 로직을 두 소품이 공유합니다.
 * 준비 이미지: images/cat-pink-glasses.svg, images/cat-ears-headband.png
 */
(() => {
  'use strict';

  const MEDIAPIPE_VERSION = '1.2.3';
  const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

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

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'cat-glasses-ar.css';
    style.id = 'cat-glasses-ar-css';
    document.head.appendChild(style);

    const toolbar = document.createElement('div');
    toolbar.className = 'cat-ar-toolbar';
    toolbar.innerHTML = `
      <button type="button" id="cat-ar-toggle" class="cat-ar-toggle" aria-pressed="false">😎 고영희씨 안경 OFF</button>
      <button type="button" id="cat-ears-toggle" class="cat-ar-toggle" aria-pressed="false">🐱 고양이 귀 OFF</button>
      <span id="cat-ar-status" class="cat-ar-status" role="status" aria-live="polite">기본 촬영</span>`;
    progress.insertAdjacentElement('afterend', toolbar);

    const glassesButton = toolbar.querySelector('#cat-ar-toggle');
    const earsButton = toolbar.querySelector('#cat-ears-toggle');
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
    earsGraphic.src = 'images/cat-ears-headband.png';

    let glassesEnabled = false;
    let earsEnabled = false;
    let detector = null;
    let loadPromise = null;
    let raf = null;
    let lastDetectionAt = -Infinity;
    let latestFace = null;
    let lastTimestamp = 0;

    const anyEnabled = () => glassesEnabled || earsEnabled;

    function updateStatus(message) {
      status.textContent = message;
    }

    function updateButtons() {
      glassesButton.setAttribute('aria-pressed', String(glassesEnabled));
      glassesButton.textContent = glassesEnabled ? '😎 고영희씨 안경 ON' : '😎 고영희씨 안경 OFF';
      earsButton.setAttribute('aria-pressed', String(earsEnabled));
      earsButton.textContent = earsEnabled ? '🐱 고양이 귀 ON' : '🐱 고양이 귀 OFF';
    }

    async function loadDetector() {
      if (detector) return detector;
      if (!loadPromise) {
        loadPromise = (async () => {
          const mediapipe = await import(`${CDN}/vision_bundle.mjs`);
          const { FilesetResolver, FaceLandmarker } = mediapipe;
          if (!FilesetResolver || !FaceLandmarker) {
            throw new Error('얼굴 추적 모듈을 불러오지 못했어요.');
          }
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
            console.warn('[고영희 AR] GPU를 사용할 수 없어 CPU로 다시 시도합니다.', gpuError);
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

    // 안경 중심·회전은 유지하고 크기만 약 30% 키웁니다.
    function drawGlasses(context, face, imageWidth, imageHeight) {
      if (!face || !glassesGraphic.complete || glassesGraphic.naturalWidth === 0) return false;
      const left = face[33];
      const right = face[263];
      if (!left || !right) return false;
      const dx = (right.x - left.x) * imageWidth;
      const dy = (right.y - left.y) * imageHeight;
      const eyeSpan = Math.hypot(dx, dy);
      if (!Number.isFinite(eyeSpan) || eyeSpan < 12) return false;
      const middleX = ((left.x + right.x) / 2) * imageWidth;
      const middleY = ((left.y + right.y) / 2) * imageHeight;
      const angle = Math.atan2(dy, dx);
      const glassesWidth = eyeSpan * 2.15; // 기존 대비 약 30% 확대
      const glassesHeight = glassesWidth * (180 / 440);
      context.save();
      context.translate(middleX, middleY);
      context.rotate(angle);
      context.drawImage(glassesGraphic, -glassesWidth / 2, -glassesHeight * 0.50, glassesWidth, glassesHeight);
      context.restore();
      return true;
    }

    // 이마 중심(10)과 양옆 얼굴 윤곽(234,454)에 맞춰 머리띠를 올립니다.
    // 귀가 너무 높거나 낮을 경우 EARS_HEIGHT_OFFSET 값만 미세 조정하면 됩니다.
    function drawEars(context, face, imageWidth, imageHeight) {
      if (!face || !earsGraphic.complete || earsGraphic.naturalWidth === 0) return false;
      const forehead = face[10];
      const faceLeft = face[234];
      const faceRight = face[454];
      const eyeLeft = face[33];
      const eyeRight = face[263];
      if (!forehead || !faceLeft || !faceRight || !eyeLeft || !eyeRight) return false;

      const faceDx = (faceRight.x - faceLeft.x) * imageWidth;
      const faceDy = (faceRight.y - faceLeft.y) * imageHeight;
      const faceWidth = Math.hypot(faceDx, faceDy);
      if (!Number.isFinite(faceWidth) || faceWidth < 25) return false;

      const eyeDx = (eyeRight.x - eyeLeft.x) * imageWidth;
      const eyeDy = (eyeRight.y - eyeLeft.y) * imageHeight;
      const angle = Math.atan2(eyeDy, eyeDx);
      const drawWidth = faceWidth * 1.60; // 기존 대비 약 30% 확대
      const drawHeight = drawWidth * (earsGraphic.naturalHeight / earsGraphic.naturalWidth);
      const EARS_HEIGHT_OFFSET = 0.55;

      context.save();
      context.translate(forehead.x * imageWidth, forehead.y * imageHeight);
      context.rotate(angle);
      context.drawImage(earsGraphic, -drawWidth / 2, -drawHeight * EARS_HEIGHT_OFFSET, drawWidth, drawHeight);
      context.restore();
      return true;
    }

    function drawSelected(context, face, imageWidth, imageHeight) {
      // 먼저 머리띠, 그 위에 안경을 그려 두 소품 동시 선택 시 겹침을 줄입니다.
      if (earsEnabled) drawEars(context, face, imageWidth, imageHeight);
      if (glassesEnabled) drawGlasses(context, face, imageWidth, imageHeight);
    }

    function paintPreview() {
      if (!videoActive()) return;
      const bounds = stage.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      if (width <= 0 || height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scaledW = Math.round(width * dpr);
      const scaledH = Math.round(height * dpr);
      if (overlay.width !== scaledW || overlay.height !== scaledH) {
        overlay.width = scaledW;
        overlay.height = scaledH;
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
      drawSelected(context, latestFace, imageW, imageH);
      context.restore();
    }

    function trackingLoop(timestamp) {
      if (!anyEnabled() || !video.srcObject) {
        stopTracking();
        return;
      }
      if (videoActive() && timestamp - lastDetectionAt >= 70) {
        lastDetectionAt = timestamp;
        try {
          latestFace = detectFace();
        } catch (error) {
          console.error('[고영희 AR] 얼굴 추적 오류:', error);
          latestFace = null;
          updateStatus('얼굴 추적 오류 · OFF 후 다시 시도');
          glassesEnabled = false;
          earsEnabled = false;
          updateButtons();
          stopTracking();
          return;
        }
        updateStatus(latestFace ? '얼굴 추적 중' : '얼굴을 카메라 중앙에 맞춰 주세요');
      }
      paintPreview();
      raf = requestAnimationFrame(trackingLoop);
    }

    function startTracking() {
      if (!anyEnabled() || !detector || !video.srcObject || raf !== null) return;
      raf = requestAnimationFrame(trackingLoop);
    }

    // ON/OFF 두 버튼은 같은 얼굴 추적 모델을 공유합니다.
    async function toggleFilter(which) {
      const current = which === 'glasses' ? glassesEnabled : earsEnabled;
      if (current) {
        if (which === 'glasses') glassesEnabled = false;
        else earsEnabled = false;
        updateButtons();
        if (!anyEnabled()) {
          stopTracking();
          updateStatus('기본 촬영');
        } else {
          paintPreview();
        }
        return;
      }

      const currentButton = which === 'glasses' ? glassesButton : earsButton;
      currentButton.disabled = true;
      updateStatus('얼굴 추적 모델 불러오는 중…');
      try {
        if (which === 'ears') {
          // 머리띠 이미지가 없으면 ON 상태로 전환하지 않습니다.
          await earsGraphic.decode();
        }
        await loadDetector();
        if (which === 'glasses') glassesEnabled = true;
        else earsEnabled = true;
        updateButtons();
        updateStatus(videoActive() ? '얼굴 추적 중' : 'AR 준비 완료 · 촬영 시작을 눌러 주세요');
        startTracking();
      } catch (error) {
        console.error('[고영희 AR] 초기화 실패:', error);
        updateButtons();
        updateStatus(which === 'ears' ? '고양이 귀 이미지 또는 추적 모듈 연결 실패' : '연결 실패 · 인터넷 확인 후 다시 눌러 주세요');
      } finally {
        currentButton.disabled = false;
      }
    }

    glassesButton.addEventListener('click', () => toggleFilter('glasses'));
    earsButton.addEventListener('click', () => toggleFilter('ears'));

    const originalStartCamera = window.startCamera;
    const originalStopCamera = window.stopCamera;
    const originalCaptureShot = window.captureShot;

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
      if (!anyEnabled() || !detector) return shot;
      try {
        const freshFace = detectFace();
        if (freshFace) {
          const context = shot.getContext('2d');
          if (context) drawSelected(context, freshFace, shot.width, shot.height);
        }
      } catch (error) {
        console.warn('[고영희 AR] 이 컷은 기본 사진으로 저장됩니다.', error);
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
