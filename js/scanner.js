import * as Comlink from 'https://unpkg.com/comlink/dist/esm/comlink.mjs';
import { APP_CONFIG } from './config.js';

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

    this.lastAcceptedTagId = null;
    this.lastAcceptedAt = 0;
  }

  async init() {
  const Comlink = await import(
    "https://unpkg.com/comlink/dist/esm/comlink.mjs"
  );

  this.worker = new Worker(
    new URL('../vendor/apriltag.js', import.meta.url),
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

  await this.detector.set_max_detections(1);
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
      this.drawDetections(detections);

      if (detections.length > 0) {
        const detection = detections[0];
        const now = Date.now();

        const isImmediateDuplicate =
          String(detection.id) === String(this.lastAcceptedTagId) &&
          now - this.lastAcceptedAt < APP_CONFIG.duplicateCooldownMs;

        if (!isImmediateDuplicate) {
          this.lastAcceptedTagId = detection.id;
          this.lastAcceptedAt = now;

          this.stop();
          this.onDetected(detection);
          return;
        }
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

  drawDetections(detections) {
    this.clearOverlay();

    for (const detection of detections) {
      const corners = detection.corners;

      if (!Array.isArray(corners) || corners.length < 4) {
        continue;
      }

      const ctx = this.overlayContext;

      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#22c55e';
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = 4;

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);

      for (let i = 1; i < corners.length; i += 1) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }

      ctx.closePath();
      ctx.stroke();

      if (detection.center) {
        ctx.font = '800 22px system-ui, sans-serif';
        ctx.textAlign = 'center';

        ctx.fillText(
          `ID ${detection.id}`,
          detection.center.x,
          Math.max(26, detection.center.y - 14)
        );
      }

      ctx.restore();
    }
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
