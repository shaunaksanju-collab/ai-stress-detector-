// ================= ELEMENTS =================
const stressMessages = [
  'Take a deep breath — inhale for 4 seconds, exhale for 6.',
  'You’ve been focused for a while. A short break might help.',
  'Relax your shoulders and unclench your jaw.',
  'Pause for a moment and look away from the screen.',
  'Try slow breathing: in through the nose, out through the mouth.',
];
const video = document.getElementById('video');
const statusText = document.getElementById('status');
const stressBar = document.getElementById('stressBar');
const startBtn = document.getElementById('startBtn');

const typingArea = document.getElementById('typingArea');
const typingSpeedDisplay = document.getElementById('typingSpeed');

// ================= STATE =================
let detectionInterval = null;
let stressStartTime = null;
let breakAlertShown = false;
let lastFaceTime = Date.now();
let typingStartTime = null;
let currentCPM = 0;

const FACE_TIMEOUT = 1500;

// ================= LOAD MODELS =================
async function loadModels() {
  const MODEL_URL =
    'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

  statusText.innerText = 'Status: Loading models...';
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
  statusText.innerText = 'Status: Models loaded';
}

// ================= CAMERA =================
async function startCamera() {
  try {
    await loadModels();

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    statusText.innerText = 'Status: Camera started';
    startDetection();
  } catch (err) {
    console.error('Camera error:', err);
    statusText.innerText = 'Status: Error starting system';
  }
}

// ================= TYPING SPEED =================
typingArea.addEventListener('input', () => {
  const now = Date.now();
  if (!typingStartTime) typingStartTime = now;

  const chars = typingArea.value.length;
  const minutes = (now - typingStartTime) / 60000;

  currentCPM = minutes > 0 ? Math.round(chars / minutes) : 0;
  typingSpeedDisplay.innerText = `Typing speed: ${currentCPM} CPM`;
});

// ================= DETECTION LOOP =================
function startDetection() {
  if (detectionInterval) clearInterval(detectionInterval);

  detectionInterval = setInterval(async () => {
    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 160,
          scoreThreshold: 0.5,
        })
      )
      .withFaceLandmarks()
      .withFaceExpressions();

    const now = Date.now();

    // ---------- FACE PRESENCE ----------
    if (detection) {
      lastFaceTime = now;
    } else if (now - lastFaceTime > FACE_TIMEOUT) {
      statusText.innerText = 'Status: No face detected';
      stressBar.style.width = '0%';
      stressHistory = [];
      stressStartTime = null;
      breakAlertShown = false;
      return;
    }

    if (!detection) return;
    const landmarks = detection.landmarks;

    // ---------- CONFIDENCE FILTER ----------
    if (detection.expressions.neutral > 0.85) return;

    function avgY(points) {
      return points.reduce((sum, p) => sum + p.y, 0) / points.length;
    }

    const leftBrow = landmarks.getLeftEyeBrow();
    const rightBrow = landmarks.getRightEyeBrow();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const browY = (avgY(leftBrow) + avgY(rightBrow)) / 2;
    const eyeY = (avgY(leftEye) + avgY(rightEye)) / 2;

    let browStress = 0;
    const browEyeDistance = eyeY - browY;

    if (browEyeDistance < 29) browStress = 0.5;
    if (browEyeDistance < 27) browStress = 1.0;
    if (browEyeDistance < 24) browStress = 1.5;
    console.log(
      'brow eye distance:',
      browEyeDistance.toFixed(2),
      'browstress:'
    );

    // ---------- FACE STRESS (LANDMARK + EXPRESSION) ----------
    const e = detection.expressions;

    // Expression-based stress (lighter than before)
    const expressionStress =
      e.angry * 1.8 +
      e.fearful * 2.0 +
      e.sad * 1.2 +
      e.disgusted * 1.4 +
      browStress * 2.5;

    // faceStress now includes eyebrow tension from Step 4
    const faceStress = expressionStress + browStress;

    // ---------- TYPING STRESS ----------
    let typingStress = 0;
    if (currentCPM > 250) typingStress = 0.5;
    if (currentCPM > 350) typingStress = 1.0;

    // ---------- FUSED STRESS ----------
    const finalStress = faceStress * 0.75 + typingStress * 0.25;

    // ---------- TEMPORAL SMOOTHING ----------

    // ---------- LEVEL ----------
    let level = 'Low Load';
    let barWidth = 30;
    let barColor = 'green';

    if (finalStress > 1.0) {
      level = 'High Load';
      barWidth = 100;
      barColor = 'red';
    } else if (finalStress > 0.5) {
      level = 'Moderate Load';
      barWidth = 60;
      barColor = 'yellow';
    }

    // ---------- UI ----------
    statusText.innerText = `Status: ${level}`;
    stressBar.style.width = `${barWidth}%`;
    stressBar.style.backgroundColor = barColor;

    // ---------- TIMER + POPUP ----------
    if (level !== 'Low Load') {
      if (!stressStartTime) stressStartTime = now;

      const stressedSeconds = (now - stressStartTime) / 1000;
      console.log('Stressed for:', stressedSeconds.toFixed(1), 'seconds');

      if (stressedSeconds >= 10 && !breakAlertShown) {
        const randommessages =
          stressMessages[Math.floor(Math.random() * stressMessages.length)];
        alert('⚠️ stress detected`\n\n' + randommessages);
      }
    } else {
      stressStartTime = null;
      breakAlertShown = false;
    }
  }, 250);
}

// ================= BUTTON =================
startBtn.addEventListener('click', startCamera);
