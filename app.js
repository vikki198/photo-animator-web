// Элементы интерфейса
const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startAnimationBtn");
const stopBtn = document.getElementById("stopAnimationBtn");
const clearMaskBtn = document.getElementById("clearMaskBtn");

const saveVideoBtn = document.getElementById("saveVideoBtn");
const saveGifBtn = document.getElementById("saveGifBtn");

// НОВОЕ: выбор длительности
const recordDurationSelect = document.getElementById("recordDuration");

// Элементы управления кистью
const brushSizeInput = document.getElementById("brushSize");
const brushSizeValue = document.getElementById("brushSizeValue");

// Кнопки режимов “кисть / ластик”
const brushModeBtn = document.getElementById("brushModeBtn");
const eraserModeBtn = document.getElementById("eraserModeBtn");

// === Глобальное состояние ===

let currentImage = null;
let animationId = null;
let startTime = null;

// Скрытый canvas для маски
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");

// Скрытый canvas для анимированной части
const animCanvas = document.createElement("canvas");
const animCtx = animCanvas.getContext("2d");

// Состояние рисования
let isPainting = false;
let brushRadius = 30;
let currentTool = "brush";

// ===== НОВОЕ: длительность записи (секунды) =====
let recordDurationSec = Number(recordDurationSelect.value);

// Чтобы не запускать 2 записи параллельно
let isRecordingVideo = false;
let isRecordingGif = false;

/**
 * Получаем координаты мыши в системе координат canvas
 */
function getCanvasPos(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  return { x, y };
}

// ===== Загрузка изображения =====

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    const img = new Image();

    img.onload = () => {
      const maxWidth = 800;
      const scale = Math.min(maxWidth / img.width, 1);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      // Подгоняем размеры скрытых canvas
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      animCanvas.width = canvas.width;
      animCanvas.height = canvas.height;

      // Очищаем маску
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

      currentImage = img;

      drawStaticImage(true);

      // Включаем UI
      startBtn.disabled = false;
      stopBtn.disabled = false;
      clearMaskBtn.disabled = false;
      saveVideoBtn.disabled = false;
      saveGifBtn.disabled = false;
      recordDurationSelect.disabled = false; // НОВОЕ
      brushSizeInput.disabled = false;
      brushModeBtn.disabled = false;
      eraserModeBtn.disabled = false;

      brushSizeInput.value = brushRadius;
      brushSizeValue.textContent = brushRadius;

      currentTool = "brush";
      brushModeBtn.classList.add("active");
      eraserModeBtn.classList.remove("active");
    };

    img.src = reader.result;
  };

  reader.readAsDataURL(file);
});

// ===== Отрисовка статичной картинки (с маской поверх) =====

function drawStaticImage(withMaskOverlay = false) {
  if (!currentImage) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

  if (withMaskOverlay) {
    ctx.save();
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.restore();
  }
}

// ===== Анимация =====

function startAnimation() {
  if (!currentImage) return;
  if (animationId !== null) return;

  startTime = performance.now();
  animationId = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  drawStaticImage(true);
}

function animate(timestamp) {
  animationId = requestAnimationFrame(animate);
  if (!currentImage || startTime === null) return;

  const elapsed = (timestamp - startTime) / 1000;

  const amplitude = 0.03;
  const speed = 1.0;
  const zoom = 1 + Math.sin(elapsed * speed) * amplitude;

  const drawWidth = canvas.width * zoom;
  const drawHeight = canvas.height * zoom;
  const dx = (canvas.width - drawWidth) / 2;
  const dy = (canvas.height - drawHeight) / 2;

  // 1) фон
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

  // 2) "дышащая" картинка на animCanvas
  animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
  animCtx.drawImage(currentImage, dx, dy, drawWidth, drawHeight);

  // 3) обрезаем по маске
  animCtx.save();
  animCtx.globalCompositeOperation = "destination-in";
  animCtx.drawImage(maskCanvas, 0, 0);
  animCtx.restore();

  // 4) накладываем
  ctx.drawImage(animCanvas, 0, 0);
}

// ===== Рисование маски (кисть / ластик) =====

function paintAt(event) {
  if (!currentImage) return;
  const { x, y } = getCanvasPos(event);

  maskCtx.save();

  if (currentTool === "brush") {
    maskCtx.globalCompositeOperation = "source-over";
    maskCtx.fillStyle = "rgba(0, 255, 150, 0.8)";
  } else if (currentTool === "eraser") {
    maskCtx.globalCompositeOperation = "destination-out";
    maskCtx.fillStyle = "rgba(0,0,0,1)";
  }

  maskCtx.beginPath();
  maskCtx.arc(x, y, brushRadius, 0, Math.PI * 2);
  maskCtx.fill();

  maskCtx.restore();
  drawStaticImage(true);
}

