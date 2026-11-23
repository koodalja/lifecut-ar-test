"use strict";

var supabaseClient = null;

/**
 * 설정이 준비된 경우에만 Supabase 연결을 만들고 첫 연결을 재사용합니다.
 * @returns {object} 사진 업로드에 사용할 Supabase 연결
 */
function getClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (
    typeof SUPABASE_URL !== "string"
    || typeof SUPABASE_KEY !== "string"
    || !SUPABASE_URL.trim()
    || !SUPABASE_KEY.trim()
    || SUPABASE_URL === "여기에-내-프로젝트주소"
    || SUPABASE_KEY === "여기에-내-키"
  ) {
    throw new Error("js/config.js 에 내 Supabase 주소와 키를 먼저 넣어 주세요");
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase 연결 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return supabaseClient;
}

/**
 * 날짜·시간과 무작위 문자 6개가 든 사진 파일 이름을 만듭니다.
 * @returns {string} JPG 업로드 파일 이름
 */
function makePhotoFileName() {
  var now = new Date();
  var dateText = String(now.getFullYear())
    + String(now.getMonth() + 1).padStart(2, "0")
    + String(now.getDate()).padStart(2, "0");
  var timeText = String(now.getHours()).padStart(2, "0")
    + String(now.getMinutes()).padStart(2, "0")
    + String(now.getSeconds()).padStart(2, "0");
  var randomText = Math.random().toString(36).slice(2, 8).padEnd(6, "0");

  return dateText + timeText + "-" + randomText + ".jpg";
}

/**
 * 완성 사진을 JPG로 만들어 photos 버킷에 올리고 공개 주소를 돌려줍니다.
 * @param {HTMLCanvasElement} canvas 업로드할 완성 사진 캔버스
 * @returns {Promise<string>} 업로드된 사진의 공개 주소
 */
async function uploadPhoto(canvas) {
  var client = getClient();
  var blob = await new Promise(function (resolve) {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });

  if (!blob) {
    throw new Error("사진 파일을 만들지 못했어요. 다시 시도해 주세요.");
  }

  var fileName = makePhotoFileName();
  var result = await client.storage
    .from(PHOTO_BUCKET)
    .upload(fileName, blob, {
      contentType: "image/jpeg",
      upsert: false
    });

  if (result.error) {
    throw result.error;
  }

  var publicUrlResult = client.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(result.data.path);

  if (!publicUrlResult.data || !publicUrlResult.data.publicUrl) {
    throw new Error("사진 공개 주소를 만들지 못했어요.");
  }

  return publicUrlResult.data.publicUrl;
}

/**
 * 지정한 화면 요소를 비우고 사진 주소의 200×200 QR 코드를 그립니다.
 * @param {HTMLElement} element QR 코드를 표시할 요소
 * @param {string} url QR 코드에 담을 공개 사진 주소
 * @returns {void} QR 코드를 화면에 표시합니다.
 */
function drawQrCode(element, url) {
  element.replaceChildren();
  new QRCode(element, {
    text: url,
    width: 200,
    height: 200
  });
}
