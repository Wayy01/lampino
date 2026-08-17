/**
 * Bakes assets/3d/pergola-lights.glb into public/pergola-lights.bin.
 *
 * The export is 1244 separate meshes but only ~119 distinct geometries — the
 * same bulb repeated 472 times. Deduping them into instanced batches and
 * quantizing the attributes takes the payload from 11 MB / 1244 draw calls to
 * a few hundred KB / ~119 draws, which is what makes this viable on a phone.
 *
 *   bun scripts/build-pergola.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const SRC = "assets/3d/pergola-lights.glb";
const OUT = "public/pergola-lights.bin";
const POSTER = "public/pergola-lights.png";

// Kept in sync with components/site/pergola-viewer.tsx — the poster is the
// first frame the user sees, so any drift shows up as a jump when WebGL takes
// over. See CAMERA/lighting there.
const FOV = 26;
const AZIMUTH = 0.62;
const ELEVATION = 0.3;
const FIT = 1.06;
const BACKGROUND = [0.965, 0.957, 0.937]; // --background, #f6f4ef
const KEY_DIR = [0.45, 0.78, 0.44];
const KEY_COLOR = [1.0, 0.97, 0.91];
const SKY_COLOR = [0.83, 0.85, 0.9];
const GROUND_COLOR = [0.44, 0.4, 0.35];
const POSTER_WIDTH = 1200;
const POSTER_HEIGHT = 900;
const SUPERSAMPLE = 2;

const COMPONENT = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const NUM_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

const glb = readFileSync(SRC);
const jsonLength = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
const bin = glb.subarray(20 + jsonLength + 8);

function accessor(index) {
  const a = gltf.accessors[index];
  const view = gltf.bufferViews[a.bufferView];
  const Type = COMPONENT[a.componentType];
  const stride = NUM_COMPONENTS[a.type];
  const offset = (view.byteOffset || 0) + (a.byteOffset || 0);
  const out = new Type(a.count * stride);
  // The buffer offset is not guaranteed to be aligned to the element size.
  Buffer.from(out.buffer).set(bin.subarray(offset, offset + out.byteLength));
  return out;
}

// ---- matrices -------------------------------------------------------------

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function fromTRS(node) {
  if (node.matrix) return node.matrix;
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

/** Inverse-transpose of the upper 3x3, so non-uniformly scaled parts light correctly. */
function normalMatrix(m) {
  const a = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const [a00, a01, a02, a10, a11, a12, a20, a21, a22] = a;
  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;
  const det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const d = 1 / det;
  // inverse, then transposed by writing rows as columns
  return [
    b01 * d, b11 * d, b21 * d,
    (-a22 * a01 + a02 * a21) * d, (a22 * a00 - a02 * a20) * d, (-a21 * a00 + a01 * a20) * d,
    (a12 * a01 - a02 * a11) * d, (-a12 * a00 + a02 * a10) * d, (a11 * a00 - a01 * a10) * d,
  ];
}

// ---- flatten the scene ----------------------------------------------------

/** @type {Map<string, {geometry: object, instances: number[][]}>} */
const batches = new Map();
const geometryCache = new Map();

function walk(nodeIndex, parent) {
  const node = gltf.nodes[nodeIndex];
  const world = multiply(parent, fromTRS(node));

  if (node.mesh != null) {
    for (const prim of gltf.meshes[node.mesh].primitives) {
      const position = accessor(prim.attributes.POSITION);
      const normal = accessor(prim.attributes.NORMAL);
      const index = accessor(prim.indices);

      const hash = createHash("md5")
        .update(Buffer.from(position.buffer))
        .update(Buffer.from(normal.buffer))
        .update(Buffer.from(index.buffer))
        .digest("hex");
      const key = `${hash}:${prim.material}`;

      if (!geometryCache.has(hash)) {
        geometryCache.set(hash, { position, normal, index });
      }
      if (!batches.has(key)) {
        batches.set(key, {
          geometry: geometryCache.get(hash),
          material: prim.material,
          instances: [],
        });
      }
      batches.get(key).instances.push(world);
    }
  }
  for (const child of node.children || []) walk(child, world);
}

for (const root of gltf.scenes[gltf.scene ?? 0].nodes) walk(root, IDENTITY);

// ---- quantize -------------------------------------------------------------

const positions = [];
const normals = [];
const indices = [];
const instances = [];
const meta = [];

