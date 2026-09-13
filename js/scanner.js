import * as Comlink from 'https://unpkg.com/comlink/dist/esm/comlink.mjs';
import { APP_CONFIG } from './config.js';

const OBJECT_FAMILY = 'tag36h11';
const ITEM_FAMILY = 'tagCustom48h12';

export class AprilTagScanner {
  constructor(videoElement, overlayElement, onDetected) {
    this.video = videoElement;
    this.overlay = overlayElement;
    this.overlayContext = overlayElement.getContext('2d');

    this.processingCanvas = document.createElement('canvas');
    this.processingContext = this.processingCanvas.getContext('2d', {
      willReadFrequently: true
    });

    this.onDetected = onDetected;
    this.worker = null;
    this.detector = null;

    this.running = false;
    this.processing = false;
    this.timerId = null;
  }

  async init() {
    const Comlink = await import(
      'https://unpkg.com/comlink/dist/esm/comlink.mjs'
    );

    this.worker = new Worker(
      new URL('../vendor-dual/apriltag.js', import.meta.url),
      { type: 'classic' }
    );

    const Apriltag = Comlink.wrap(this.worker);
    let resolveReady;

    const readyPromise = new Promise((resolve) => {
      resolveReady = resolve;
    });

    this.detector = await new Apriltag(
      Comlink.proxy(() => {
        resolveReady();
      })
    );

    await readyPromise;

    await this.detector.set_max_detections(4);
    await this.detector.set_return_pose(0);
    await this.detector.set_return_solutions(0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.scheduleNext(0);
  }

  stop() {
    this.running = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  resume() {
    this.clearOverlay();
    this.start();
  }

  scheduleNext(delay = APP_CONFIG.scanIntervalMs) {
    if (!this.running) return;

    this.timerId = window.setTimeout(() => {
      this.timerId = null;
      this.scanOnce();
    }, delay);
  }

  async scanOnce() {
    if (!this.running) return;

    if (
      this.processing ||
      !this.video.videoWidth ||
      !this.video.videoHeight
    ) {
      this.scheduleNext();
      return;
    }

    this.processing = true;

    try {
      const detections = await this.detectFrame();
      const pair = this.findPair(detections);

      this.drawDetections(detections, pair);

      if (pair) {
        this.stop();
        this.onDetected(pair);
        return;
      }
    } catch (error) {
      console.error('Ошибка распознавания AprilTag:', error);
    } finally {
      this.processing = false;
    }

    this.scheduleNext();
  }

  async detectFrame() {
    const sourceWidth = this.video.videoWidth;
    const sourceHeight = this.video.videoHeight;
    const width = Math.min(APP_CONFIG.processingWidth, sourceWidth);
    const height = Math.round(width * (sourceHeight / sourceWidth));

    if (
      this.processingCanvas.width !== width ||
      this.processingCanvas.height !== height
    ) {
      this.processingCanvas.width = width;
      this.processingCanvas.height = height;
      this.overlay.width = width;
      this.overlay.height = height;
    }

    this.processingContext.drawImage(
      this.video,
      0,
      0,
      width,
      height
    );

    const imageData = this.processingContext.getImageData(
      0,
      0,
      width,
      height
    );

    const rgba = imageData.data;
    const grayscale = new Uint8Array(width * height);

    for (
      let src = 0, dst = 0;
      src < rgba.length;
      src += 4, dst += 1
    ) {
      grayscale[dst] =
        (rgba[src] * 77 +
          rgba[src + 1] * 150 +
          rgba[src + 2] * 29) >> 8;
    }

    const result = await this.detector.detect(
      Comlink.transfer(grayscale, [grayscale.buffer]),
      width,
      height
    );

    return Array.isArray(result) ? result : [];
  }

  findPair(detections) {
    const objectTags = detections.filter(
      (detection) => detection.family === OBJECT_FAMILY
    );
    const itemTags = detections.filter(
      (detection) => detection.family === ITEM_FAMILY
    );

    if (objectTags.length === 0 || itemTags.length === 0) {
      return null;
    }

    let bestPair = null;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;

    for (const objectTag of objectTags) {
      const objectCenter = this.getDetectionCenter(objectTag);
      if (!objectCenter) continue;

      for (const itemTag of itemTags) {
        const itemCenter = this.getDetectionCenter(itemTag);
        if (!itemCenter) continue;

        const dx = objectCenter.x - itemCenter.x;
        const dy = objectCenter.y - itemCenter.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < bestDistanceSquared) {
          bestDistanceSquared = distanceSquared;
          bestPair = { objectTag, itemTag };
        }
      }
    }

    return bestPair;
  }

  getDetectionCenter(detection) {
    if (
      detection?.center &&
      Number.isFinite(detection.center.x) &&
      Number.isFinite(detection.center.y)
    ) {
      return detection.center;
    }

    if (!Array.isArray(detection?.corners) || detection.corners.length < 4) {
      return null;
    }

    const sum = detection.corners.reduce(
      (acc, corner) => ({
        x: acc.x + Number(corner.x),
        y: acc.y + Number(corner.y)
      }),
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / detection.corners.length,
      y: sum.y / detection.corners.length
    };
  }

  drawDetections(detections, pair) {
    this.clearOverlay();

    const pairedDetections = pair
      ? new Set([pair.objectTag, pair.itemTag])
      : new Set();

    for (const detection of detections) {
      const isPaired = pairedDetections.has(detection);

      if (isPaired) {
        this.drawTagContour(detection, '#22c55e', '#ffffff', false);
      } else {
        this.drawTagContour(detection, '#2563eb', '#ffffff', true);
      }
    }

    if (pair) {
      this.drawPairRectangle(pair);
    }
  }

  drawTagContour(detection, strokeColor, textColor, doubleStroke) {
    const corners = detection.corners;

    if (!Array.isArray(corners) || corners.length < 4) {
      return;
    }

    const ctx = this.overlayContext;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 4;

    const tracePath = () => {
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);

      for (let i = 1; i < corners.length; i += 1) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }

      ctx.closePath();
    };

