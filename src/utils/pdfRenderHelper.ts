export async function renderPdfBlobToImageUrls(
  blobUrl: string,
  maxPages = 2
): Promise<string[]> {
  const response = await fetch(blobUrl);
  const arrayBuffer = await response.arrayBuffer();

  const [pdfjsLib, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
  }

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageCount = Math.min(pdf.numPages, maxPages);
  const imageUrls: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext('2d');
    if (!context) continue;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    imageUrls.push(canvas.toDataURL('image/jpeg', 0.92));
  }

  await pdf.cleanup();
  await loadingTask.destroy();
  return imageUrls;
}