// Draw opaque geometry first so blended materials (the veil) composite over it.
const ordered = [...batches.values()].sort(
  (a, b) =>
    Number(gltf.materials[a.material].alphaMode === "BLEND") -
    Number(gltf.materials[b.material].alphaMode === "BLEND"),
);

let vertexOffset = 0;
let indexOffset = 0;
let instanceOffset = 0;

for (const batch of ordered) {
  const { position, normal, index } = batch.geometry;
  const count = position.length / 3;

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) {
      const v = position[i * 3 + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }
  const scale = max.map((v, c) => (v - min[c]) / 65535 || 1);

  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) {
      positions.push(Math.round((position[i * 3 + c] - min[c]) / scale[c]));
      normals.push(Math.max(-127, Math.min(127, Math.round(normal[i * 3 + c] * 127))));
    }
  }
  for (let i = 0; i < index.length; i++) indices.push(index[i]);

  for (const m of batch.instances) {
    const n = normalMatrix(m);
    // three rows of the 3x4 model matrix, then three rows of the normal matrix
    instances.push(
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      n[0], n[3], n[6], 0,
      n[1], n[4], n[7], 0,
      n[2], n[5], n[8], 0,
    );
  }

  meta.push({
    material: batch.material,
    vertexOffset,
    vertexCount: count,
    indexOffset,
    indexCount: index.length,
    instanceOffset,
    instanceCount: batch.instances.length,
    min,
    max,
    scale,
  });

  vertexOffset += count;
  indexOffset += index.length;
  instanceOffset += batch.instances.length;
}

// ---- materials ------------------------------------------------------------

const materials = gltf.materials.map((m) => {
  const pbr = m.pbrMetallicRoughness || {};
  const base = pbr.baseColorFactor || [1, 1, 1, 1];
  const strength =
    m.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
  return {
    color: base.slice(0, 3),
    alpha: base[3],
    metallic: pbr.metallicFactor ?? 1,
    roughness: pbr.roughnessFactor ?? 1,
    emissive: (m.emissiveFactor || [0, 0, 0]).map((v) => v * strength),
    blend: m.alphaMode === "BLEND",
    doubleSided: !!m.doubleSided,
  };
});

// Centre the model on its own bounds so the viewer needs no magic numbers.
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
for (const b of meta) {
  for (let i = 0; i < b.instanceCount; i++) {
    const o = (b.instanceOffset + i) * 24;
    for (let k = 0; k < 8; k++) {
      const corner = [
        k & 1 ? b.max[0] : b.min[0],
        k & 2 ? b.max[1] : b.min[1],
        k & 4 ? b.max[2] : b.min[2],
      ];
      for (let c = 0; c < 3; c++) {
        const v =
          instances[o + c * 4] * corner[0] +
          instances[o + c * 4 + 1] * corner[1] +
          instances[o + c * 4 + 2] * corner[2] +
          instances[o + c * 4 + 3];
        if (v < bounds.min[c]) bounds.min[c] = v;
        if (v > bounds.max[c]) bounds.max[c] = v;
      }
    }
  }
}

// ---- write ----------------------------------------------------------------

const positionData = new Uint16Array(positions);
const normalData = new Int8Array(normals);
const indexData = new Uint16Array(indices);
const instanceData = new Float32Array(instances);

const header = Buffer.from(
  JSON.stringify({ materials, batches: meta, bounds }),
  "utf8",
);
// Every section starts on a 4-byte boundary so the reader can wrap it in a
// typed array view without copying.
const parts = [];
let cursor = 4;
const push = (buf) => {
  const padding = (4 - (cursor % 4)) % 4;
  if (padding) parts.push(Buffer.alloc(padding));
  cursor += padding + buf.length;
  parts.push(buf);
};
const headerPad = (4 - (header.length % 4)) % 4;
push(Buffer.concat([header, Buffer.alloc(headerPad)]));
push(Buffer.from(positionData.buffer));
push(Buffer.from(normalData.buffer));
push(Buffer.from(indexData.buffer));
push(Buffer.from(instanceData.buffer));

writeFileSync(
  OUT,
  Buffer.concat([
    Buffer.from(Uint32Array.of(header.length + headerPad).buffer),
    ...parts,
  ]),
);

// ---- poster ---------------------------------------------------------------

// A software rasterizer for the fallback / placeholder image. It mirrors the
// shader in the viewer (hemisphere ambient + one key light + emissive) so the
// PNG and the live canvas are the same picture.

