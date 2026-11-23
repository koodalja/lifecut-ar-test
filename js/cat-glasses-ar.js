/* 고영희씨 AR: 8개 얼굴 필터와 별도 뽀샤시 보정
 * 기존 FaceLandmarker 1개로 카메라 미리보기와 저장 사진에 같은 효과를 적용합니다.
 * 주의: 이 버전은 얼굴 영역의 밝기/대비/채도를 부드럽게 조절하며
 *       피부 질감 리터칭이나 얼굴형 변경 기능은 아닙니다.
 */
(() => {
  'use strict';

  const MEDIAPIPE_VERSION = '1.2.3'; // 기존 프로젝트에서 작동한 버전 유지
  const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  const SETTINGS = Object.freeze({
    earsScale: 1.38,      // 얼굴 윤곽 너비에 대한 '귀 두 개 전체' 폭
    earsBaseDrop: 0.08,  // 귀 밑변 위치: 이마 지점에서 얼굴 폭의 8% 아래
    toneBrightness: 1.06,
    toneContrast: 1.03,
    toneSaturation: 1.04,
    faceFeatherRatio: 0.035, // 얼굴 마스크 경계 부드럽게
    detectionInterval: 75   // 약 13fps로 얼굴 추적
  });

  const AR_FILTERS = [
    { key: 'heartPop', label: '고영희씨 하트뿅', asset: 'images/filters/heart-pop.png' },
    { key: 'catEars', label: '고영희씨 팔랑귀', asset: 'images/filters/cat-ears.png' },
    { key: 'whiskers', label: '고영희씨 냥수염', asset: 'images/filters/cat-whiskers.png' },
    { key: 'blush', label: '고영희씨 발그레', asset: 'images/filters/pink-blush.png' },
    { key: 'nose', label: '고영희씨 코찡긋', asset: 'images/filters/cat-nose.png' },
    { key: 'sparkle', label: '고영희씨 별난냥', asset: 'images/filters/sparkle.png' },
    { key: 'bubblegum', label: '고영희씨 껌씹냥', asset: 'images/filters/bubblegum.png' },
    { key: 'party', label: '고영희씨 흥폭발', asset: 'images/filters/party-headphones.png' }
  ];

  // MediaPipe 얼굴 윤곽선: 이마 -> 오른쪽 턱 -> 턱끝 -> 왼쪽 턱 -> 이마
  const FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
  ];

  // 촬영 화면에 AR 필터 도구를 만들고 기존 카메라 흐름에 연결합니다.
  function init() {
    const screen = document.getElementById('capture-screen');
    const stage = document.getElementById('camera-stage');
    const video = document.getElementById('camera-video');
    const progress = document.getElementById('capture-progress');
    if (!screen || !stage || !video || !progress || document.getElementById('cat-ar-toolbar')) return;

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
    toolbar.id = 'cat-ar-toolbar';
    toolbar.className = 'cat-ar-toolbar';
    const filterButtons = Object.create(null);
    const filterGraphics = Object.create(null);
    AR_FILTERS.forEach(filter => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'cat-filter-' + filter.key + '-toggle';
      button.className = 'cat-ar-toggle cat-filter-toggle';
      button.dataset.filter = filter.key;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', filter.label + ' OFF');

      const thumbnail = document.createElement('img');
      thumbnail.className = 'cat-ar-thumb';
      thumbnail.src = filter.asset;
      thumbnail.alt = '';
      thumbnail.setAttribute('aria-hidden', 'true');
      thumbnail.decoding = 'async';

      const label = document.createElement('span');
      label.className = 'cat-ar-label';
      label.textContent = filter.label + ' OFF';
      button.append(thumbnail, label);
      toolbar.appendChild(button);
      filterButtons[filter.key] = button;
      filterGraphics[filter.key] = thumbnail;
    });

    const toneButton = document.createElement('button');
    toneButton.type = 'button';
    toneButton.id = 'cat-tone-toggle';
    toneButton.className = 'cat-ar-toggle cat-tone-toggle';
    toneButton.setAttribute('aria-pressed', 'false');
    toneButton.setAttribute('aria-label', '고영희씨 뽀샤시 OFF');
    toneButton.textContent = '고영희씨 뽀샤시 OFF';

    const status = document.createElement('span');
    status.id = 'cat-ar-status';
    status.className = 'cat-ar-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = '기본 촬영';
    toolbar.append(toneButton, status);
    progress.insertAdjacentElement('afterend', toolbar);

    const overlay = document.createElement('canvas');
    overlay.id = 'cat-ar-overlay';
    overlay.className = 'cat-ar-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    stage.appendChild(overlay);

    const enabledFilters = Object.create(null);
    AR_FILTERS.forEach(filter => {
      enabledFilters[filter.key] = false;
    });
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

    // 추적을 계속할 AR 효과나 보정이 하나라도 켜져 있는지 확인합니다.
    const anyEnabled = () => toneEnabled
      || AR_FILTERS.some(filter => enabledFilters[filter.key]);

    // 얼굴 추적 상태를 화면 안내에 표시합니다.
    function updateStatus(message) {
      status.textContent = message;
    }

    // AR 필터와 뽀샤시 버튼의 접근성 상태와 ON/OFF 문구를 맞춥니다.
    function updateButtons() {
      AR_FILTERS.forEach(filter => {
        const isEnabled = enabledFilters[filter.key];
        const label = filter.label + (isEnabled ? ' ON' : ' OFF');
        filterButtons[filter.key].setAttribute('aria-pressed', String(isEnabled));
        filterButtons[filter.key].setAttribute('aria-label', label);
        filterButtons[filter.key].querySelector('.cat-ar-label').textContent = label;
      });
      toneButton.setAttribute('aria-pressed', String(toneEnabled));
      toneButton.setAttribute('aria-label', '고영희씨 뽀샤시 ' + (toneEnabled ? 'ON' : 'OFF'));
      toneButton.textContent = '고영희씨 뽀샤시 ' + (toneEnabled ? 'ON' : 'OFF');
    }

    // 첫 필터 사용 때만 MediaPipe 얼굴 추적 모델을 불러옵니다.
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

    // 미리보기 위에 그린 AR 장식을 지웁니다.
    function clearOverlay() {
      const context = overlay.getContext('2d');
      if (context) context.clearRect(0, 0, overlay.width, overlay.height);
    }

    // 예약된 얼굴 추적을 멈추고 미리보기 장식을 정리합니다.
    function stopTracking() {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      latestFace = null;
      lastDetectionAt = -Infinity;
      clearOverlay();
    }

    // 카메라 영상이 실제 프레임을 내보내고 있는지 확인합니다.
    function videoActive() {
      return Boolean(video.srcObject && video.videoWidth && video.videoHeight && video.readyState >= 2);
    }

    // 현재 카메라 프레임에서 얼굴 특징점을 추적합니다.
    function detectFace() {
      if (!detector || !videoActive()) return null;
      const now = performance.now();
      lastTimestamp = Math.max(now, lastTimestamp + 1);
      const results = detector.detectForVideo(video, lastTimestamp);
      return results?.faceLandmarks?.[0] ?? null;
    }

    // 얼굴 특징점에서 얼굴 폭·눈 기울기·코와 입 위치를 한 번 계산합니다.
    function getFaceMetrics(face, width, height) {
      if (!face) return null;
      const forehead = face[10], chin = face[152];
      const leftSide = face[234], rightSide = face[454];
      const leftEye = face[33], rightEye = face[263];
      const nose = face[1], mouthLeft = face[61], mouthRight = face[291];
      if (!forehead || !chin || !leftSide || !rightSide
          || !leftEye || !rightEye || !nose || !mouthLeft || !mouthRight) return null;

      const leftX = leftSide.x * width, leftY = leftSide.y * height;
      const rightX = rightSide.x * width, rightY = rightSide.y * height;
      const eyeLeftX = leftEye.x * width, eyeLeftY = leftEye.y * height;
      const eyeRightX = rightEye.x * width, eyeRightY = rightEye.y * height;
      const faceWidth = Math.hypot(rightX - leftX, rightY - leftY);
      if (!Number.isFinite(faceWidth) || faceWidth < 25) return null;

      return {
        faceWidth: faceWidth,
        centerX: (leftX + rightX) / 2,
        foreheadX: forehead.x * width,
        foreheadY: forehead.y * height,
        chinY: chin.y * height,
        eyeCenterX: (eyeLeftX + eyeRightX) / 2,
        eyeCenterY: (eyeLeftY + eyeRightY) / 2,
        eyeSpan: Math.hypot(eyeRightX - eyeLeftX, eyeRightY - eyeLeftY),
        noseX: nose.x * width,
        noseY: nose.y * height,
        mouthX: ((mouthLeft.x + mouthRight.x) / 2) * width,
        mouthY: ((mouthLeft.y + mouthRight.y) / 2) * height,
        roll: Math.atan2(eyeRightY - eyeLeftY, eyeRightX - eyeLeftX)
      };
    }

    // 투명 PNG를 얼굴 기준점에 회전·배치해 미리보기와 사진에 같이 그립니다.
    function drawFaceGraphic(context, graphic, x, y, drawWidth, roll, scale) {
      if (!graphic || !graphic.complete || !graphic.naturalWidth || drawWidth <= 0) return false;
      const size = drawWidth * (scale || 1);
      const drawHeight = size * graphic.naturalHeight / graphic.naturalWidth;
      context.save();
      context.translate(x, y);
      context.rotate(roll);
      context.drawImage(graphic, -size / 2, -drawHeight / 2, size, drawHeight);
      context.restore();
      return true;
    }

    // 하트 선글라스를 눈 사이 간격에 맞춰 놓습니다.
    function drawHeartPop(context, face, width, height) {
      const metrics = getFaceMetrics(face, width, height);
      if (!metrics || metrics.eyeSpan < 12) return false;
      return drawFaceGraphic(
        context, filterGraphics.heartPop, metrics.eyeCenterX, metrics.eyeCenterY,
        metrics.eyeSpan * 2.15, metrics.roll
      );
    }

    // 귀 PNG의 밑변이 이마 바로 위에 닿도록 배치합니다.
    function drawEars(context, face, width, height) {
      const metrics = getFaceMetrics(face, width, height);
      if (!metrics) return false;
      const graphic = filterGraphics.catEars;
      const drawWidth = metrics.faceWidth * SETTINGS.earsScale;
      const drawHeight = graphic.naturalWidth
        ? drawWidth * graphic.naturalHeight / graphic.naturalWidth
        : 0;
      const centerY = metrics.foreheadY + metrics.faceWidth * SETTINGS.earsBaseDrop - drawHeight / 2;
      return drawFaceGraphic(
        context, graphic, metrics.foreheadX, centerY, drawWidth, metrics.roll
      );
    }

    // 수염 스티커를 코와 입 중심에 맞춥니다.
    function drawWhiskers(context, face, width, height) {
      const metrics = getFaceMetrics(face, width, height);
      if (!metrics) return false;
      return drawFaceGraphic(
        context, filterGraphics.whiskers, metrics.noseX,
        metrics.noseY + metrics.faceWidth * 0.16,
        metrics.faceWidth * 1.28, metrics.roll
      );
    }

    // 양쪽 볼터치를 얼굴 폭에 맞춰 배치합니다.
    function drawBlush(context, face, width, height) {
      const metrics = getFaceMetrics(face, width, height);
      if (!metrics) return false;
      return drawFaceGraphic(
        context, filterGraphics.blush, metrics.centerX,
        metrics.mouthY - metrics.faceWidth * 0.08,
        metrics.faceWidth * 1.18, metrics.roll
      );
    }

    // 코와 입술 스티커를 코끝과 입 사이에 정렬합니다.
    function drawNose(context, face, width, height) {
      const metrics = getFaceMetrics(face, width, height);
      if (!metrics) return false;
      return drawFaceGraphic(
        context, filterGraphics.nose, metrics.noseX,
        metrics.noseY + metrics.faceWidth * 0.12,
        metrics.faceWidth * 0.86, metrics.roll
      );
    }

    // 별 장식 PNG를 양 볼 높이에 맞춰 그립니다.
    function drawSparkle(context, face, width, height) {
      const metrics = getFaceMetrics(face, width, height);
      if (!metrics) return false;
      return drawFaceGraphic(
        context, filterGraphics.sparkle, metrics.centerX,
        metrics.mouthY - metrics.faceWidth * 0.13,
        metrics.faceWidth * 1.22, metrics.roll
      );
    }

    // 풍선껌을 입에 맞춰 놓고 실시간 미리보기에서 숨 쉬듯 움직입니다.
    function drawBubblegum(context, face, width, height, timestamp) {
      const metrics = getFaceMetrics(face, width, height);
      if (!metrics) return false;
      const pulse = 1 + Math.sin(timestamp / 180) * 0.055;
      const bounce = Math.sin(timestamp / 240) * metrics.faceWidth * 0.012;
      return drawFaceGraphic(
        context, filterGraphics.bubblegum, metrics.mouthX,
        metrics.noseY + metrics.faceWidth * 0.19 + bounce,
        metrics.faceWidth * 0.84, metrics.roll, pulse
      );
    }

    // 핑크·하늘색·노랑 조명을 얼굴 주변에 부드럽게 비춥니다.
    function drawPartyLights(context, metrics, timestamp) {
      const pulse = 0.24 + (Math.sin(timestamp / 260) + 1) * 0.07;
      const radius = metrics.faceWidth * 0.42;
      const lights = [
        { x: metrics.centerX - metrics.faceWidth * 0.34, y: metrics.foreheadY + metrics.faceWidth * 0.20, color: '255, 55, 153' },
        { x: metrics.centerX + metrics.faceWidth * 0.34, y: metrics.foreheadY + metrics.faceWidth * 0.37, color: '48, 203, 255' },
        { x: metrics.centerX, y: metrics.chinY - metrics.faceWidth * 0.02, color: '255, 220, 55' }
      ];

      context.save();
      context.globalCompositeOperation = 'screen';
      lights.forEach(light => {
        const gradient = context.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius);
        gradient.addColorStop(0, 'rgba(' + light.color + ', ' + pulse + ')');
        gradient.addColorStop(1, 'rgba(' + light.color + ', 0)');
        context.fillStyle = gradient;
        context.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);
      });
      context.restore();
    }

    // 헤드폰 PNG를 머리와 귀 전체 폭에 맞춰 회전해 배치합니다.
    function drawPartyHeadphones(context, face, width, height, timestamp) {
      const metrics = getFaceMetrics(face, width, height);
      if (!metrics) return false;
      drawPartyLights(context, metrics, timestamp);
      return drawFaceGraphic(
        context, filterGraphics.party, metrics.centerX,
        (metrics.foreheadY + metrics.chinY) / 2,
        metrics.faceWidth * 1.9, metrics.roll
      );
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

    // 선택된 효과를 같은 순서와 좌표로 카메라 미리보기와 저장 사진에 적용합니다.
    function drawSelected(context, face, width, height, source, timestamp) {
      const animationTime = Number.isFinite(timestamp) ? timestamp : performance.now();
      if (toneEnabled) applyFaceTone(context, source, face, width, height);
      if (enabledFilters.blush) drawBlush(context, face, width, height);
      if (enabledFilters.sparkle) drawSparkle(context, face, width, height);
      if (enabledFilters.whiskers) drawWhiskers(context, face, width, height);
      if (enabledFilters.nose) drawNose(context, face, width, height);
      if (enabledFilters.heartPop) drawHeartPop(context, face, width, height);
      if (enabledFilters.catEars) drawEars(context, face, width, height);
      if (enabledFilters.bubblegum) {
        drawBubblegum(context, face, width, height, animationTime);
      }
      if (enabledFilters.party) {
        drawPartyHeadphones(context, face, width, height, animationTime);
      }
    }

    // 추적한 얼굴 위치에 맞춰 미리보기 AR 장식을 다시 그립니다.
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
      drawSelected(context, latestFace, imageW, imageH, video, performance.now());
      context.restore();
    }

    // 일정한 간격으로 얼굴을 추적하고 화면 효과를 갱신합니다.
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
          AR_FILTERS.forEach(filter => {
            enabledFilters[filter.key] = false;
          });
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

    // 카메라와 모델이 준비됐을 때 얼굴 추적 반복을 시작합니다.
    function startTracking() {
      if (!anyEnabled() || !detector || !video.srcObject || raf !== null) return;
      raf = requestAnimationFrame(trackingLoop);
    }

    // 선택한 AR 스티커나 뽀샤시 보정을 켜거나 끕니다.
    async function toggleFilter(which) {
      const isTone = which === 'tone';
      const current = isTone ? toneEnabled : enabledFilters[which];
      if (current) {
        if (isTone) toneEnabled = false;
        else enabledFilters[which] = false;
        updateButtons();
        if (!anyEnabled()) {
          stopTracking();
          updateStatus('기본 촬영');
        } else {
          paintPreview();
        }
        return;
      }

      const selectedButton = isTone ? toneButton : filterButtons[which];
      selectedButton.disabled = true;
      updateStatus('얼굴 추적 모델 불러오는 중…');
      try {
        if (!isTone) await filterGraphics[which].decode();
        await loadDetector();
        if (isTone) toneEnabled = true;
        else enabledFilters[which] = true;
        updateButtons();
        updateStatus(videoActive() ? '얼굴 추적 중' : '준비 완료 · 촬영 시작을 눌러 주세요');
        startTracking();
        paintPreview();
      } catch (error) {
        console.error('[고영희 AR] 초기화 실패:', error);
        updateButtons();
        const filter = AR_FILTERS.find(item => item.key === which);
        updateStatus((filter ? filter.label : '고영희씨 뽀샤시')
          + ' 준비 실패 · 이미지와 인터넷 연결을 확인해 주세요');
      } finally {
        selectedButton.disabled = false;
      }
    }

    AR_FILTERS.forEach(filter => {
      filterButtons[filter.key].addEventListener('click', () => toggleFilter(filter.key));
    });
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
          if (context) {
            drawSelected(context, freshFace, shot.width, shot.height, shot, performance.now());
          }
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
