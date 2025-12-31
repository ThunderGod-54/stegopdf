/********************************************************************/
/* STEGO PDF NOTES VIEWER (TEXT + IMAGE + AUDIO) — FINAL VERSION  */
/********************************************************************/
const viewer = document.getElementById("viewer");
const dropZone = document.getElementById("dropZone");
const saveBtn = document.getElementById("savePdfBtn");

let pdfDoc = null;
let loadedPdfBytes = null;
let pageMarkers = {}; // page -> [ {x,y,type,secret} ]

/*********************** ZERO WIDTH ENCODE **************************/
function encodeZW(txt) {
  return [...txt].map(ch =>
    ch.charCodeAt(0).toString(2).padStart(8, "0")
      .replace(/0/g, "\u200B").replace(/1/g, "\u200C") + "\u200D"
  ).join("");
}
function decodeZW(txt) {
  return txt.split("\u200D").filter(v => v).map(b =>
    String.fromCharCode(parseInt(b.replace(/\u200B/g, "0").replace(/\u200C/g, "1"), 2))
  ).join("");
}

/********************** AUDIO UTILS *********************************/
async function blobToBase64(blob) {
  return new Promise(r => {
    const fr = new FileReader();
    fr.onloadend = () => r(fr.result);
    fr.readAsDataURL(blob);
  });
}
function splitChunks(str, size) {
  const out = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out;
}
const AUDIO_CHUNK = 3000;

/*************************** LOAD PDF ********************************/
document.getElementById("pdfUpload").onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  loadedPdfBytes = await file.arrayBuffer();

  pdfDoc = await pdfjsLib.getDocument({ data: loadedPdfBytes }).promise;
  viewer.innerHTML = "";
  pageMarkers = {};

  await renderAllPages();
  await restoreMarkers();
};

/******************** RENDER ALL PAGES *********************************/
async function renderAllPages() {
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const vp = page.getViewport({ scale: 1.25 });

    const wrap = document.createElement("div");
    wrap.className = "pageWrapper";
    wrap.style.position = "relative";
    wrap.style.width = vp.width + "px";
    wrap.style.margin = "20px auto";

    const canvas = document.createElement("canvas");
    canvas.width = vp.width; canvas.height = vp.height;
    wrap.appendChild(canvas);
    viewer.appendChild(wrap);

    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    canvas.onclick = e => openPopupMenu(e, wrap, p);
    pageMarkers[p] ??= [];
  }
}

