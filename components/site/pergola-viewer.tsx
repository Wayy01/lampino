"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";

// Camera and lighting are duplicated in scripts/build-pergola.mjs, which bakes
// the poster PNG below. Change one, change both, or the placeholder will visibly
// jump when WebGL takes over.
const FOV = 26;
const AZIMUTH = 0.62;
const ELEVATION = 0.3;
const FIT = 1.06;
const KEY_DIR = "vec3(0.45, 0.78, 0.44)";
const KEY_COLOR = "vec3(1.0, 0.97, 0.91)";
const SKY_COLOR = "vec3(0.83, 0.85, 0.9)";
const GROUND_COLOR = "vec3(0.44, 0.4, 0.35)";

const MIN_ELEVATION = 0.04;
const MAX_ELEVATION = 1.05;
const AUTO_SPEED = 0.1; // rad/s
const AUTO_RESUME = 3500; // ms of stillness before the turntable picks back up
const DRAG_SPEED = 0.006; // rad per CSS pixel
const FRICTION = 0.92;
const TOUCH_AXIS_LOCK = 8; // px of travel before deciding rotate vs. scroll

const VERTEX = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec4 iModel0;
in vec4 iModel1;
in vec4 iModel2;
in vec3 iNormal0;
in vec3 iNormal1;
in vec3 iNormal2;
uniform mat4 uViewProjection;
uniform vec3 uMin;
uniform vec3 uScale;
out vec3 vNormal;
void main() {
  vec4 local = vec4(uMin + aPosition * uScale, 1.0);
  vec3 world = vec3(dot(iModel0, local), dot(iModel1, local), dot(iModel2, local));
  vNormal = vec3(dot(iNormal0, aNormal), dot(iNormal1, aNormal), dot(iNormal2, aNormal));
  gl_Position = uViewProjection * vec4(world, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec3 vNormal;
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uAlpha;
out vec4 fragColor;
void main() {
  vec3 n = normalize(vNormal);
  float key = max(dot(n, ${KEY_DIR}), 0.0);
  vec3 ambient = mix(${GROUND_COLOR}, ${SKY_COLOR}, n.y * 0.5 + 0.5);
  vec3 c = uColor * (ambient * 0.62 + ${KEY_COLOR} * key * 0.85) + uEmissive;
  vec3 srgb = mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  fragColor = vec4(srgb, uAlpha);
}`;

interface Batch {
  material: number;
  vertexOffset: number;
  vertexCount: number;
  indexOffset: number;
  indexCount: number;
  instanceOffset: number;
  instanceCount: number;
  min: [number, number, number];
  max: [number, number, number];
  scale: [number, number, number];
}

interface Material {
  color: [number, number, number];
  alpha: number;
  emissive: [number, number, number];
  blend: boolean;
  doubleSided: boolean;
}

interface Model {
  materials: Material[];
  batches: Batch[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  positions: Uint16Array;
  normals: Int8Array;
  indices: Uint16Array;
  instances: Float32Array;
}

function parseModel(buffer: ArrayBuffer): Model {
  const headerLength = new Uint32Array(buffer, 0, 1)[0];
  const header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)).replace(/\0+$/, ""),
  );
  const batches: Batch[] = header.batches;
  const last = batches[batches.length - 1];
  const vertices = last.vertexOffset + last.vertexCount;
  const indexCount = last.indexOffset + last.indexCount;
  const instanceCount = last.instanceOffset + last.instanceCount;

  // Sections are written on 4-byte boundaries (see build-pergola.mjs) so each
  // one can be viewed in place rather than copied out.
  let offset = 4 + headerLength;
  const align = () => (offset += (4 - (offset % 4)) % 4);
  const positions = new Uint16Array(buffer, align(), vertices * 3);
  offset += positions.byteLength;
  const normals = new Int8Array(buffer, align(), vertices * 3);
  offset += normals.byteLength;
  const indices = new Uint16Array(buffer, align(), indexCount);
  offset += indices.byteLength;
  const instances = new Float32Array(buffer, align(), instanceCount * 24);

  return { ...header, positions, normals, indices, instances };
}

/**
 * Distance at which the model's bounding box exactly fills the viewport, solved
 * by relaxing the eight projected corners. Mirrors cameraFit in the build script.
 */
function fitDistance(model: Model, aspect: number) {
  const { min, max } = model.bounds;
  const centre = min.map((v, i) => (v + max[i]) / 2) as [number, number, number];
  const fovY = (FOV * Math.PI) / 180;
  const focal = 1 / Math.tan(fovY / 2);

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
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const corners: number[][] = [];
  for (let k = 0; k < 8; k++) {
    corners.push([
      (k & 1 ? max[0] : min[0]) - centre[0],
      (k & 2 ? max[1] : min[1]) - centre[1],
      (k & 4 ? max[2] : min[2]) - centre[2],
    ]);
  }

  let distance = Math.hypot(...max.map((v, i) => (v - min[i]) / 2)) / Math.sin(fovY / 2);
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
  return { centre, distance: distance * FIT, fovY };
}

export function PergolaViewer() {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    // Nothing is fetched or compiled until the viewer is actually on screen —
    // the poster below carries the first paint on its own.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        start(canvas, container).then((fn) => {
          if (disposed) fn?.();
          else cleanup = fn;
        });
      },
      { rootMargin: "200px" },
    );
    observer.observe(container);

    async function start(
      canvas: HTMLCanvasElement,
      container: HTMLElement,
    ): Promise<(() => void) | undefined> {
      const gl = canvas.getContext("webgl2", {
        antialias: true,
        alpha: true,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      });
      if (!gl) return;

      const response = await fetch("/pergola-lights.bin");
      if (!response.ok || disposed) return;
      const model = parseModel(await response.arrayBuffer());
      if (disposed) return;

      // ---- program ----
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
      };
      const program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
      gl.useProgram(program);

      const uniform = (name: string) => gl.getUniformLocation(program, name);
      const uViewProjection = uniform("uViewProjection");
      const uMin = uniform("uMin");
      const uScale = uniform("uScale");
      const uColor = uniform("uColor");
      const uEmissive = uniform("uEmissive");
      const uAlpha = uniform("uAlpha");

      // ---- buffers ----
      const buffer = (target: number, data: ArrayBufferView) => {
        const b = gl.createBuffer()!;
        gl.bindBuffer(target, b);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        return b;
      };
      const positionBuffer = buffer(gl.ARRAY_BUFFER, model.positions);
      const normalBuffer = buffer(gl.ARRAY_BUFFER, model.normals);
      const instanceBuffer = buffer(gl.ARRAY_BUFFER, model.instances);
      const indexBuffer = buffer(gl.ELEMENT_ARRAY_BUFFER, model.indices);

      const attribute = (name: string) => gl.getAttribLocation(program, name);
      const aPosition = attribute("aPosition");
      const aNormal = attribute("aNormal");
      const instanceRows = [
        "iModel0", "iModel1", "iModel2", "iNormal0", "iNormal1", "iNormal2",
      ].map(attribute);

      // One VAO per batch. The per-batch vertex offset stands in for the
      // baseVertex argument WebGL2 doesn't have, so batch-local indices work
      // against a single shared buffer.
      const vaos = model.batches.map((batch) => {
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(
          aPosition, 3, gl.UNSIGNED_SHORT, false, 6, batch.vertexOffset * 6,
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.enableVertexAttribArray(aNormal);
        gl.vertexAttribPointer(aNormal, 3, gl.BYTE, true, 3, batch.vertexOffset * 3);

        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
        instanceRows.forEach((location, row) => {
          gl.enableVertexAttribArray(location);
          gl.vertexAttribPointer(
            location, row < 3 ? 4 : 3, gl.FLOAT, false, 96,
            batch.instanceOffset * 96 + row * 16,
          );
          gl.vertexAttribDivisor(location, 1);
        });

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bindVertexArray(null);
        return vao;
      });

      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);

      // ---- state ----
      let azimuth = AZIMUTH;
      let elevation = ELEVATION;
      let velocity = 0;
      let lastInteraction = 0;
      let width = 0;
      let height = 0;
      let dirty = true;
      let frame = 0;
      let previous = 0;

      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
      const dpr = () => Math.min(devicePixelRatio || 1, 2);

      const resize = (cssWidth: number, cssHeight: number) => {
        const w = Math.max(1, Math.round(cssWidth * dpr()));
        const h = Math.max(1, Math.round(cssHeight * dpr()));
        if (w === width && h === height) return;
        width = w;
        height = h;
        canvas.width = w;
        canvas.height = h;
        dirty = true;
      };

      const draw = () => {
        const aspect = width / height;
        const { centre, distance, fovY } = fitDistance(model, aspect);
        const eye = [
          centre[0] + distance * Math.cos(elevation) * Math.sin(azimuth),
          centre[1] + distance * Math.sin(elevation),
          centre[2] + distance * Math.cos(elevation) * Math.cos(azimuth),
        ];
        const radius = Math.hypot(
          ...model.bounds.max.map((v, i) => (v - model.bounds.min[i]) / 2),
        );

        // view = inverse of the look-at basis, folded straight into the
        // projection so no matrix library is needed for one camera.
        const fz = eye.map((v, i) => v - centre[i]);
        const fl = Math.hypot(...fz) || 1;
        fz.forEach((v, i) => (fz[i] = v / fl));
        const rl = Math.hypot(fz[2], fz[0]) || 1;
        const fx = [fz[2] / rl, 0, -fz[0] / rl];
        const fy = [
          fz[1] * fx[2] - fz[2] * fx[1],
          fz[2] * fx[0] - fz[0] * fx[2],
          fz[0] * fx[1] - fz[1] * fx[0],
        ];
        const near = Math.max(0.05, distance - radius * 1.5);
        const far = distance + radius * 2;
        const focal = 1 / Math.tan(fovY / 2);
        const sx = focal / aspect;
        const nf = 1 / (near - far);

        const tx = -(fx[0] * eye[0] + fx[1] * eye[1] + fx[2] * eye[2]);
        const ty = -(fy[0] * eye[0] + fy[1] * eye[1] + fy[2] * eye[2]);
        const tz = -(fz[0] * eye[0] + fz[1] * eye[1] + fz[2] * eye[2]);

        gl.uniformMatrix4fv(uViewProjection, false, [
          fx[0] * sx, fy[0] * focal, fz[0] * (far + near) * nf, -fz[0],
          fx[1] * sx, fy[1] * focal, fz[1] * (far + near) * nf, -fz[1],
          fx[2] * sx, fy[2] * focal, fz[2] * (far + near) * nf, -fz[2],
          tx * sx, ty * focal, tz * (far + near) * nf + 2 * far * near * nf, -tz,
        ]);

        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let blending = false;
        let current = -1;
        model.batches.forEach((batch, i) => {
          const material = model.materials[batch.material];
          if (material.blend && !blending) {
            blending = true;
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
          }
          if (batch.material !== current) {
            current = batch.material;
            gl.uniform3fv(uColor, material.color);
            gl.uniform3fv(uEmissive, material.emissive);
            gl.uniform1f(uAlpha, material.blend ? material.alpha : 1);
            if (material.doubleSided) gl.disable(gl.CULL_FACE);
            else gl.enable(gl.CULL_FACE);
          }
          gl.uniform3fv(uMin, batch.min);
          gl.uniform3fv(uScale, batch.scale);
          gl.bindVertexArray(vaos[i]);
          gl.drawElementsInstanced(
            gl.TRIANGLES, batch.indexCount, gl.UNSIGNED_SHORT,
            batch.indexOffset * 2, batch.instanceCount,
          );
        });
      };

      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        const dt = Math.min((now - (previous || now)) / 1000, 0.05);
        previous = now;

        if (velocity) {
          azimuth += velocity * dt * 60;
          velocity *= FRICTION;
          if (Math.abs(velocity) < 0.00005) velocity = 0;
          dirty = true;
        } else if (
          !reducedMotion.matches &&
          now - lastInteraction > AUTO_RESUME
        ) {
          azimuth += AUTO_SPEED * dt;
          dirty = true;
        }

        if (dirty) {
          dirty = false;
          draw();
        }
      };

      // ---- interaction ----
      let pointer: number | null = null;
      let lastX = 0;
      let lastY = 0;
      let touchStart: { x: number; y: number } | null = null;
      let rotating = false;

      const onPointerDown = (event: PointerEvent) => {
        if (pointer !== null || !event.isPrimary) return;
        pointer = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        velocity = 0;
        lastInteraction = performance.now();
        if (event.pointerType === "touch") {
          touchStart = { x: event.clientX, y: event.clientY };
          rotating = false;
        } else {
          rotating = true;
          canvas.setPointerCapture(event.pointerId);
        }
      };

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerId !== pointer) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;

        // On touch, a mostly-vertical drag has to stay a page scroll — only
        // claim the gesture once it reads as horizontal.
        if (touchStart && !rotating) {
          const tx = event.clientX - touchStart.x;
          const ty = event.clientY - touchStart.y;
          if (Math.hypot(tx, ty) < TOUCH_AXIS_LOCK) return;
          if (Math.abs(tx) <= Math.abs(ty)) {
            pointer = null;
            touchStart = null;
            return;
          }
          rotating = true;
          canvas.setPointerCapture(event.pointerId);
        }
        if (!rotating) return;

        lastX = event.clientX;
        lastY = event.clientY;
        lastInteraction = performance.now();
        azimuth -= dx * DRAG_SPEED;
        if (!touchStart) {
          elevation = Math.min(
            MAX_ELEVATION,
            Math.max(MIN_ELEVATION, elevation + dy * DRAG_SPEED),
          );
        }
        velocity = -dx * DRAG_SPEED * 0.5;
        dirty = true;
        event.preventDefault();
      };

      const onPointerUp = (event: PointerEvent) => {
        if (event.pointerId !== pointer) return;
        pointer = null;
        touchStart = null;
        rotating = false;
        lastInteraction = performance.now();
      };

      const onKeyDown = (event: KeyboardEvent) => {
        const step = event.key === "ArrowLeft" ? -0.15 : event.key === "ArrowRight" ? 0.15 : 0;
        if (!step) return;
        azimuth += step;
        velocity = 0;
        lastInteraction = performance.now();
        dirty = true;
        event.preventDefault();
      };

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
      canvas.addEventListener("keydown", onKeyDown);

      // Only animate while on screen and while the tab is in front.
      let running = false;
      const setRunning = (next: boolean) => {
        if (next === running) return;
        running = next;
        if (next) {
          previous = 0;
          frame = requestAnimationFrame(tick);
        } else {
          cancelAnimationFrame(frame);
        }
      };
      const visibility = new IntersectionObserver(
        (entries) => setRunning(entries[0].isIntersecting && !document.hidden),
        { threshold: 0 },
      );
      visibility.observe(container);
      const onVisibilityChange = () => setRunning(!document.hidden);
      document.addEventListener("visibilitychange", onVisibilityChange);
      const sizing = new ResizeObserver(([entry]) => {
        const box = entry.contentRect;
        resize(box.width, box.height);
        if (!running && dirty) {
          dirty = false;
          draw();
        }
      });
      sizing.observe(container);

      const rect = container.getBoundingClientRect();
      resize(rect.width, rect.height);
      draw();
      dirty = false;
      setLive(true);

      return () => {
        setRunning(false);
        sizing.disconnect();
        visibility.disconnect();
        document.removeEventListener("visibilitychange", onVisibilityChange);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        canvas.removeEventListener("keydown", onKeyDown);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    }

    return () => {
      disposed = true;
      observer.disconnect();
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-[58vh] max-h-[680px] min-h-[300px] w-full select-none sm:h-[62vh]"
    >
      {/* Baked from the same model, camera and lighting as the canvas: it is
          the first paint, and the whole picture when WebGL is unavailable. */}
      <Image
        src="/pergola-lights.png"
        alt={t.arenda.modelAlt}
        fill
        priority
        sizes="(max-width: 1400px) 100vw, 1400px"
        className={`object-contain transition-opacity duration-700 ${
          live ? "opacity-0" : "opacity-100"
        }`}
      />
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label={t.arenda.modelAlt}
        className={`absolute inset-0 h-full w-full touch-pan-y outline-none transition-opacity duration-700 focus-visible:ring-2 focus-visible:ring-ring ${
          live ? "cursor-grab opacity-100 active:cursor-grabbing" : "opacity-0"
        }`}
      />
      <p className="label-mono pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 text-muted-foreground opacity-70">
        {t.arenda.modelHint}
      </p>
    </div>
  );
}
