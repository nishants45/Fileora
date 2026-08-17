const $ = (id) => document.getElementById(id);

function setResult(id, html) { $(id).innerHTML = html; }

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Please choose an image."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this image.")); };
    img.src = url;
  });
}

function canvasBlob(img, width, height, type, quality=0.9) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Canvas is not supported."));
    if (type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Conversion failed.")), type, quality);
  });
}

function outputName(name, ext) {
  return name.replace(/\.[^.]+$/, "") + ext;
}

$("quality").addEventListener("input", () => $("qualityValue").textContent = $("quality").value);

$("compressBtn").addEventListener("click", async () => {
  try {
    const file = $("compressInput").files[0];
    const img = await loadImage(file);
    const type = $("compressFormat").value;
    const blob = await canvasBlob(img, img.naturalWidth, img.naturalHeight, type, Number($("quality").value));
    const ext = type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg";
    setResult("compressResult", `Original: ${(file.size/1024).toFixed(1)} KB → New: ${(blob.size/1024).toFixed(1)} KB<br><a download="${outputName(file.name,ext)}">Download compressed image</a>`);
    const link = $("compressResult").querySelector("a");
    link.href = URL.createObjectURL(blob);
  } catch(e) { setResult("compressResult", `<span class="error">${e.message}</span>`); }
});

$("resizeBtn").addEventListener("click", async () => {
  try {
    const file = $("resizeInput").files[0], img = await loadImage(file);
    let w = Number($("resizeWidth").value), h = Number($("resizeHeight").value);
    if (!w) throw new Error("Enter a width.");
    if ($("keepRatio").checked) h = Math.round(w * img.naturalHeight / img.naturalWidth);
    if (!h) throw new Error("Enter a height.");
    const type = $("resizeFormat").value;
    const blob = await canvasBlob(img,w,h,type,.9);
    const ext = type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg";
    setResult("resizeResult", `<a download="${outputName(file.name,ext)}">Download resized image (${w}×${h})</a>`);
    $("resizeResult").querySelector("a").href = URL.createObjectURL(blob);
  } catch(e) { setResult("resizeResult", `<span class="error">${e.message}</span>`); }
});

$("convertBtn").addEventListener("click", async () => {
  try {
    const file = $("convertInput").files[0], img = await loadImage(file);
    const type = $("convertFormat").value;
    const blob = await canvasBlob(img,img.naturalWidth,img.naturalHeight,type,.92);
    const ext = type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg";
    setResult("convertResult", `<a download="${outputName(file.name,ext)}">Download converted image</a>`);
    $("convertResult").querySelector("a").href = URL.createObjectURL(blob);
  } catch(e) { setResult("convertResult", `<span class="error">${e.message}</span>`); }
});

async function getPDFLib() {
  if (!window.PDFLib) throw new Error("PDF library is still loading. Try again in a moment.");
  return window.PDFLib;
}

$("mergeBtn").addEventListener("click", async () => {
  try {
    const files = [...$("mergeInput").files];
    if (files.length < 2) throw new Error("Choose at least two PDF files.");
    const { PDFDocument } = await getPDFLib();
    const out = await PDFDocument.create();
    for (const file of files) {
      const src = await PDFDocument.load(await file.arrayBuffer());
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p => out.addPage(p));
    }
    const bytes = await out.save();
    const blob = new Blob([bytes], {type:"application/pdf"});
    setResult("mergeResult", `<a download="merged.pdf">Download merged PDF</a>`);
    $("mergeResult").querySelector("a").href = URL.createObjectURL(blob);
  } catch(e) { setResult("mergeResult", `<span class="error">${e.message}</span>`); }
});

function parsePageRanges(input, max) {
  const nums = new Set();
  for (const part of input.split(",").map(x=>x.trim()).filter(Boolean)) {
    if (/^\d+$/.test(part)) {
      const n = Number(part);
      if(n < 1 || n > max) throw new Error(`Page ${n} is outside the PDF.`);
      nums.add(n-1);
    } else if (/^\d+\s*-\s*\d+$/.test(part)) {
      let [a,b] = part.split("-").map(Number);
      if(a>b) [a,b]=[b,a];
      if(a<1 || b>max) throw new Error("Page range is outside the PDF.");
      for(let n=a;n<=b;n++) nums.add(n-1);
    } else throw new Error(`Invalid range: ${part}`);
  }
  return [...nums].sort((a,b)=>a-b);
}

$("extractBtn").addEventListener("click", async () => {
  try {
    const file = $("extractInput").files[0];
    if(!file) throw new Error("Choose a PDF.");
    const { PDFDocument } = await getPDFLib();
    const src = await PDFDocument.load(await file.arrayBuffer());
    const indexes = parsePageRanges($("pageRanges").value, src.getPageCount());
    if(!indexes.length) throw new Error("Enter page numbers.");
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src,indexes);
    pages.forEach(p=>out.addPage(p));
    const bytes = await out.save();
    const blob = new Blob([bytes],{type:"application/pdf"});
    setResult("extractResult", `<a download="extracted-pages.pdf">Download extracted PDF</a>`);
    $("extractResult").querySelector("a").href=URL.createObjectURL(blob);
  } catch(e) { setResult("extractResult", `<span class="error">${e.message}</span>`); }
});

/* Text tools */
function updateStats() {
  const text = $("textInput").value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  $("wordCount").textContent = words;
  $("charCount").textContent = text.length;
  $("charNoSpace").textContent = text.replace(/\s/g,"").length;
  $("lineCount").textContent = text ? text.split(/\r?\n/).length : 0;
}
$("textInput").addEventListener("input",updateStats);
$("upperBtn").onclick=()=>{$("textInput").value=$("textInput").value.toUpperCase();updateStats()};
$("lowerBtn").onclick=()=>{$("textInput").value=$("textInput").value.toLowerCase();updateStats()};
$("trimBtn").onclick=()=>{$("textInput").value=$("textInput").value.replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").trim();updateStats()};
$("copyBtn").onclick=async()=>{try{await navigator.clipboard.writeText($("textInput").value);$("copyBtn").textContent="Copied!";setTimeout(()=>$("copyBtn").textContent="Copy text",1200)}catch(e){alert("Clipboard access was blocked. Select and copy the text manually.")}};
$("clearBtn").onclick=()=>{$("textInput").value="";updateStats()};
$("year").textContent=new Date().getFullYear();
