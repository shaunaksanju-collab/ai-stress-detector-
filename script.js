const video = document.getElementById("video");
const textarea = document.getElementById("typingArea");
const statusText = document.getElementById("status");

// Start webcam
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => video.srcObject = stream)
  .catch(err => console.error(err));

// Load face-api models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("models"),
  faceapi.nets.faceExpressionNet.loadFromUri("models")
]).then(startFaceDetection);

let expressions = {};

function startFaceDetection() {
  setInterval(async () => {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (detection) {
      expressions = detection.expressions;
    }
  }, 500);
}

// Typing data
let keystrokes = 0;
let backspaces = 0;
let pauses = 0;
let lastKeyTime = Date.now();

textarea.addEventListener("keydown", e => {
  keystrokes++;
  if (e.key === "Backspace") backspaces++;

  const now = Date.now();
  if (now - lastKeyTime > 2000) pauses++;
  lastKeyTime = now;
});

// Cognitive load logic
setInterval(() => {
  let loadScore = 0;
  const typingSpeed = keystrokes / 10;

  if (typingSpeed < 15) loadScore += 2;
  if (backspaces > 5) loadScore += 2;
  if (pauses > 3) loadScore += 2;

  if (expressions && Object.keys(expressions).length > 0) {
    if (expressions.angry > 0.4) loadScore += 2;
    if (expressions.sad > 0.4) loadScore += 2;
  }

  let state = "Focused";
  if (loadScore >= 6) state = "Overloaded";
  else if (loadScore >= 3) state = "High Load";

  statusText.innerText = "Status: " + state;

  keystrokes = 0;
  backspaces = 0;
  pauses = 0;
}, 10000);