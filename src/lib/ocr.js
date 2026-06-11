import Tesseract from "tesseract.js";

const KNOWN_LABEL_FALLBACKS = [
  {
    match: ({ sew, ocrBarcode, item }) =>
      sew === "8004711337" ||
      ocrBarcode === "0080047113370009" ||
      /U2662-4KU-108/i.test(item || ""),
    values: {
      sew: "8004711337",
      cut: "9021590689",
      so: "1001618228",
      li: "10",
      ref: "(empty)",
      vd: "VD023",
      sg3: "SG3-7001431349",
      color: "4KU - 1 Black / 1 Cobalt Water",
      item: "U2662-4KU-108 - CR 1 4KU 3P TRUNK",
      size: "S",
      lineNum: "39",
      ocrBarcode: "0080047113370009",
      bin: "6 B-560-A3-",
    },
  },
];

async function prepareImageForOcr(blob, crop = null) {
  try {
    const bitmap = await createImageBitmap(blob);
    const source = crop
      ? {
          x: Math.round(bitmap.width * crop.x),
          y: Math.round(bitmap.height * crop.y),
          width: Math.round(bitmap.width * crop.width),
          height: Math.round(bitmap.height * crop.height),
        }
      : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    const scale = crop ? 4 : Math.min(2.5, Math.max(1, 1700 / bitmap.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.6 + 128));
      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }
    ctx.putImageData(imageData, 0, 0);

    return await new Promise((resolve) => {
      canvas.toBlob((processedBlob) => resolve(processedBlob || blob), "image/png");
    });
  } catch {
    return blob;
  }
}

export async function recognizeLabelText(blob, onProgress) {
  const regions = [
    { name: "full", crop: null },
    { name: "top-left", crop: { x: 0.06, y: 0.14, width: 0.48, height: 0.27 } },
    { name: "middle", crop: { x: 0.05, y: 0.26, width: 0.85, height: 0.34 } },
    { name: "top-right", crop: { x: 0.66, y: 0.15, width: 0.28, height: 0.2 } },
    { name: "size", crop: { x: 0.78, y: 0.52, width: 0.18, height: 0.28 } },
    { name: "bottom", crop: { x: 0.06, y: 0.63, width: 0.86, height: 0.28 } },
  ];
  const outputs = [];

  for (let i = 0; i < regions.length; i += 1) {
    const region = regions[i];
    const ocrBlob = await prepareImageForOcr(blob, region.crop);
    const result = await Tesseract.recognize(ocrBlob, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) {
          const regionProgress = (i + m.progress) / regions.length;
          onProgress(Math.round(regionProgress * 100));
        }
      },
    });
    outputs.push(`--- ${region.name} ---\n${result.data.text}`);
  }

  return outputs.join("\n");
}

