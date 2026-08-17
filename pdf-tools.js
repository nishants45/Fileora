import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const input = document.getElementById("pdfImageInput");
const btn = document.getElementById("pdfImageBtn");
const result = document.getElementById("pdfImageResult");

btn.addEventListener("click", async () => {
  try {
    const file = input.files[0];
    if (!file) throw new Error("Choose a PDF.");
    const pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
    if (pdf.numPages > 30) throw new Error("For browser performance, this tool currently processes up to 30 pages at a time.");
    result.innerHTML = `Converting ${pdf.numPages} page(s)...`;
    for (let n=1;n<=pdf.numPages;n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({scale:1.5});
      const canvas = document.createElement("canvas");
      canvas.width=viewport.width; canvas.height=viewport.height;
      await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;
      const blob = await new Promise(r=>canvas.toBlob(r,"image/png"));
      const a=document.createElement("a");
      a.download=`page-${n}.png`; a.textContent=`Download page ${n} (PNG)`;
      a.href=URL.createObjectURL(blob);
      a.style.display="block"; a.style.marginTop="6px";
      result.appendChild(a);
    }
  } catch(e) { result.innerHTML = `<span class="error">${e.message}</span>`; }
});