    if (doubleStroke) {
      ctx.lineWidth = 7;
      ctx.strokeStyle = strokeColor;
      tracePath();
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      tracePath();
      ctx.stroke();
    } else {
      ctx.lineWidth = 4;
      ctx.strokeStyle = strokeColor;
      tracePath();
      ctx.stroke();
    }

    const center = this.getDetectionCenter(detection);

    if (center) {
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = textColor;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.lineWidth = 4;

      const label = `${detection.family} · ID ${detection.id}`;
      const y = Math.max(24, center.y - 12);

      ctx.strokeText(label, center.x, y);
      ctx.fillText(label, center.x, y);
    }

    ctx.restore();
  }

  drawPairRectangle(pair) {
    const allCorners = [
      ...(pair.objectTag.corners || []),
      ...(pair.itemTag.corners || [])
    ];

    if (allCorners.length < 8) {
      return;
    }

    const xs = allCorners.map((corner) => Number(corner.x));
    const ys = allCorners.map((corner) => Number(corner.y));

    const padding = 10;
    const left = Math.max(2, Math.min(...xs) - padding);
    const top = Math.max(2, Math.min(...ys) - padding);
    const right = Math.min(this.overlay.width - 2, Math.max(...xs) + padding);
    const bottom = Math.min(this.overlay.height - 2, Math.max(...ys) + padding);

    const ctx = this.overlayContext;

    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#22c55e';
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 4;
    ctx.strokeRect(left, top, right - left, bottom - top);

    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.lineWidth = 4;

    const label =
      `ОБЪЕКТ ${pair.objectTag.id} · ИЗДЕЛИЕ ${pair.itemTag.id}`;

    const labelX = left + 4;
    const labelY = Math.max(22, top - 6);

    ctx.strokeText(label, labelX, labelY);
    ctx.fillText(label, labelX, labelY);

    ctx.restore();
  }

  clearOverlay() {
    this.overlayContext.clearRect(
      0,
      0,
      this.overlay.width,
      this.overlay.height
    );
  }

  destroy() {
    this.stop();
    this.clearOverlay();

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