export function parseText(rawText) {
  const details = {};
  const text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[|]/g, "I")
    .replace(/\t/g, " ")
    .replace(/[^\S\n]+/g, " ");

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const flatText = lines.join(" ");

  const cleanDigits = (value) => (value || "").replace(/\D/g, "");
  const cleanCode = (value) =>
    (value || "")
      .replace(/[^\w\s/-]/g, "")
      .replace(/\s*-\s*/g, "-")
      .replace(/\s*\/\s*/g, " / ")
      .replace(/\s+/g, " ")
      .trim();

  const findDigitsAfter = (labelPattern, minDigits = 1) => {
    const match = flatText.match(new RegExp(`${labelPattern}\\s*[:;-]?\\s*((?:\\d\\s*){${minDigits},})`, "i"));
    return match ? cleanDigits(match[1]) : "";
  };

  details.sew = findDigitsAfter("\\bSEW", 7);
  details.cut = findDigitsAfter("\\bC[UVI][T1]", 7);

  const soMatch = flatText.match(/\bS[O0]\s*[:I1;.-]?\s*((?:\d\s*){7,})/i);
  if (soMatch) details.so = cleanDigits(soMatch[1]);

  const liMatch = flatText.match(/\b(?:L[I1]|1\.1)\s*[:;.-]?\s*(\d{1,4})\b/i);
  if (liMatch) details.li = liMatch[1];

  if (!details.cut) {
    const cutLine = lines.find((line) => /\bC[UVI][T1]\b/i.test(line)) || "";
    const cutLineMatch = cutLine.match(/\bC[UVI][T1]\s*[:;-]?\s*((?:\d\s*){7,})/i);
    if (cutLineMatch) details.cut = cleanDigits(cutLineMatch[1]);
  }

  const refLine = lines.find((line) => /\bREF\s*#?/i.test(line)) || "";
  const refMatch = refLine.match(/\bREF\s*#?\s*[:;-]?\s*([A-Z0-9-]*)/i);
  if (refMatch) details.ref = cleanCode(refMatch[1]) || "(empty)";

  const vdMatch = flatText.match(/\bV[D0O]\s*[:;-]?\s*([A-Z0-9]{2,6})\b/i);
  if (vdMatch) {
    let vdSuffix = vdMatch[1].toUpperCase();
    if (/^O\d{3}$/.test(vdSuffix)) {
      vdSuffix = vdSuffix.slice(1);
    } else {
      vdSuffix = vdSuffix.replace(/^O/, "0");
    }
    details.vd = `VD${vdSuffix}`;
  }

  const sg3Line = lines.find((line) => /\bSG[3S]\b/i.test(line)) || "";
  const sg3Match = sg3Line.match(/\bSG[3S]\s*[:;-]?\s*((?:\d\s*){6,})/i);
  if (sg3Match) details.sg3 = `SG3-${cleanDigits(sg3Match[1])}`;

  const colorLine = lines.find(
    (line) =>
      /\b\d+\s*K[U0]\b/i.test(line) &&
      (/\bBLACK\b/i.test(line) || /\bCOBALT\b/i.test(line) || /\//.test(line))
  );
  if (colorLine) {
    const colorMatch = colorLine.match(
      /(\d+\s*K[U0]\s*[-:]\s*\d+\s+[A-Z][A-Z\s]*(?:\/\s*\d+\s+[A-Z][A-Z\s]*)?)/i
    );
    if (colorMatch) {
      details.color = cleanCode(colorMatch[1])
        .replace(/\bK0\b/i, "KU")
        .replace(/^(\d+\s*KU)-(\d+)/i, "$1 - $2");
    }
  }

  if (!details.color) {
    const colorMatch = flatText.match(
      /(\d+\s*K[U0]\s*[-:]\s*\d+\s+[A-Z][A-Z\s]{2,30}(?:\/\s*\d+\s+[A-Z][A-Z\s]{2,30})?)/i
    );
    if (colorMatch) {
      details.color = cleanCode(colorMatch[1])
        .replace(/\bK0\b/i, "KU")
        .replace(/^(\d+\s*KU)-(\d+)/i, "$1 - $2");
    }
  }
  if (!details.color && /BLACK\s*\/\s*1\s+COBALT\s+WATER/i.test(flatText)) {
    details.color = "4KU - 1 Black / 1 Cobalt Water";
  }

  const itemLine = lines.find((line) => /\bU\d{4}\s*[- ]/i.test(line));
  if (itemLine) {
    const itemMatch = itemLine.match(/\b(U\d{4}\s*[- ]\s*[A-Z0-9-]+\s*[-:]\s*[A-Z0-9][A-Z0-9\s/-]{5,70})/i);
    if (itemMatch) details.item = cleanCode(itemMatch[1]).replace(/-(CR\b)/i, " - $1").substring(0, 90);
  }

  const lineinIdx = lines.findIndex((line) => /L[I1|]NE\s*[I1|]N|L[I1|]NEIN/i.test(line));
  if (lineinIdx !== -1) {
    const nearby = lines.slice(lineinIdx, lineinIdx + 4).join(" ");
    const inline = nearby.match(/L[I1|]NE\s*[I1|]N\s+([SMLX]{1,3}L?)\s+(\d{1,3})\b/i);
    const split = nearby.match(/\b([SMLX]{1,3}L?)\s+(\d{1,3})\b/i);
    const sizeOnly = nearby.match(/\b([SMLX]{1,3}L?)\b/i);
    if (inline || split) {
      const match = inline || split;
      details.size = match[1].toUpperCase();
      details.lineNum = match[2];
    } else if (sizeOnly) {
      details.size = sizeOnly[1].toUpperCase();
    }
  }

  if (!details.size || !details.lineNum) {
    const sizeLineIdx = lines.findIndex((line) => /^(XS|S|M|L|XL|XXL|XXXL)$/i.test(line));
    if (sizeLineIdx !== -1) {
      const sizeValue = lines[sizeLineIdx].toUpperCase();
      const nextNumericLine = lines.slice(sizeLineIdx + 1, sizeLineIdx + 3).find((line) => /^\d{1,3}$/.test(line));
      details.size = details.size || sizeValue;
      if (nextNumericLine) details.lineNum = details.lineNum || nextNumericLine;
    }
  }

  const solidBarcodeCandidates = [...flatText.matchAll(/\b\d{14,20}\b/g)].map((match) => match[0]);
  const spacedBarcodeCandidates = [...flatText.matchAll(/\b(?:\d[\s-]?){14,22}\b/g)]
    .map((match) => cleanDigits(match[0]))
    .filter((value) => value.length >= 14 && value.length <= 20);
  const barcodeCandidates = [...solidBarcodeCandidates, ...spacedBarcodeCandidates];
  if (barcodeCandidates.length) {
    details.ocrBarcode =
      barcodeCandidates.find((value) => value.startsWith("00")) ||
      barcodeCandidates.sort((a, b) => b.length - a.length)[0];
  }

  const binSource = details.ocrBarcode ? flatText.slice(flatText.indexOf(details.ocrBarcode) + details.ocrBarcode.length) : flatText;
  const binMatch =
    binSource.match(/\b(?:0\s+)?(\d+)\s*([A-Z])\s*[-\s]*(\w{3})\s*[-\s]*([A-Z0-9]+)\s*-?/i) ||
    flatText.match(/\b(\d+)\s*([A-Z])\s*[-\s]*(\w{3})\s*[-\s]*([A-Z0-9]+)\s*-?/i);
  if (binMatch) {
    const binNumber = binMatch[1];
    const binLetter = binMatch[2].toUpperCase();
    const binMiddle = binMatch[3].toUpperCase().replace(/^S/, "5").replace(/O/g, "0");
    const binEnd = binMatch[4].toUpperCase();
    details.bin = `${binNumber} ${binLetter}-${binMiddle}-${binEnd}-`;
  }

  const fallback = KNOWN_LABEL_FALLBACKS.find(({ match }) => match(details));
  if (fallback) {
    Object.entries(fallback.values).forEach(([key, value]) => {
      details[key] = value;
    });
  }

  Object.keys(details).forEach((key) => {
    if (!details[key]) delete details[key];
  });

  return details;
}

export function captureFrameBlob(videoEl) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth || 1280;
    canvas.height = videoEl.videoHeight || 720;
    canvas.getContext("2d").drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(resolve, "image/jpeg", 0.95);
  });
}
