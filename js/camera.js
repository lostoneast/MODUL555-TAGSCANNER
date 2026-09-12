export class CameraController {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
  }

  async start() {
    if (!window.isSecureContext) {
      throw new Error(
        "Доступ к камере разрешён только в безопасном контексте. " +
        "Используйте HTTPS или откройте приложение через http://localhost."
      );
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Этот браузер не поддерживает navigator.mediaDevices.getUserMedia().");
    }

    this.stop();

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;

    await this.video.play();

    if (!this.video.videoWidth) {
      await new Promise((resolve) => {
        this.video.addEventListener("loadedmetadata", resolve, { once: true });
      });
    }

    return {
      width: this.video.videoWidth,
      height: this.video.videoHeight
    };
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
    }

    this.stream = null;
    this.video.srcObject = null;
  }
}