function shade(material, normal) {
  const key = Math.max(
    0,
    normal[0] * KEY_DIR[0] + normal[1] * KEY_DIR[1] + normal[2] * KEY_DIR[2],
  );
  const hemi = normal[1] * 0.5 + 0.5;
  return material.color.map((c, i) => {
    const ambient = GROUND_COLOR[i] + (SKY_COLOR[i] - GROUND_COLOR[i]) * hemi;
    return c * (ambient * 0.62 + KEY_COLOR[i] * key * 0.85) + material.emissive[i];
  });
}

/**
 * Distance at which the bounding box exactly fills the viewport. Solved by
 * projecting the eight corners and relaxing the distance a few times, because
 * the closed-form bounding-sphere fit leaves a lot of empty frame on a model
 * this wide and flat.
 */
function cameraFit(bounds, aspect) {
  const centre = bounds.min.map((v, i) => (v + bounds.max[i]) / 2);
  const radius = Math.hypot(...bounds.max.map((v, i) => (v - bounds.min[i]) / 2));
  const fovY = (FOV * Math.PI) / 180;
  const focal = 1 / Math.tan(fovY / 2);

  const corners = [];
  for (let k = 0; k < 8; k++) {
    corners.push([
      (k & 1 ? bounds.max[0] : bounds.min[0]) - centre[0],
      (k & 2 ? bounds.max[1] : bounds.min[1]) - centre[1],
      (k & 4 ? bounds.max[2] : bounds.min[2]) - centre[2],
    ]);
  }
  const forward = [
    Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    Math.sin(ELEVATION),
    Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  ];
  const rl = Math.hypot(forward[2], forward[0]) || 1;
  const right = [forward[2] / rl, 0, -forward[0] / rl];
  const up = [
    forward[1] * right[2] - forward[2] * right[1],
    forward[2] * right[0] - forward[0] * right[2],
    forward[0] * right[1] - forward[1] * right[0],
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  let distance = radius / Math.sin(fovY / 2);
  for (let i = 0; i < 8; i++) {
    let worst = 0;
    for (const c of corners) {
      const z = distance - dot(c, forward);
      if (z <= 0.01) continue;
      worst = Math.max(
        worst,
        Math.abs((dot(c, right) * focal) / (aspect * z)),
        Math.abs((dot(c, up) * focal) / z),
      );
    }
    if (!worst) break;
    distance *= worst;
  }
  return { centre, radius, distance: distance * FIT, fovY };
}

function renderPoster() {
  const width = POSTER_WIDTH * SUPERSAMPLE;
  const height = POSTER_HEIGHT * SUPERSAMPLE;
  const aspect = width / height;
  const { centre, radius, distance, fovY } = cameraFit(bounds, aspect);

  const eye = [
    centre[0] + distance * Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    centre[1] + distance * Math.sin(ELEVATION),
    centre[2] + distance * Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  ];
  const fz = [0, 1, 2].map((i) => eye[i] - centre[i]);
  const fl = Math.hypot(...fz);
  fz.forEach((v, i) => (fz[i] = v / fl));
  // right = normalize(cross(worldUp, fz)) with worldUp = +Y
  const rl = Math.hypot(fz[2], fz[0]) || 1;
  const fx = [fz[2] / rl, 0, -fz[0] / rl];
  const fy = [
    fz[1] * fx[2] - fz[2] * fx[1],
    fz[2] * fx[0] - fz[0] * fx[2],
    fz[0] * fx[1] - fz[1] * fx[0],
  ];

  const near = distance - radius * 1.5;
  const focal = 1 / Math.tan(fovY / 2);

  const colour = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    colour[i * 3] = BACKGROUND[0];
    colour[i * 3 + 1] = BACKGROUND[1];
    colour[i * 3 + 2] = BACKGROUND[2];
  }
  const depth = new Float32Array(width * height).fill(Infinity);

  const project = (p) => {
    const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
    const vx = d[0] * fx[0] + d[1] * fx[1] + d[2] * fx[2];
    const vy = d[0] * fy[0] + d[1] * fy[1] + d[2] * fy[2];
    const vz = -(d[0] * fz[0] + d[1] * fz[1] + d[2] * fz[2]);
    return {
      x: ((vx * (focal / aspect)) / vz + 1) * 0.5 * width,
      y: (1 - ((vy * focal) / vz + 1) * 0.5) * height,
      z: vz,
    };
  };

  for (const batch of meta) {
    const material = materials[batch.material];
    for (let inst = 0; inst < batch.instanceCount; inst++) {
      const o = (batch.instanceOffset + inst) * 24;
      const world = (v) => [0, 1, 2].map((c) =>
        instances[o + c * 4] * v[0] +
        instances[o + c * 4 + 1] * v[1] +
        instances[o + c * 4 + 2] * v[2] +
        instances[o + c * 4 + 3],
      );
      const worldNormal = (v) => {
        const n = [0, 1, 2].map((c) =>
          instances[o + 12 + c * 4] * v[0] +
          instances[o + 12 + c * 4 + 1] * v[1] +
          instances[o + 12 + c * 4 + 2] * v[2],
        );
        const l = Math.hypot(...n) || 1;
        return n.map((c) => c / l);
      };

      const verts = [];
      for (let i = 0; i < batch.vertexCount; i++) {
        const q = (batch.vertexOffset + i) * 3;
        const p = world([
          batch.min[0] + positions[q] * batch.scale[0],
          batch.min[1] + positions[q + 1] * batch.scale[1],
          batch.min[2] + positions[q + 2] * batch.scale[2],
        ]);
        const n = worldNormal([
          normals[q] / 127,
          normals[q + 1] / 127,
          normals[q + 2] / 127,
        ]);
        verts.push({ ...project(p), colour: shade(material, n) });
      }

      for (let t = 0; t < batch.indexCount; t += 3) {
        const a = verts[indices[batch.indexOffset + t]];
        const b = verts[indices[batch.indexOffset + t + 1]];
        const c = verts[indices[batch.indexOffset + t + 2]];
        if (a.z < near || b.z < near || c.z < near) continue;
        const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
        if (area === 0) continue;

        const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
        const x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
        const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
        const y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));

        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const px = x + 0.5;
            const py = y + 0.5;
            let w0 = ((b.x - a.x) * (py - a.y) - (px - a.x) * (b.y - a.y)) / area;
            let w1 = ((px - a.x) * (c.y - a.y) - (c.x - a.x) * (py - a.y)) / area;
            const w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            // w0 weights c, w1 weights b, w2 weights a
            const z = 1 / (w2 / a.z + w1 / b.z + w0 / c.z);
            const idx = y * width + x;
            if (z >= depth[idx]) continue;
            const alpha = material.blend ? material.alpha : 1;
            if (alpha >= 1) depth[idx] = z;
            for (let ch = 0; ch < 3; ch++) {
              const v =
                a.colour[ch] * w2 + b.colour[ch] * w1 + c.colour[ch] * w0;
              colour[idx * 3 + ch] =
                colour[idx * 3 + ch] * (1 - alpha) + v * alpha;
            }
          }
        }
      }
    }
  }

  // downsample and encode
  const raw = Buffer.alloc((POSTER_WIDTH * 3 + 1) * POSTER_HEIGHT);
  const s = SUPERSAMPLE;
  for (let y = 0; y < POSTER_HEIGHT; y++) {
    const row = y * (POSTER_WIDTH * 3 + 1);
    for (let x = 0; x < POSTER_WIDTH; x++) {
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0;
        for (let sy = 0; sy < s; sy++) {
          for (let sx = 0; sx < s; sx++) {
            sum += colour[((y * s + sy) * width + x * s + sx) * 3 + ch];
          }
        }
        const v = sum / (s * s);
        // linear -> sRGB, matching the WebGL context's sRGB drawing buffer
        const srgb =
          v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
        raw[row + 1 + x * 3 + ch] = Math.max(0, Math.min(255, Math.round(srgb * 255)));
      }
    }
  }

  const chunk = (type, data) => {
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    out.writeInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(POSTER_WIDTH, 0);
  ihdr.writeUInt32BE(POSTER_HEIGHT, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolour
  writeFileSync(
    POSTER,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) | 0;
}

renderPoster();

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(
  `${OUT}: ${meta.length} batches, ${instanceOffset} instances, ` +
    `${vertexOffset} verts, ${indexOffset / 3} tris`,
);
console.log(
  `  header ${kb(header.length)} · pos ${kb(positionData.byteLength)} · ` +
    `nrm ${kb(normalData.byteLength)} · idx ${kb(indexData.byteLength)} · ` +
    `inst ${kb(instanceData.byteLength)}`,
);
