// Элементы интерфейса
const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startAnimationBtn");
const stopBtn = document.getElementById("stopAnimationBtn");
const clearMaskBtn = document.getElementById("clearMaskBtn");

const saveVideoBtn = document.getElementById("saveVideoBtn");
const saveGifBtn = document.getElementById("saveGifBtn");

// Длительность записи
const recordDurationSelect = document.getElementById("recordDuration");

// Кисть
const brushSizeInput = document.getElementById("brushSize");
const brushSizeValue = document.getElementById("brushSizeValue");

// Режим рисования (кисть/ластик)
const brushModeBtn = document.getElementById("brushModeBtn");
const eraserModeBtn = document.getElementById("eraserModeBtn");

// НОВОЕ: выбор типа анимации
const effectBreathingRadio = document.getElementById("effectBreathing");
const effectFlowRadio = document.getElementById("effectFlow");

// НОВОЕ: выбор направления потока
const flowDirLeftRadio = document.getElementById("flowDirLeft");
const flowDirRightRadio = document.getElementById("flowDirRight");

// 1 = влево, -1 = вправо (так проще работать в формулах)
let flowDirection = 1;

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

// Рисование
let isPainting = false;
let brushRadius = 30;
let currentTool = "brush";

// НОВОЕ: текущий тип анимации
let currentEffect = "breathing";

// Длительность записи (секунды)
let recordDurationSec = Number(recordDurationSelect.value);

// Флаги записи
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

      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      animCanvas.width = canvas.width;
      animCanvas.height = canvas.height;

      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

      currentImage = img;

      drawStaticImage(true);

      // Включаем UI
      startBtn.disabled = false;
      stopBtn.disabled = false;
      clearMaskBtn.disabled = false;
      saveVideoBtn.disabled = false;
      saveGifBtn.disabled = false;
      recordDurationSelect.disabled = false;
      brushSizeInput.disabled = false;
      brushModeBtn.disabled = false;
      eraserModeBtn.disabled = false;
      effectBreathingRadio.disabled = false;
      effectFlowRadio.disabled = false;

      flowDirLeftRadio.disabled = false;
      flowDirRightRadio.disabled = false;
      flowDirLeftRadio.checked = true;
      flowDirRightRadio.checked = false;
      flowDirection = 1;

      brushSizeInput.value = brushRadius;
      brushSizeValue.textContent = brushRadius;

      currentTool = "brush";
      brushModeBtn.classList.add("active");
      eraserModeBtn.classList.remove("active");

      currentEffect = "breathing";
      effectBreathingRadio.checked = true;
      effectFlowRadio.checked = false;
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

  // 1) фон — статичная картинка
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

  // 2) готовим анимированный слой на animCanvas
  animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);

  if (currentEffect === "breathing") {
    // Эффект "Дыхание" — лёгкое масштабирование туда-сюда
    const amplitude = 0.015; // 1.5% изменения размера (1.5% от размера, чтобы было мягко)
    const speed = 1.0;
    const zoom = 1 + Math.sin(elapsed * speed) * amplitude;

    const drawWidth = canvas.width * zoom;
    const drawHeight = canvas.height * zoom;
    const dx = (canvas.width - drawWidth) / 2;
    const dy = (canvas.height - drawHeight) / 2;

    animCtx.drawImage(currentImage, dx, dy, drawWidth, drawHeight);
} else if (currentEffect === "flow") {
  // Эффект "Поток" — ограниченный сдвиг в одну сторону,
  // направление задаёт flowDirection: 1 = влево, -1 = вправо.

  const FLOW_MAX_OFFSET = canvas.width * 0.05; // максимум хода (20% ширины)
  const FLOW_TRAVEL_SEC = 10;                  // за сколько секунд пройти этот путь

  const rawShift = (elapsed / FLOW_TRAVEL_SEC) * FLOW_MAX_OFFSET;
  const limitedShift = Math.min(rawShift, FLOW_MAX_OFFSET);

  // Учитываем направление
  const signedShift = limitedShift * flowDirection;

  // dx < 0 — картинка едет влево, dx > 0 — вправо
  animCtx.drawImage(
    currentImage,
    -signedShift,
    0,
    canvas.width,
    canvas.height
  );
}

 // 3) Обрезаем анимированный слой по маске
  animCtx.save();
  animCtx.globalCompositeOperation = "destination-in";
  animCtx.drawImage(maskCanvas, 0, 0);
  animCtx.restore();

  if (currentEffect === "breathing") {
    // Для "дыхания" вырезаем старое содержимое внутри маски
    // и подставляем туда анимированный слой
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.restore();
  }

  // 4) В любом случае кладём анимированный слой поверх
  ctx.drawImage(animCanvas, 0, 0);

  // 5) Накладываем анимированный слой вместо вырезанного
  ctx.drawImage(animCanvas, 0, 0);
}

