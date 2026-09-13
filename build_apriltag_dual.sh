#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(pwd)"
SOURCE_REPO="https://github.com/arenaxr/apriltag-js-standalone.git"
BUILD_ROOT="${ROOT_DIR}/.apriltag-dual-build"
SRC_DIR="${BUILD_ROOT}/apriltag-js-standalone"
OUT_DIR="${ROOT_DIR}/vendor-dual"
EMSDK_IMAGE="${EMSDK_IMAGE:-emscripten/emsdk:3.1.64}"

say() {
  printf '\n\033[1;36m==> %s\033[0m\n' "$*"
}

fail() {
  printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git is required."
command -v python3 >/dev/null 2>&1 || fail "python3 is required."

if [[ ! -f "${ROOT_DIR}/vendor/apriltag.js" ]]; then
  fail "Run this script from the MODUL555-TAGSCANNER project root. Expected: ./vendor/apriltag.js"
fi

say "Preparing isolated build directory"
rm -rf "${BUILD_ROOT}"
mkdir -p "${BUILD_ROOT}"
rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

say "Cloning apriltag-js-standalone and its AprilTag submodule"
git clone --recursive "${SOURCE_REPO}" "${SRC_DIR}"

if [[ ! -f "${SRC_DIR}/apriltag/tagCustom48h12.c" ]]; then
  fail "tagCustom48h12.c was not found in the cloned AprilTag source."
fi

say "Applying minimal dual-family patch"
python3 - "${SRC_DIR}" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
cfile = root / "src" / "apriltag_js.c"
makefile = root / "Makefile"

text = cfile.read_text(encoding="utf-8")

def replace_once(old: str, new: str, description: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Patch failed ({description}): expected exactly 1 occurrence, found {count}.")
    text = text.replace(old, new, 1)

replace_once(
    '#include "tag36h11.h"\n',
    '#include "tag36h11.h"\n#include "tagCustom48h12.h"\n',
    'include tagCustom48h12'
)

replace_once(
    'static apriltag_family_t *g_tf = NULL;\nstatic apriltag_detector_t *g_td;\n',
    'static apriltag_family_t *g_tf_object = NULL;\n'
    'static apriltag_family_t *g_tf_item = NULL;\n'
    'static apriltag_detector_t *g_td;\n',
    'family globals'
)

replace_once(
    'const char fmt_det_point[] = "{\\"id\\":%d, \\"corners\\": [{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f}], \\"center\\": {\\"x\\":%.2f,\\"y\\":%.2f} }";',
    'const char fmt_det_point[] = "{\\"family\\":\\"%s\\", \\"id\\":%d, \\"corners\\": [{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f}], \\"center\\": {\\"x\\":%.2f,\\"y\\":%.2f} }";',
    'non-pose JSON format'
)

replace_once(
    'const char fmt_det_point_pose[] = "{\\"id\\":%d, \\"corners\\": [{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f}], \\"center\\": {\\"x\\":%.2f,\\"y\\":%.2f}, \\"pose\\": { \\"size\\":%.2f, \\"R\\": [[%f,%f,%f],[%f,%f,%f],[%f,%f,%f]], \\"t\\": [%f,%f,%f], \\"e\\": %f %s } }";',
    'const char fmt_det_point_pose[] = "{\\"family\\":\\"%s\\", \\"id\\":%d, \\"corners\\": [{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f},{\\"x\\":%.2f,\\"y\\":%.2f}], \\"center\\": {\\"x\\":%.2f,\\"y\\":%.2f}, \\"pose\\": { \\"size\\":%.2f, \\"R\\": [[%f,%f,%f],[%f,%f,%f],[%f,%f,%f]], \\"t\\": [%f,%f,%f], \\"e\\": %f %s } }";',
    'pose JSON format'
)

old_init = (
    '    g_tf = tag36h11_create();\n'
    '    if (g_tf == NULL)\n'
    '    {\n'
    '        printf("Error initializing tag family.");\n'
    '        return -1;\n'
    '    }\n'
    '    g_td = apriltag_detector_create();'
)
new_init = (
    '    g_tf_object = tag36h11_create();\n'
    '    g_tf_item = tagCustom48h12_create();\n\n'
    '    if (g_tf_object == NULL || g_tf_item == NULL)\n'
    '    {\n'
    '        printf("Error initializing tag families.");\n'
    '        return -1;\n'
    '    }\n\n'
    '    g_td = apriltag_detector_create();'
)
replace_once(old_init, new_init, 'family initialization')

replace_once(
    '    apriltag_detector_add_family_bits(g_td, g_tf, 1);\n',
    '    apriltag_detector_add_family_bits(g_td, g_tf_object, 1);\n'
    '    apriltag_detector_add_family_bits(g_td, g_tf_item, 1);\n',
    'register families'
)

replace_once(
    '    apriltag_detector_destroy(g_td);\n    tag36h11_destroy(g_tf);',
    '    apriltag_detector_destroy(g_td);\n'
    '    tag36h11_destroy(g_tf_object);\n'
    '    tagCustom48h12_destroy(g_tf_item);\n'
    '    g_td = NULL;\n'
    '    g_tf_object = NULL;\n'
    '    g_tf_item = NULL;',
    'family destruction'
)

replace_once(
    '    if (g_tf == NULL || g_td == NULL || g_img_buf == NULL)\n',
    '    if (g_tf_object == NULL || g_tf_item == NULL || g_td == NULL || g_img_buf == NULL)\n',
    'detector readiness check'
)

replace_once(
    'snprintf(str_tmp_det, STR_DET_LEN, fmt_det_point, det->id, ',
    'snprintf(str_tmp_det, STR_DET_LEN, fmt_det_point, det->family->name, det->id, ',
    'non-pose snprintf'
)

replace_once(
    'snprintf(str_tmp_det, STR_DET_LEN, fmt_det_point_pose, det->id, ',
    'snprintf(str_tmp_det, STR_DET_LEN, fmt_det_point_pose, det->family->name, det->id, ',
    'pose snprintf'
)

cfile.write_text(text, encoding='utf-8')

m = makefile.read_text(encoding='utf-8')
old = '-e tagCircle49h12.c -e tagCustom48h12.c -e tagStandard52h13.c'
new = '-e tagCircle49h12.c -e tagStandard52h13.c'
if old not in m:
    raise SystemExit('Patch failed: Makefile tagCustom48h12 exclusion was not found.')
m = m.replace(old, new, 1)
m = m.replace('EXTRA_EXPORTED_RUNTIME_METHODS', 'EXPORTED_RUNTIME_METHODS')
makefile.write_text(m, encoding='utf-8')

print('Patch applied successfully.')
PY

say "Verifying patch before compilation"
grep -q 'tagCustom48h12_create' "${SRC_DIR}/src/apriltag_js.c" || fail "tagCustom48h12_create was not added."
grep -q '\\"family\\"' "${SRC_DIR}/src/apriltag_js.c" || fail "family field was not added to detector JSON."
if grep 'APRILTAG_SRCS' "${SRC_DIR}/Makefile" | grep -q -- '-e tagCustom48h12.c'; then
  fail "tagCustom48h12.c is still excluded from compilation."
fi

build_with_local_emcc() {
  say "Building with local Emscripten ($(emcc --version | head -n 1))"
  (
    cd "${SRC_DIR}"
    make apriltag_wasm.js
  )
}

build_with_docker() {
  command -v docker >/dev/null 2>&1 || fail "Neither local 'emcc' nor Docker was found. Install Docker Desktop or Emscripten."
  if ! docker info >/dev/null 2>&1; then
    fail "Docker is installed but Docker Desktop is not running."
  fi

  say "Building with Docker image ${EMSDK_IMAGE}"
  docker run --rm \
    -v "${SRC_DIR}:/src" \
    -w /src \
    "${EMSDK_IMAGE}" \
    bash -lc 'make apriltag_wasm.js'
}

if command -v emcc >/dev/null 2>&1; then
  build_with_local_emcc
else
  build_with_docker
fi

[[ -s "${SRC_DIR}/html/apriltag_wasm.js" ]] || fail "Build finished but apriltag_wasm.js was not produced."
[[ -s "${SRC_DIR}/html/apriltag_wasm.wasm" ]] || fail "Build finished but apriltag_wasm.wasm was not produced."

say "Creating ${OUT_DIR}"
cp "${ROOT_DIR}/vendor/apriltag.js" "${OUT_DIR}/apriltag.js"
cp "${SRC_DIR}/html/apriltag_wasm.js" "${OUT_DIR}/apriltag_wasm.js"
cp "${SRC_DIR}/html/apriltag_wasm.wasm" "${OUT_DIR}/apriltag_wasm.wasm"

python3 - "${OUT_DIR}/apriltag.js" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')
s = s.replace(
    'The apriltag dectector uses the tag36h11 family.',
    'The apriltag detector uses tag36h11 and tagCustom48h12 families.'
)
p.write_text(s, encoding='utf-8')
PY

SRC_COMMIT="$(git -C "${SRC_DIR}" rev-parse HEAD)"
APRILTAG_COMMIT="$(git -C "${SRC_DIR}/apriltag" rev-parse HEAD)"

cat > "${OUT_DIR}/BUILD_INFO.txt" <<EOF2
MODUL555 dual-family AprilTag WASM build

Families:
  tag36h11
  tagCustom48h12

Source:
  ${SOURCE_REPO}
  wrapper commit: ${SRC_COMMIT}
  apriltag commit: ${APRILTAG_COMMIT}

Output:
  apriltag.js
  apriltag_wasm.js
  apriltag_wasm.wasm

Notes:
  - Existing ./vendor was not modified.
  - Detection objects now include "family".
  - Pairing/UI logic is intentionally not included yet.
EOF2

say "Build completed"
printf '\nResult directory:\n  %s\n\n' "${OUT_DIR}"
ls -lh "${OUT_DIR}"

printf '\nNext safe test:\n'
printf '  1. Do NOT overwrite ./vendor yet.\n'
printf '  2. Temporarily point scanner.js from ../vendor/apriltag.js to ../vendor-dual/apriltag.js.\n'
printf '  3. Verify the existing tag36h11 first.\n'
printf '  4. Then test tagCustom48h12.\n'
printf '\nExpected detection objects now include:\n'
printf '  {"family":"tag36h11","id":12,...}\n'
printf '  {"family":"tagCustom48h12","id":742,...}\n'
