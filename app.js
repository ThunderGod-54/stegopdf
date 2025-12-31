const viewer = document.getElementById("viewer");
const dropZone = document.getElementById("dropZone");

let pdfDoc = null, currentDropResolve = null;

/* 🔐 Zero Width Steganography */
function encodeZW(txt) {
  return [...txt]
    .map(ch =>
      ch.charCodeAt(0).toString(2).padStart(8, "0")
        .replace(/0/g, "\u200B")
        .replace(/1/g, "\u200C") + "\u200D"
    ).join("");
}
function decodeZW(txt) {
  return txt.split("\u200D").filter(v => v).map(b =>
    String.fromCharCode(parseInt(b.replace(/\u200B/g, "0").replace(/\u200C/g, "1"), 2))
  ).join("");
}

/* 📄 Load PDF */
document.getElementById("pdfUpload").onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);

  pdfDoc = await pdfjsLib.getDocument(url).promise;
  viewer.innerHTML = "";
  renderAllPages();
};

/* 📜 RENDER ALL PAGES (SCROLL VIEW) */
async function renderAllPages() {
  for (let pageNo = 1; pageNo <= pdfDoc.numPages; pageNo++) {
    const page = await pdfDoc.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1.25 });

    const wrapper = document.createElement("div");
    wrapper.className = "pageWrapper";
    wrapper.style.position = "relative";
    wrapper.style.margin = "20px auto";
    wrapper.style.width = viewport.width + "px";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    wrapper.appendChild(canvas);
    viewer.appendChild(wrapper);

    await page.render({ canvasContext: ctx, viewport }).promise;

    /* 📍 Click → Type Menu */
    canvas.onclick = e => showTypeMenu(e, wrapper);
  }
}

/* 🧩 Menu to choose text/image */
function showTypeMenu(e, container) {
  const { offsetX: x, offsetY: y } = e;

  const menu = document.createElement("div");
  menu.className = "menuBox";
  menu.style.left = x + "px";
  menu.style.top = y + "px";
  menu.innerHTML = `
    <b>Add hidden note:</b><br>
    <button class="btnTXT">📝 Text</button>
    <button class="btnIMG">🖼 Image</button>
  `;
  container.appendChild(menu);

  // Text
  menu.querySelector(".btnTXT").onclick = () => {
    menu.remove();
    const text = prompt("Enter hidden text:");
    if (text) createMarker(x, y, encodeZW(text), "text", container);
  };

  // Image
  menu.querySelector(".btnIMG").onclick = async () => {
    menu.remove();
    const base64 = await pickImage();
    if (base64) createMarker(x, y, encodeZW(base64), "image", container);
  };
}

/* 📤 Select / Drag Image */
function pickImage() {
  return new Promise(res => {
    currentDropResolve = res;
    dropZone.classList.add("show");
  });
}
dropZone.onclick = () => {
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*";
  input.onchange = async e => {
    const base64 = await fileToBase64(e.target.files[0]);
    dropZone.classList.remove("show");
    currentDropResolve(base64);
  };
  input.click();
};
dropZone.ondragover = e => e.preventDefault();
dropZone.ondrop = async e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  const base64 = await fileToBase64(file);
  dropZone.classList.remove("show");
  currentDropResolve(base64);
};
function fileToBase64(file) {
  return new Promise(r => {
    const reader = new FileReader();
    reader.onload = () => r(reader.result);
    reader.readAsDataURL(file);
  });
}

/* 🔵 Add Draggable Marker */
function createMarker(x, y, secret, type, container) {
  const m = document.createElement("div");
  m.className = "note-marker";
  m.style.left = x + "px";
  m.style.top = y + "px";
  m.dataset.secret = secret;
  m.dataset.type = type;

  // Reveal content
  m.onclick = e => {
    e.stopPropagation();
    reveal(m, container);
  };

  // Drag
  m.onmousedown = e => {
    let dx = e.clientX - m.offsetLeft;
    let dy = e.clientY - m.offsetTop;

    document.onmousemove = ev => {
      m.style.left = ev.clientX - dx + "px";
      m.style.top = ev.clientY - dy + "px";
    };
    document.onmouseup = () => document.onmousemove = null;
  };

  container.appendChild(m);
}

/* 👁 Reveal Stego Content */
function reveal(marker, container) {
  const { secret, type } = marker.dataset;
  const x = marker.offsetLeft + 22, y = marker.offsetTop + 22;

  if (type === "text") {
    const text = decodeZW(secret);
    const note = document.createElement("div");
    note.className = "note-popup";
    note.textContent = text;
    note.style.left = x + "px";
    note.style.top = y + "px";
    container.appendChild(note);
    setTimeout(() => note.remove(), 5000);
  } else {
    const img = document.createElement("img");
    img.src = decodeZW(secret);
    img.className = "revealImage";
    img.style.left = x + "px";
    img.style.top = y + "px";
    container.appendChild(img);
    setTimeout(() => img.remove(), 5000);
  }
}
