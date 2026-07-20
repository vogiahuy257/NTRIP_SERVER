#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-/home/ghuy/NTRIP/NTRIP_SERVER/ntrip_caster}"
MODEL_DIR="${PROJECT_ROOT}/public/models/ntrip"

SOURCE="${MODEL_DIR}/base-station.glb"
BACKUP="${MODEL_DIR}/base-station-original.glb"
OUTPUT="${MODEL_DIR}/base-station-map.glb"
WORK_DIR="${MODEL_DIR}/.optimize-base-station"

SIMPLIFY_RATIO="${SIMPLIFY_RATIO:-0.03}"
SIMPLIFY_ERROR="${SIMPLIFY_ERROR:-0.01}"

if [[ ! -f "${SOURCE}" ]]; then
    echo "Missing source model: ${SOURCE}" >&2
    exit 1
fi

cd "${PROJECT_ROOT}"

echo "glTF Transform:"
npx gltf-transform --version

mkdir -p "${WORK_DIR}"

if [[ ! -f "${BACKUP}" ]]; then
    cp "${SOURCE}" "${BACKUP}"
fi

echo
echo "1/7  Deduplicate..."
npx gltf-transform dedup \
    "${BACKUP}" \
    "${WORK_DIR}/01-dedup.glb"

echo
echo "2/7  Flatten transforms..."
npx gltf-transform flatten \
    "${WORK_DIR}/01-dedup.glb" \
    "${WORK_DIR}/02-flatten.glb"

echo
echo "3/7  Join compatible meshes to reduce draw calls..."
npx gltf-transform join \
    "${WORK_DIR}/02-flatten.glb" \
    "${WORK_DIR}/03-join.glb"

echo
echo "4/7  Weld identical vertices..."
npx gltf-transform weld \
    "${WORK_DIR}/03-join.glb" \
    "${WORK_DIR}/04-weld.glb"

echo
echo "5/7  Simplify geometry..."
echo "     ratio=${SIMPLIFY_RATIO}, error=${SIMPLIFY_ERROR}"
npx gltf-transform simplify \
    "${WORK_DIR}/04-weld.glb" \
    "${WORK_DIR}/05-simplified.glb" \
    --ratio "${SIMPLIFY_RATIO}" \
    --error "${SIMPLIFY_ERROR}"

echo
echo "6/7  Optimize, Meshopt-compress geometry, WebP-compress texture..."
npx gltf-transform optimize \
    "${WORK_DIR}/05-simplified.glb" \
    "${OUTPUT}" \
    --compress meshopt \
    --texture-compress webp

echo
echo "7/7  Validate and inspect result..."
npx gltf-transform validate "${OUTPUT}"
npx gltf-transform inspect "${OUTPUT}"

echo
echo "Created:"
du -h "${BACKUP}" "${OUTPUT}"

echo
echo "Output model: ${OUTPUT}"
echo "The dashboard URL is: /models/ntrip/base-station-map.glb"
