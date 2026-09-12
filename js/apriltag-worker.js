importScripts('../vendor/apriltag_wasm.js');
importScripts('https://unpkg.com/comlink/dist/umd/comlink.js');

const WASM_BASE = '../vendor/';

class Apriltag {
  constructor(onDetectorReadyCallback) {
    this.onDetectorReadyCallback = onDetectorReadyCallback;

    this._opt = {
      quad_decimate: 2.0,
      quad_sigma: 0.0,
      nthreads: 1,
      refine_edges: 1,
      max_detections: 0,
      return_pose: 1,
      return_solutions: 1
    };

    AprilTagWasm({
      locateFile: (path) => WASM_BASE + path
    }).then((Module) => {
      this.onWasmInit(Module);
    });
  }

  onWasmInit(Module) {
    this._Module = Module;

    this._init = Module.cwrap('atagjs_init', 'number', []);
    this._destroy = Module.cwrap('atagjs_destroy', 'number', []);
    this._set_detector_options = Module.cwrap(
      'atagjs_set_detector_options',
      'number',
      ['number', 'number', 'number', 'number', 'number', 'number', 'number']
    );
    this._set_pose_info = Module.cwrap(
      'atagjs_set_pose_info',
      'number',
      ['number', 'number', 'number', 'number']
    );
    this._set_img_buffer = Module.cwrap(
      'atagjs_set_img_buffer',
      'number',
      ['number', 'number', 'number']
    );
    this._atagjs_set_tag_size = Module.cwrap(
      'atagjs_set_tag_size',
      null,
      ['number', 'number']
    );
    this._detect = Module.cwrap('atagjs_detect', 'number', []);

    this._init();
    this._applyOptions();
    this.onDetectorReadyCallback();
  }

  _applyOptions() {
    this._set_detector_options(
      this._opt.quad_decimate,
      this._opt.quad_sigma,
      this._opt.nthreads,
      this._opt.refine_edges,
      this._opt.max_detections,
      this._opt.return_pose,
      this._opt.return_solutions
    );
  }

  detect(grayscaleImg, imgWidth, imgHeight) {
    const imgBuffer = this._set_img_buffer(imgWidth, imgHeight, imgWidth);

    if (imgWidth * imgHeight < grayscaleImg.length) {
      return { result: 'Image data too large.' };
    }

    this._Module.HEAPU8.set(grayscaleImg, imgBuffer);

    const strJsonPtr = this._detect();
    const strJsonLen = this._Module.getValue(strJsonPtr, 'i32');

    if (strJsonLen === 0) {
      return [];
    }

    const strJsonStrPtr = this._Module.getValue(strJsonPtr + 4, 'i32');
    const strJsonView = new Uint8Array(
      this._Module.HEAP8.buffer,
      strJsonStrPtr,
      strJsonLen
    );

    let detectionsJson = '';

    for (let i = 0; i < strJsonLen; i += 1) {
      detectionsJson += String.fromCharCode(strJsonView[i]);
    }

    return JSON.parse(detectionsJson);
  }

  set_camera_info(fx, fy, cx, cy) {
    this._set_pose_info(fx, fy, cx, cy);
  }

  set_tag_size(tagid, size) {
    this._atagjs_set_tag_size(tagid, size);
  }

  set_max_detections(maxDetections) {
    this._opt.max_detections = maxDetections;
    this._applyOptions();
  }

  set_return_pose(returnPose) {
    this._opt.return_pose = returnPose;
    this._applyOptions();
  }

  set_return_solutions(returnSolutions) {
    this._opt.return_solutions = returnSolutions;
    this._applyOptions();
  }
}

Comlink.expose(Apriltag);
