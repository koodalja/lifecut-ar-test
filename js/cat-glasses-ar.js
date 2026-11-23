/* 고영희씨 AR 1차 실험: 핑크 선글라스 1종만 추가
 * 기존 app.js / camera.js / cat-intro.js 파일은 수정하지 않습니다.
 * MediaPipe 얼굴 특징점 계산은 브라우저에서 수행됩니다.
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
      <span id="cat-ar-status" class="cat-ar-status" role="status" aria-live="polite">기본 촬영</span>`;
    progress.insertAdjacentElement('afterend', toolbar);

    const button = toolbar.querySelector('#cat-ar-toggle');
    const status = toolbar.querySelector('#cat-ar-status');
    const overlay = document.createElement('canvas');
    overlay.id = 'cat-ar-overlay';
    overlay.className = 'cat-ar-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    stage.appendChild(overlay);

    const graphic = new Image();
    graphic.decoding = 'async';
    graphic.src = 'images/cat-pink-glasses.svg';

    let enabled = false;
    let detector = null;
    let loadPromise = null;
    let raf = null;
    let lastDetectionAt = -Infinity;
    let latestFace = null;
    let lastTimestamp = 0;

    function updateStatus(message) {
      status.textContent = message;
    }

    function updateButton() {
      button.setAttribute('aria-pressed', String(enabled));
      button.textContent = enabled ? '😎 고영희씨 안경 ON' : '😎 고영희씨 안경 OFF';
    }

    async function loadDetector() {
      if (detector) return detector;
      if (!loadPromise) {
        loadPromise = (async () => {
          // 모델은 사용자가 ON을 누른 뒤에만 다운로드합니다.
          const mediapipe = await import(`${CDN}/vision_bundle.mjs`);
          const { FilesetResolver, FaceLandmarker } = mediapipe;
          if (!FilesetResolver || !FaceLandmarker) {
            throw new Error('얼굴 추적 모듈을 불러오지 못했어요.');
          }
          const fileset = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
          const options = {
            baseOptions: {modelAssetPath: MODEL, delegate: 'GPU'},
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
        })().then((value) => {
          detector = value;
          return value;
        }).catch((error) => {
          loadPromise = null; // 실패 시 다시 시도할 수 있게 합니다.
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

    // 안경을 눈 바깥쪽 특징점(33, 263)의 중간에 배치합니다.
    function drawGlasses(context, face, imageWidth, imageHeight) {
      if (!face || !graphic.complete || graphic.naturalWidth === 0) return false;
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
      const glassesWidth = eyeSpan * 1.65;
      const glassesHeight = glassesWidth * (180 / 440);
      context.save();
      context.translate(middleX, middleY);
      context.rotate(angle);
      context.drawImage(graphic, -glassesWidth / 2, -glassesHeight * 0.50, glassesWidth, glassesHeight);
      context.restore();
      return true;
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
      drawGlasses(context, latestFace, imageW, imageH);
      context.restore();
    }

    function trackingLoop(timestamp) {
      if (!enabled || !video.srcObject) {
        stopTracking();
        return;
      }
      if (videoActive() && timestamp - lastDetectionAt >= 70) {
        lastDetectionAt = timestamp; // 과도한 계산 방지를 위해 약 14fps로 추적
        try {
          latestFace = detectFace();
        } catch (error) {
          console.error('[고영희 AR] 얼굴 추적 오류:', error);
          latestFace = null;
          updateStatus('얼굴 추적 오류 · OFF 후 다시 시도');
          enabled = false;
          updateButton();
          stopTracking();
          return;
        }
        updateStatus(latestFace ? '얼굴 추적 중' : '얼굴을 카메라 중앙에 맞춰 주세요');
      }
      paintPreview();
      raf = requestAnimationFrame(trackingLoop);
    }

    function startTracking() {
      if (!enabled || !detector || !video.srcObject || raf !== null) return;
      raf = requestAnimationFrame(trackingLoop);
    }

    button.addEventListener('click', async () => {
      if (button.disabled) return;
      if (enabled) {
        enabled = false;
        stopTracking();
        updateButton();
        updateStatus('기본 촬영');
        return;
      }
      button.disabled = true;
      updateStatus('얼굴 추적 모델 불러오는 중…');
      try {
        await loadDetector();
        enabled = true;
        updateButton();
        updateStatus('안경 준비 완료 · 촬영 시작을 눌러 주세요');
        startTracking();
      } catch (error) {
        enabled = false;
        console.error('[고영희 AR] 초기화 실패:', error);
        updateButton();
        updateStatus('연결 실패 · 인터넷 확인 후 다시 눌러 주세요');
      } finally {
        button.disabled = false;
      }
    });

    const originalStartCamera = window.startCamera;
    const originalStopCamera = window.stopCamera;
    const originalCaptureShot = window.captureShot;

    // 기존 카메라 동작은 유지하고 AR 추적만 덧붙입니다.
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
      // 기존 촬영 로직과 사진 크기를 변경하지 않습니다.
      const shot = await originalCaptureShot.apply(this, args);
      if (!enabled || !detector) return shot;
      try {
        const freshFace = detectFace();
        if (freshFace) {
          const context = shot.getContext('2d');
          if (context) drawGlasses(context, freshFace, shot.width, shot.height);
        }
      } catch (error) {
        console.warn('[고영희 AR] 이 컷은 기본 사진으로 저장됩니다.', error);
      }
      return shot;
    };

    window.addEventListener('pagehide', stopTracking);
    updateButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once: true});
  } else {
    init();
  }
})();