/**************** ADD MARKER — TEXT / IMAGE / AUDIO *********************/
function openPopupMenu(e, wrap, page) {
  closePopup();
  const x = e.offsetX, y = e.offsetY;

  const popup = document.createElement("div");
  popup.id = "stegoPopup";
  popup.className = "menuBox"; // Using your CSS class
  popup.style.position = "absolute";
  popup.style.left = x + "px"; popup.style.top = y + "px";

  popup.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
        <strong style="font-size: 16px;">Add:</strong>
        <button id="btnText">Text</button>
        <button id="btnImg">Image</button>
        <button id="btnAudio">Audio</button>
        <span id="popupClose" style="cursor:pointer; font-size: 20px; margin-left: 5px; color: #333;">✕</span>
    </div>
  `;
  wrap.appendChild(popup);

  document.getElementById("popupClose").onclick = closePopup;

  document.getElementById("btnText").onclick = () => {
    const t = prompt("Enter hidden text:");
    if (t) addMarker(page, x, y, "text", encodeZW(t), wrap);
    closePopup();
  };

  document.getElementById("btnImg").onclick = async () => {
    const base64 = await pickImage();
    if (base64) addMarker(page, x, y, "image", encodeZW(base64), wrap);
    closePopup();
  };

  document.getElementById("btnAudio").onclick = () => recordAudio(page, x, y, wrap);
}

/*************************** IMAGE PICK *******************************/
function pickImage() {
  return new Promise(res => {
    dropZone.classList.add("show");
    dropZone.onclick = () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*";
      input.onchange = async e => {
        const base64 = await blobToBase64(e.target.files[0]);
        dropZone.classList.remove("show");
        res(base64);
      };
      input.click();
    };
  });
}

/*************************** AUDIO RECORD ******************************/
async function recordAudio(page, x, y, wrap) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    let chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.start();

    // Custom UI for recording instead of a blocking alert
    const recIndicator = document.createElement("div");
    recIndicator.innerHTML = "🔴 Recording... Click to Stop";
    recIndicator.style = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:red; color:white; padding:10px; border-radius:20px; cursor:pointer; z-index:5000;";
    document.body.appendChild(recIndicator);

    recIndicator.onclick = () => {
      rec.stop();
      recIndicator.remove();
      stream.getTracks().forEach(track => track.stop());
    };

    rec.onstop = async () => {
      const base = await blobToBase64(new Blob(chunks, { type: "audio/webm" }));
      const chunked = splitChunks(base, AUDIO_CHUNK);
      const encodedChunks = chunked.map(c => encodeZW(c));
      const packed = encodeZW(JSON.stringify(encodedChunks));
      addMarker(page, x, y, "audio", packed, wrap);
    };
    closePopup();
  } catch (err) {
    alert("Microphone access denied or not supported.");
  }
}

/**************************** ADD MARKER *********************************/
function addMarker(page, x, y, type, secret, wrap) {
  const m = document.createElement("div");
  m.className = "note-marker";
  m.style.left = x + "px"; m.style.top = y + "px";
  m.dataset.type = type;
  m.dataset.secret = secret;
  m.dataset.page = page;

  m.onclick = e => { e.stopPropagation(); revealMarker(m, wrap); };

  // Improved dragging logic
  m.onmousedown = e => {
    e.stopPropagation();
    let dx = e.clientX - m.offsetLeft, dy = e.clientY - m.offsetTop;
    document.onmousemove = ev => {
      m.style.left = ev.clientX - dx + "px";
      m.style.top = ev.clientY - dy + "px";
    };
    document.onmouseup = () => {
      document.onmousemove = null;
      // Update the marker coordinates in the data structure
      const index = pageMarkers[page].findIndex(item => item.secret === secret);
      if (index !== -1) {
        pageMarkers[page][index].x = parseInt(m.style.left);
        pageMarkers[page][index].y = parseInt(m.style.top);
      }
    };
  };

  wrap.appendChild(m);
  pageMarkers[page].push({ x, y, type, secret });
}

/**************************** REVEAL ***********************************/
function revealMarker(m, wrap) {
  closePopup();
  const type = m.dataset.type, secret = m.dataset.secret;
  const x = m.offsetLeft + 22, y = m.offsetTop + 22;

  if (type === "text") {
    const txt = decodeZW(secret);
    showPopupContent(wrap, x, y, txt);
  }
  else if (type === "image") {
    const container = document.createElement("div");
    container.className = "revealImageContainer";
    container.style = `position:absolute; left:${x}px; top:${y}px; z-index:999; border:2px solid #0099ff; background:#fff; border-radius:6px;`;

    container.innerHTML = `
        <div style="background:#0099ff; color:white; display:flex; justify-content:space-between; padding:2px 5px; cursor:default;">
            <small>Image</small>
            <span class="close-reveal" style="cursor:pointer;">✕</span>
        </div>
        <img src="${decodeZW(secret)}" style="max-width:240px; display:block;">
    `;

    wrap.appendChild(container);
    container.querySelector(".close-reveal").onclick = () => container.remove();
  }
  else if (type === "audio") {
    const decoded = decodeZW(secret);
    const chunks = JSON.parse(decoded).map(c => decodeZW(c));
    const base = chunks.join("");
    const audio = new Audio(base); audio.play();
  }
}

