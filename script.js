/* =========================================================
   VISION LAB — script.js
   Uses TensorFlow.js + a pretrained MobileNet model to
   classify images entirely in the browser (no backend,
   no API key, no training required).

   MobileNet was trained on ImageNet (1000 everyday object
   categories: animals, household items, vehicles, etc.)
   ========================================================= */

// ---- DOM references ----
const tabUpload    = document.getElementById("tabUpload");
const tabWebcam     = document.getElementById("tabWebcam");
const uploadPanel   = document.getElementById("uploadPanel");
const webcamPanel   = document.getElementById("webcamPanel");

const dropzone      = document.getElementById("dropzone");
const fileInput     = document.getElementById("fileInput");
const previewImg    = document.getElementById("preview");

const webcamVideo   = document.getElementById("webcamVideo");
const webcamCanvas  = document.getElementById("webcamCanvas");
const webcamStartBtn = document.getElementById("webcamStartBtn");

const scanLine      = document.getElementById("scanLine");
const statusEl      = document.getElementById("status");
const classifyBtn   = document.getElementById("classifyBtn");
const resultsEl     = document.getElementById("results");

// ---- App state ----
let model = null;            // the loaded MobileNet model
let activeSource = "upload"; // "upload" | "webcam"
let webcamStream = null;


/* =========================================================
   1. LOAD THE MODEL (once, on page load)
========================================================= */
async function loadModel() {
  try {
    setStatus("Loading model…");
    model = await mobilenet.load();       // pulls pretrained weights from CDN
    setStatus("Model ready. Add an image to classify it.");
  } catch (err) {
    setStatus("Couldn't load the model. Check your internet connection and reload.", true);
    console.error(err);
  }
}

function refreshClassifyAvailability() {
  const hasImage = activeSource === "upload"
    ? !previewImg.classList.contains("hidden")
    : webcamStream !== null;

  classifyBtn.disabled = !(model && hasImage);
}


/* =========================================================
   2. TAB SWITCHING (upload vs webcam)
========================================================= */
function switchTab(source) {
  activeSource = source;

  tabUpload.classList.toggle("active", source === "upload");
  tabWebcam.classList.toggle("active", source === "webcam");
  tabUpload.setAttribute("aria-selected", source === "upload");
  tabWebcam.setAttribute("aria-selected", source === "webcam");

  uploadPanel.classList.toggle("hidden", source !== "upload");
  webcamPanel.classList.toggle("hidden", source !== "webcam");
  webcamStartBtn.classList.toggle("hidden", source !== "webcam");

  clearResults();
  refreshClassifyAvailability();
}

tabUpload.addEventListener("click", () => switchTab("upload"));
tabWebcam.addEventListener("click", () => switchTab("webcam"));


/* =========================================================
   3. IMAGE UPLOAD (click-to-browse + drag & drop)
========================================================= */
dropzone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) loadImageFile(fileInput.files[0]);
});

["dragover", "dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => e.preventDefault());
});

dropzone.addEventListener("dragover", () => dropzone.classList.add("dragover"));
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));

dropzone.addEventListener("drop", (e) => {
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) loadImageFile(file);
});

function loadImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewImg.classList.remove("hidden");
    dropzone.classList.add("hidden");
    clearResults();
    refreshClassifyAvailability();
  };
  reader.readAsDataURL(file);
}


/* =========================================================
   4. WEBCAM CAPTURE
========================================================= */
webcamStartBtn.addEventListener("click", async () => {
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcamVideo.srcObject = webcamStream;
    webcamStartBtn.textContent = "Webcam active";
    webcamStartBtn.disabled = true;
    refreshClassifyAvailability();
  } catch (err) {
    setStatus("Couldn't access your webcam. Check browser permissions.", true);
    console.error(err);
  }
});


/* =========================================================
   5. CLASSIFY — run the model on whichever source is active
========================================================= */
classifyBtn.addEventListener("click", async () => {
  if (!model) return;

  let imageElement;

  if (activeSource === "upload") {
    imageElement = previewImg;
  } else {
    // Draw the current webcam frame onto a hidden canvas so
    // MobileNet has a static image (not a live video stream) to read.
    webcamCanvas.width = webcamVideo.videoWidth;
    webcamCanvas.height = webcamVideo.videoHeight;
    webcamCanvas.getContext("2d").drawImage(webcamVideo, 0, 0);
    imageElement = webcamCanvas;
  }

  try {
    classifyBtn.disabled = true;
    scanLine.classList.add("active");
    setStatus("Analyzing specimen…");

    // classify() returns an array like:
    // [{ className: "golden retriever", probability: 0.92 }, ...]
    const predictions = await model.classify(imageElement, 3);

    renderResults(predictions);
    setStatus("Analysis complete.");

  } catch (err) {
    setStatus("Classification failed. Try a different image.", true);
    console.error(err);
  } finally {
    scanLine.classList.remove("active");
    classifyBtn.disabled = false;
  }
});


/* =========================================================
   6. RENDER RESULTS as a ranked, numbered readout
========================================================= */
function renderResults(predictions) {
  clearResults();

  predictions.forEach((pred, i) => {
    const pct = (pred.probability * 100).toFixed(1);

    const li = document.createElement("li");
    li.className = "result";
    li.innerHTML = `
      <span class="result-index">0${i + 1}</span>
      <div class="result-main">
        <p class="result-label">${pred.className.split(",")[0]}</p>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%"></div>
        </div>
      </div>
      <span class="result-pct">${pct}%</span>
    `;
    resultsEl.appendChild(li);
  });
}

function clearResults() {
  resultsEl.innerHTML = "";
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}


/* =========================================================
   7. INIT
========================================================= */
loadModel().then(refreshClassifyAvailability);