canvas.addEventListener("mousedown", (event) => {
  if (!currentImage) return;
  isPainting = true;
  paintAt(event);
});

canvas.addEventListener("mousemove", (event) => {
  if (!isPainting) return;
  paintAt(event);
});

canvas.addEventListener("mouseup", () => {
  isPainting = false;
});

canvas.addEventListener("mouseleave", () => {
  isPainting = false;
});

// ===== Смена размера кисти =====

brushSizeInput.addEventListener("input", (event) => {
  brushRadius = Number(event.target.value);
  brushSizeValue.textContent = brushRadius;
});

// ===== Очистка маски =====

clearMaskBtn.addEventListener("click", () => {
  if (!currentImage) return;
  stopAnimation();
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  drawStaticImage(true);
});

// ===== Переключение режимов =====

brushModeBtn.addEventListener("click", () => {
  if (brushModeBtn.disabled) return;
  currentTool = "brush";
  brushModeBtn.classList.add("active");
  eraserModeBtn.classList.remove("active");
});

eraserModeBtn.addEventListener("click", () => {
  if (eraserModeBtn.disabled) return;
  currentTool = "eraser";
  eraserModeBtn.classList.add("active");
  brushModeBtn.classList.remove("active");
});

// ===== НОВОЕ: выбор длительности =====

recordDurationSelect.addEventListener("change", (e) => {
  recordDurationSec = Number(e.target.value);
});

// ===== Сохранение видео WebM (по выбранной длительности) =====

function saveVideoWebM() {
  if (!currentImage || isRecordingVideo) return;

  isRecordingVideo = true;
  saveVideoBtn.disabled = true;
  saveGifBtn.disabled = true;

  const wasAnimating = animationId !== null;
  if (!wasAnimating) startAnimation();

  const stream = canvas.captureStream(30); // 30 fps
  const chunks = [];

  let recorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  } catch {
    recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  }

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: recorder.mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "photo-animation.webm";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

    isRecordingVideo = false;
    saveVideoBtn.disabled = false;
    saveGifBtn.disabled = false;

    if (!wasAnimating) stopAnimation();
  };

  recorder.start();
  setTimeout(() => recorder.stop(), recordDurationSec * 1000);
}

saveVideoBtn.addEventListener("click", saveVideoWebM);

// ===== НОВОЕ: Сохранение GIF через gif.js =====

// ===== Сохранение GIF через gif.js =====
function saveGif() {
  if (!currentImage || isRecordingGif) return;

  isRecordingGif = true;
  saveGifBtn.disabled = true;
  saveVideoBtn.disabled = true;

  const wasAnimating = animationId !== null;
  if (!wasAnimating) startAnimation();

  const fps = 20; // нормальный fps для GIF
  const totalFrames = recordDurationSec * fps;
  const delay = 1000 / fps;

  // Создаём GIF и ЯВНО задаём размеры
  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: canvas.width,
    height: canvas.height,
    // ВАЖНО: воркер теперь на том же домене (localhost)
    workerScript: "./gif.worker.js"
  });

  // Для отладки: прогресс и ошибки
  gif.on("progress", (p) => {
    // p от 0 до 1
    console.log(`GIF progress: ${Math.round(p * 100)}%`);
  });

  gif.on("abort", () => {
    console.error("GIF render aborted");
  });

  let framesAdded = 0;

  const intervalId = setInterval(() => {
    // ВАЖНО: добавляем кадр из ctx, так стабильнее
    gif.addFrame(ctx, { copy: true, delay });

    framesAdded++;

    if (framesAdded >= totalFrames) {
      clearInterval(intervalId);

      gif.on("finished", (blob) => {
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "photo-animation.gif";
        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);

        isRecordingGif = false;
        saveGifBtn.disabled = false;
        saveVideoBtn.disabled = false;

        if (!wasAnimating) stopAnimation();
      });

      // Запускаем сборку
      gif.render();
    }
  }, delay);
}

saveGifBtn.addEventListener("click", saveGif);

// Кнопки запуска/остановки
startBtn.addEventListener("click", startAnimation);
stopBtn.addEventListener("click", stopAnimation);