// ===== Рисование маски (кисть / ластик) =====

function paintAt(event) {
  if (!currentImage) return;
  const { x, y } = getCanvasPos(event);

  maskCtx.save();

  if (currentTool === "brush") {
    // КИСТЬ: рисуем мягкий круг с градиентом
    maskCtx.globalCompositeOperation = "source-over";

    const gradient = maskCtx.createRadialGradient(
      x, y, 0,          // центр
      x, y, brushRadius // край
    );

    // В центре — почти полный цвет/альфа,
    // к краю сходится к нулю (мягкий переход)
    gradient.addColorStop(0, "rgba(0, 255, 150, 0.8)");
    gradient.addColorStop(1, "rgba(0, 255, 150, 0.0)");

    maskCtx.fillStyle = gradient;
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushRadius, 0, Math.PI * 2);
    maskCtx.fill();

  } else if (currentTool === "eraser") {
    // ЛАСТИК: мягко стираем маску
    maskCtx.globalCompositeOperation = "destination-out";

    const gradient = maskCtx.createRadialGradient(
      x, y, 0,
      x, y, brushRadius
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    maskCtx.fillStyle = gradient;
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushRadius, 0, Math.PI * 2);
    maskCtx.fill();
  }

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

// ===== Кисть: изменение размера =====

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

// ===== Переключение режимов рисования =====

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

// ===== Переключение типа анимации =====

effectBreathingRadio.addEventListener("change", (e) => {
  if (!e.target.checked) return;
  currentEffect = "breathing";
  // чтобы фаза "дыхания" начиналась заново
  startTime = performance.now();
});

effectFlowRadio.addEventListener("change", (e) => {
  if (!e.target.checked) return;
  currentEffect = "flow";
  // чтобы движение начиналось с нуля
  startTime = performance.now();
});

// Направление потока
flowDirLeftRadio.addEventListener("change", (e) => {
  if (!e.target.checked) return;
  flowDirection = 1; // влево
});

flowDirRightRadio.addEventListener("change", (e) => {
  if (!e.target.checked) return;
  flowDirection = -1; // вправо
});

// ===== Выбор длительности =====

recordDurationSelect.addEventListener("change", (e) => {
  recordDurationSec = Number(e.target.value);
});

// ===== Сохранение видео WebM =====

function saveVideoWebM() {
  if (!currentImage || isRecordingVideo) return;

  isRecordingVideo = true;
  saveVideoBtn.disabled = true;
  saveGifBtn.disabled = true;

  const wasAnimating = animationId !== null;
  if (!wasAnimating) startAnimation();

  const stream = canvas.captureStream(30);
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

// ===== Сохранение GIF =====

function saveGif() {
  if (!currentImage || isRecordingGif) return;

  isRecordingGif = true;
  saveGifBtn.disabled = true;
  saveVideoBtn.disabled = true;

  const wasAnimating = animationId !== null;
  if (!wasAnimating) startAnimation();

  const fps = 20;
  const totalFrames = recordDurationSec * fps;
  const delay = 1000 / fps;

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: canvas.width,
    height: canvas.height,
    workerScript: "./gif.worker.js",
  });

  gif.on("progress", (p) => {
    console.log(`GIF progress: ${Math.round(p * 100)}%`);
  });

  gif.on("abort", () => {
    console.error("GIF render aborted");
  });

  let framesAdded = 0;

  const intervalId = setInterval(() => {
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

      gif.render();
    }
  }, delay);
}

saveGifBtn.addEventListener("click", saveGif);

// Кнопки запуска/остановки
startBtn.addEventListener("click", startAnimation);
stopBtn.addEventListener("click", stopAnimation);