function showPopupContent(wrap, x, y, txt) {
  const note = document.createElement("div");
  note.className = "note-popup";
  note.style.left = x + "px"; note.style.top = y + "px";

  note.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:10px; border-bottom:1px solid #ddd; margin-bottom:5px;">
        <small>Text Note</small>
        <span class="close-reveal" style="cursor:pointer; font-weight:bold;">✕</span>
    </div>
    <div>${txt}</div>
  `;

  wrap.appendChild(note);
  note.querySelector(".close-reveal").onclick = () => note.remove();
}

/**************************** CLOSE POPUP ******************************/
function closePopup() {
  const popup = document.getElementById("stegoPopup");
  if (popup) popup.remove();
}

/**************************** SAVE PDF *********************************/
saveBtn.onclick = async () => {
  if (!loadedPdfBytes) return alert("Load PDF first");
  const pdf = await PDFLib.PDFDocument.load(loadedPdfBytes);

  for (let p = 1; p <= pdf.getPages().length; p++) {
    const page = pdf.getPage(p - 1);
    if (!pageMarkers[p]) continue;
    for (const m of pageMarkers[p]) {
      page.drawText(m.secret, {
        x: m.x, y: page.getHeight() - m.y, size: 1,
        color: PDFLib.rgb(1, 1, 1) // invisible
      });
    }
  }

  const data = await pdf.save();
  const blob = new Blob([data], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "stego_saved.pdf";
  a.click();
};
/**************************** REVEAL ***********************************/
function revealMarker(m, wrap) {
  closePopup();
  const type = m.dataset.type, secret = m.dataset.secret;
  const x = m.offsetLeft + 22, y = m.offsetTop + 22;

  if (type === "text") {
    const txt = decodeZW(secret);
    showPopupContent(wrap, x, y, txt);
  }
  else if (type === "image") {
    const container = document.createElement("div");
    container.className = "revealImageContainer";
    container.style = `position:absolute; left:${x}px; top:${y}px; z-index:999; border:2px solid #0099ff; background:#fff; border-radius:6px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);`;

    container.innerHTML = `
        <div style="background:#0099ff; color:white; display:flex; justify-content:space-between; padding:2px 8px; cursor:default; border-radius: 4px 4px 0 0;">
            <small>Image</small>
            <span class="close-reveal" style="cursor:pointer;">✕</span>
        </div>
        <img src="${decodeZW(secret)}" style="max-width:240px; display:block; padding:5px;">
    `;

    wrap.appendChild(container);
    container.querySelector(".close-reveal").onclick = () => container.remove();
  }
  else if (type === "audio") {
    const decoded = decodeZW(secret);
    const chunks = JSON.parse(decoded).map(c => decodeZW(c));
    const base = chunks.join("");

    // Call the new mini player function
    showAudioPlayer(wrap, x, y, base);
  }
}
/**************************** MINI AUDIO PLAYER (VLC STYLE + SPEED) ******************************/
function showAudioPlayer(wrap, x, y, audioSrc) {
  const playerCont = document.createElement("div");
  playerCont.className = "mini-audio-player";
  playerCont.style = `
    position: absolute; left: ${x}px; top: ${y}px; z-index: 1000; 
    background: #2a2a2a; color: #fff; border-radius: 4px; padding: 10px; 
    box-shadow: 0 4px 15px rgba(0,0,0,0.5); min-width: 280px; font-family: sans-serif;
  `;

  playerCont.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="font-size: 11px; color: #ffa500; font-weight: bold;">VLC MINI PLAYER</span>
      <span class="close-player" style="cursor:pointer; font-size: 14px;">✕</span>
    </div>
    
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
      <button id="playPauseBtn" style="background:none; border:none; color:#ffa500; cursor:pointer; font-size:18px; min-width:25px;">▶</button>
      
      <div style="flex-grow: 1; display: flex; flex-direction: column;">
        <input type="range" id="seekSlider" value="0" max="100" 
          style="width: 100%; cursor: pointer; accent-color: #ffa500;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 2px; color: #ccc;">
          <span id="currentTime">0:00</span>
          <span id="durationTime">0:00</span>
        </div>
      </div>
    </div>

    <div style="border-top: 1px solid #444; padding-top: 8px; display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 10px; color: #ccc; min-width: 65px;">Speed: <span id="speedVal" style="color:#ffa500;">1.0</span>x</span>
      <input type="range" id="speedSlider" min="0.5" max="2.0" step="0.1" value="1.0" 
        style="flex-grow: 1; cursor: pointer; accent-color: #ffa500; height: 3px;">
    </div>
    
    <audio id="audioElement" src="${audioSrc}"></audio>
  `;

  wrap.appendChild(playerCont);

  const audio = playerCont.querySelector("#audioElement");
  const playBtn = playerCont.querySelector("#playPauseBtn");
  const seekSlider = playerCont.querySelector("#seekSlider");
  const speedSlider = playerCont.querySelector("#speedSlider");
  const speedLabel = playerCont.querySelector("#speedVal");
  const curTimeTxt = playerCont.querySelector("#currentTime");
  const durTimeTxt = playerCont.querySelector("#durationTime");

  // Play/Pause Toggle
  playBtn.onclick = () => {
    if (audio.paused) {
      audio.play();
      playBtn.innerText = "⏸";
    } else {
      audio.pause();
      playBtn.innerText = "▶";
    }
  };

  // Playback Speed Logic
  speedSlider.oninput = () => {
    const val = parseFloat(speedSlider.value);
    audio.playbackRate = val;
    speedLabel.innerText = val.toFixed(1);
  };

  // Update seek slider as audio plays
  audio.ontimeupdate = () => {
    const pct = (audio.currentTime / audio.duration) * 100;
    seekSlider.value = pct || 0;
    curTimeTxt.innerText = formatTime(audio.currentTime);
  };

  audio.onloadedmetadata = () => {
    durTimeTxt.innerText = formatTime(audio.duration);
  };

  seekSlider.oninput = () => {
    const time = (seekSlider.value / 100) * audio.duration;
    audio.currentTime = time;
  };

  playerCont.querySelector(".close-player").onclick = () => {
    audio.pause();
    playerCont.remove();
  };
}

function formatTime(secs) {
  if (isNaN(secs)) return "0:00";
  const mins = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${mins}:${s < 10 ? '0' : ''}${s}`;
}
/**************************** SAVE & EMBED PDF *********************************/
document.getElementById("savePdfBtn").onclick = async () => {
  if (!loadedPdfBytes) {
    alert("Please load a PDF first!");
    return;
  }

  const status = document.getElementById("statusMsg");
  status.textContent = "Processing & Embedding data...";

  try {
    // 1. Load the existing PDF bytes into pdf-lib
    const pdfDocLib = await PDFLib.PDFDocument.load(loadedPdfBytes);
    const pages = pdfDocLib.getPages();

    // 2. Loop through every page to find markers placed on it
    for (let p = 1; p <= pages.length; p++) {
      const page = pages[p - 1];
      const markersOnPage = pageMarkers[p] || [];

      for (const m of markersOnPage) {
        /* We embed the 'secret' (the Zero-Width string) directly.
           This string already contains the encoded Text, Image, or Audio.
        */
        const secretData = m.secret;

        // 3. Draw the invisible text at the marker's location
        // Note: PDF coordinates (y) start from bottom, so we subtract from height
        page.drawText(secretData, {
          x: m.x,
          y: page.getHeight() - m.y,
          size: 1, // Tiny font size
          color: PDFLib.rgb(1, 1, 1), // White color (invisible on white paper)
          opacity: 0.01 // Nearly transparent for extra security
        });
      }
    }

    // 4. Serialize the PDF to bytes
    const pdfBytes = await pdfDocLib.save();

    // 5. Create a download link and trigger it
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `annotated_stego_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    status.textContent = "✅ Downloaded successfully!";
    setTimeout(() => status.textContent = "", 3000);

  } catch (err) {
    console.error("Save Error:", err);
    alert("Failed to save PDF: " + err.message);
    status.textContent = "❌ Error saving.";
  }
};
/***************** RESTORE EXISTING STEGO ****************************/
async function restoreMarkers() {
  // Logic to attempt recovery of steganographic text from the PDF stream
  // Note: This requires the PDF text to be extractable via standard PDF parsing
  console.log("Attempting to restore markers...");
}