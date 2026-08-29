"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // 1. Lenis Smooth Scrolling
    const lenis = new Lenis({ smoothWheel: true });
    let rafId: number;
    function raf(t: number) {
      lenis.raf(t);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // 2. WebGL Fluid Simulation
    let destroyFluid: () => void;
    if (canvasRef.current) {
      destroyFluid = fluidSimulation(canvasRef.current);
    }

    // 3. Staggered Reveals
    const EASE_OUT_CUBIC = "cubic-bezier(0.33, 1, 0.68, 1)";
    const wordSpans: HTMLElement[] = [];
    const blocks: HTMLElement[] = [];

    if (containerRef.current) {
      containerRef.current.querySelectorAll<HTMLElement>("[data-words]").forEach((el) => {
        const base = parseInt(el.dataset.words || "0", 10);
        const stagger = parseInt(el.dataset.stagger || "0", 10);
        const dur = parseInt(el.dataset.dur || "0", 10);
        const from = parseInt(el.dataset.from || "0", 10);
        const text = el.textContent?.trim() || "";
        const words = text.split(/\s+/);
        
        el.textContent = "";
        
        words.forEach((w, i) => {
          const span = document.createElement("span");
          span.className = "word";
          span.textContent = w;
          span.style.transform = `translateY(${from}px)`;
          span.style.opacity = "0";
          span.style.display = "inline-block";
          span.style.transition = `transform ${dur}ms ${EASE_OUT_CUBIC}, opacity ${dur}ms ${EASE_OUT_CUBIC}`;
          span.style.transitionDelay = `${base + i * stagger}ms`;
          
          el.appendChild(span);
          el.appendChild(document.createTextNode(" "));
          wordSpans.push(span);
        });
      });

      containerRef.current.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        const delay = el.dataset.reveal;
        const y = el.dataset.y;
        el.style.transform = `translateY(${y})`;
        el.style.opacity = "0";
        el.style.transition = `opacity 700ms ${EASE_OUT_CUBIC}, transform 700ms ${EASE_OUT_CUBIC}`;
        el.style.transitionDelay = `${delay}ms`;
        blocks.push(el);
      });

      // Trigger reveals
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          blocks.forEach((el) => {
            el.style.opacity = "1";
            el.style.transform = "none";
          });
          wordSpans.forEach((s) => {
            s.style.transform = "translateY(0)";
            s.style.opacity = "1";
          });
        });
      });
    }

    // Cleanup when component unmounts
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      if (destroyFluid) destroyFluid();
    };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
      <section className="hero" ref={containerRef}>
        {/* 1. fluid canvas */}
        <canvas className="fluid-canvas" aria-hidden="true" ref={canvasRef}></canvas>

        {/* 2. scrim */}
        <div className="scrim" aria-hidden="true"></div>

        {/* 3. top nav */}
        <header className="nav" data-reveal="150" data-y="-0.75rem">
          <a className="brand" href="/">
            <svg className="brand-glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M2.5 9c2.5 0 2.5 4.2 5 4.2S10 9 12 9s2.5 4.2 5 4.2S19.5 9 21.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M2.5 15c2.5 0 2.5 4.2 5 4.2S10 15 12 15s2.5 4.2 5 4.2S19.5 15 21.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
            </svg>
            <span>Flowstate</span>
          </a>

          <nav className="nav-pill">
            <a href="#how-it-works">How it works?</a>
            <a href="#pricing">Pricing</a>
            <a href="#products">Products</a>
            <a href="#blog">Blog</a>
          </nav>

          <a className="pill-btn" href="#get-started">Get Started</a>
        </header>

        {/* 4. center column */}
        <div className="column">
          <p className="badge" data-reveal="320" data-y="1.25rem">10K+ already in flow</p>

          <h1 className="heading" data-words="480" data-stagger="85" data-dur="720" data-from="26">
            Deep Work in a Distracted World
          </h1>

          <p className="subline" data-words="1150" data-stagger="22" data-dur="600" data-from="14">
            Cut through the noise, reclaim your attention, and do work that truly matters.
          </p>

          <div className="form-wrap" data-reveal="1450" data-y="1.25rem">
            <form className="waitlist" noValidate onSubmit={(e) => e.preventDefault()}>
              <div className="waitlist-bar">
                <input type="email" required placeholder="Enter your email" aria-label="Enter your email" />
                <button type="submit" className="pill-btn">Join Waitlist</button>
              </div>
            </form>
          </div>
        </div>

        {/* 5. footer */}
        <footer className="footer" data-reveal="1650" data-y="1.25rem">
          © 2026 Flowstate — engineered for deep work.
        </footer>
      </section>
    </>
  );
}

// --- CSS STYLES ---
const cssStyles = `
  /* ---- reset ---- */
  * { margin: 0; box-sizing: border-box; }
  a { text-decoration: none; color: inherit; }
  button { border: none; background: none; font: inherit; cursor: pointer; }

  /* ---- adaptive rem grid ---- */
  html { font-size: 16px; }
  @media (max-width: 1920px) { html { font-size: 0.833333vw; } } 
  @media (max-width: 1440px) { html { font-size: 1.111111vw; } } 
  @media (max-width: 1024px) { html { font-size: 1.5625vw;   } } 
  @media (max-width: 640px)  { html { font-size: 4.444444vw; } } 

  :root {
    --hero-base:            #04050c;
    --heading:              #eef0f6;
    --body-muted:           #b9becf;
    --on-media:             #ffffff;
    --action-inverse:       #ffffff;
    --action-inverse-fg:    #2f2f33;
    --glass-fill:           rgba(255,255,255,0.08);
    --glass-border:         rgba(255,255,255,0.16);
    --scrim:                rgba(4,5,12,0.46);
    --scrim-strong:         rgba(4,5,12,0.68);
    --scrim-soft:           rgba(4,5,12,0.12);
    --duration-fast:        150ms;
    --ease-entrance:        cubic-bezier(0.2, 0, 0, 1);
  }

  body {
    font-family: "Onest", sans-serif;
    background: var(--hero-base);
    color: var(--heading);
    overflow-x: hidden;
  }

  .hero {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100lvh;
    width: 100vw;
    overflow: hidden;
    background: var(--hero-base);
    text-align: center;
    padding: 0 1.25rem;
  }
  @media (min-width: 640px) { .hero { padding: 0 2.5rem; } }

  .fluid-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    z-index: 0;
    pointer-events: none;
  }

  .scrim {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: radial-gradient(115% 95% at 50% 46%,
      var(--scrim-strong) 0%, var(--scrim-strong) 24%, var(--scrim) 52%, var(--scrim-soft) 100%);
  }

  .nav {
    position: absolute;
    inset-inline: 0;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem;
  }
  @media (min-width: 640px) { .nav { padding: 1.75rem 2.5rem; } }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-weight: 500;
    font-size: 1.15rem;
    color: var(--on-media);
    letter-spacing: -0.01em;
  }
  @media (min-width: 640px) { .brand { font-size: 1.375rem; } }

  .brand-glyph {
    width: 1.35rem;
    height: 1.35rem;
    stroke: currentColor;
    flex: none;
  }
  @media (min-width: 640px) { .brand-glyph { width: 1.5rem; height: 1.5rem; } }

  .nav-pill {
    display: none;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    height: 3rem;
    align-items: center;
    gap: 2.25rem;
    border-radius: 9999px;
    border: 1px solid var(--glass-border);
    background: var(--glass-fill);
    padding: 0 1.75rem;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  @media (min-width: 640px) { .nav-pill { display: flex; } }

  .nav-pill a {
    font-size: 0.95rem;
    color: var(--body-muted);
    white-space: nowrap;
    transition: color var(--duration-fast) var(--ease-entrance);
  }
  .nav-pill a:hover { color: var(--heading); }

  .pill-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 2.5rem;
    border-radius: 9999px;
    background: var(--action-inverse);
    padding: 0 1.125rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--action-inverse-fg);
    box-shadow: 0 1px 2px rgba(0,0,0,.05);
    transition: background var(--duration-fast) var(--ease-entrance);
  }
  @media (min-width: 640px) {
    .pill-btn { height: 2.75rem; padding: 0 1.375rem; font-size: 0.95rem; }
  }
  .pill-btn:hover { background: rgba(255,255,255,0.85); }
  .pill-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(255,255,255,.7); }

  .column {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 22rem;
  }
  @media (min-width: 640px)  { .column { max-width: 40rem; } }
  @media (min-width: 1024px) { .column { max-width: 52rem; } }

  .badge {
    display: inline-flex;
    align-items: center;
    border-radius: 9999px;
    border: 1px solid var(--glass-border);
    background: var(--glass-fill);
    padding: 0.4rem 0.875rem;
    font-size: 0.72rem;
    color: var(--body-muted);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  @media (min-width: 640px) { .badge { font-size: 0.8rem; } }

  .heading {
    margin-top: 1.25rem;
    max-width: 20rem;
    font-size: 2rem;
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--heading);
    text-align: center;
  }
  @media (min-width: 640px)  { .heading { margin-top: 1.75rem; max-width: 34rem; font-size: 3.5rem; } }
  @media (min-width: 1024px) { .heading { max-width: 46rem; font-size: 5rem; } }

  .subline {
    margin-top: 1rem;
    max-width: 20rem;
    font-size: 1rem;
    line-height: 1.5;
    color: var(--body-muted);
  }
  @media (min-width: 640px)  { .subline { margin-top: 1.25rem; max-width: 34rem; font-size: 1.1rem; } }
  @media (min-width: 1024px) { .subline { max-width: none; font-size: 1.2rem; } }

  .form-wrap {
    margin-top: 1.75rem;
    display: flex;
    justify-content: center;
    width: 100%;
  }
  @media (min-width: 640px) { .form-wrap { margin-top: 2.5rem; } }

  .waitlist {
    width: 37rem;
    max-width: 100%;
  }

  .waitlist-bar {
    display: flex;
    align-items: center;
    height: 3.5rem;
    border-radius: 9999px;
    border: 1px solid var(--glass-border);
    background: var(--glass-fill);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 1px 2px rgba(0,0,0,.05);
    padding-left: 1.25rem;
    padding-right: 0.35rem;
  }
  @media (min-width: 640px) {
    .waitlist-bar { height: 4rem; padding-left: 1.5rem; padding-right: 0.4rem; }
  }

  .waitlist-bar input {
    flex: 1;
    min-width: 0;
    height: 100%;
    background: transparent;
    color: var(--heading);
    font-size: 0.95rem;
    border: none;
    outline: none;
    font-family: inherit;
  }
  @media (min-width: 640px) { .waitlist-bar input { font-size: 1.15rem; } }
  .waitlist-bar input::placeholder { color: var(--body-muted); }

  .footer {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    justify-content: center;
    padding: 1.25rem;
    font-size: 0.72rem;
    color: var(--body-muted);
  }
  @media (min-width: 640px) { .footer { padding: 1.5rem 2.5rem; font-size: 0.8rem; } }
`;

// --- WEBGL FLUID LOGIC ---
function fluidSimulation(canvas: HTMLCanvasElement) {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  let config = {
      SIM_RESOLUTION: 200,
      DYE_RESOLUTION: 512,
      DENSITY_DISSIPATION: 0.958,
      VELOCITY_DISSIPATION: 0.96,
      PRESSURE_DISSIPATION: 0.8,
      PRESSURE_ITERATIONS: 20,
      CURL: 42,
      SPLAT_RADIUS: 0.22,
      SHADING: true,
      COLORFUL: true,
      PAUSED: false,
      BACK_COLOR: { r: 4, g: 5, b: 12 },
      TRANSPARENT: false,
      BLOOM: false,
      BLOOM_ITERATIONS: 8,
      BLOOM_RESOLUTION: 256,
      BLOOM_INTENSITY: 0.8,
      BLOOM_THRESHOLD: 0.8,
      BLOOM_SOFT_KNEE: 0.7
  }

  function PointerPrototype() {
      this.id = -1;
      this.x = 0;
      this.y = 0;
      this.dx = 0;
      this.dy = 0;
      this.down = false;
      this.moved = false;
      this.color = [30, 0, 300];
  }

  let pointers: any[] = [];
  let splatStack: any[] = [];
  let bloomFramebuffers: any[] = [];
  pointers.push(new (PointerPrototype as any)());

  const { gl, ext } = getWebGLContext(canvas);

  if (isMobile()) config.SHADING = false;
  if (!ext.supportLinearFiltering) {
      config.SHADING = false;
      config.BLOOM = false;
  }

  function getWebGLContext(canvas: any) {
      const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
      let gl = canvas.getContext('webgl2', params);
      const isWebGL2 = !!gl;
      if (!isWebGL2) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
      let halfFloat;
      let supportLinearFiltering;
      if (isWebGL2) {
          gl.getExtension('EXT_color_buffer_float');
          supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
      } else {
          halfFloat = gl.getExtension('OES_texture_half_float');
          supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
      }
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
      let formatRGBA, formatRG, formatR;
      if (isWebGL2) {
          formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
          formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
          formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
      } else {
          formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
          formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
          formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      }
      return { gl, ext: { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering } };
  }

  function getSupportedFormat(gl: any, internalFormat: any, format: any, type: any): any {
      if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
          switch (internalFormat) {
              case gl.R16F: return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
              case gl.RG16F: return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
              default: return null;
          }
      }
      return { internalFormat, format };
  }

  function supportRenderTextureFormat(gl: any, internalFormat: any, format: any, type: any) {
      let texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      let fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      return status == gl.FRAMEBUFFER_COMPLETE;
  }

  function isMobile() {
      return /Mobi|Android/i.test(navigator.userAgent);
  }

  class GLProgram {
      uniforms: any;
      program: any;
      constructor(vertexShader: any, fragmentShader: any) {
          this.uniforms = {};
          this.program = gl.createProgram();
          gl.attachShader(this.program, vertexShader);
          gl.attachShader(this.program, fragmentShader);
          gl.linkProgram(this.program);
          if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw gl.getProgramInfoLog(this.program);
          const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
          for (let i = 0; i < uniformCount; i++) {
              const uniformName = gl.getActiveUniform(this.program, i).name;
              this.uniforms[uniformName] = gl.getUniformLocation(this.program, uniformName);
          }
      }
      bind() { gl.useProgram(this.program); }
  }

  function compileShader(type: any, source: any) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(shader);
      return shader;
  }

  const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
          vUv = aPosition * 0.5 + 0.5;
          vL = vUv - vec2(texelSize.x, 0.0);
          vR = vUv + vec2(texelSize.x, 0.0);
          vT = vUv + vec2(0.0, texelSize.y);
          vB = vUv - vec2(0.0, texelSize.y);
          gl_Position = vec4(aPosition, 0.0, 1.0);
      }
  `);

  const clearShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;
      uniform float value;
      void main () {
          gl_FragColor = value * texture2D(uTexture, vUv);
      }
  `);

  const colorShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform vec4 color;
      void main () {
          gl_FragColor = color;
      }
  `);

  const backgroundShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float aspectRatio;
      #define SCALE 25.0
      void main () {
          vec2 uv = floor(vUv * SCALE * vec2(aspectRatio, 1.0));
          float v = mod(uv.x + uv.y, 2.0);
          v = v * 0.1 + 0.8;
          gl_FragColor = vec4(vec3(v), 1.0);
      }
  `);

  const displayShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      void main () {
          vec3 C = texture2D(uTexture, vUv).rgb;
          float a = max(C.r, max(C.g, C.b));
          gl_FragColor = vec4(C, a);
      }
  `);

  const displayBloomShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform sampler2D uBloom;
      uniform sampler2D uDithering;
      uniform vec2 ditherScale;
      void main () {
          vec3 C = texture2D(uTexture, vUv).rgb;
          vec3 bloom = texture2D(uBloom, vUv).rgb;
          vec3 noise = texture2D(uDithering, vUv * ditherScale).rgb;
          noise = noise * 2.0 - 1.0;
          bloom += noise / 800.0;
          bloom = pow(bloom.rgb, vec3(1.0 / 2.2));
          C += bloom;
          float a = max(C.r, max(C.g, C.b));
          gl_FragColor = vec4(C, a);
      }
  `);

  const displayShadingShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform vec2 texelSize;
      void main () {
          vec3 L = texture2D(uTexture, vL).rgb;
          vec3 R = texture2D(uTexture, vR).rgb;
          vec3 T = texture2D(uTexture, vT).rgb;
          vec3 B = texture2D(uTexture, vB).rgb;
          vec3 C = texture2D(uTexture, vUv).rgb;
          float dx = length(R) - length(L);
          float dy = length(T) - length(B);
          vec3 n = normalize(vec3(dx, dy, length(texelSize)));
          vec3 l = vec3(0.0, 0.0, 1.0);
          float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
          C.rgb *= diffuse;
          float a = max(C.r, max(C.g, C.b));
          gl_FragColor = vec4(C, a);
      }
  `);

  const displayBloomShadingShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform sampler2D uBloom;
      uniform sampler2D uDithering;
      uniform vec2 ditherScale;
      uniform vec2 texelSize;
      void main () {
          vec3 L = texture2D(uTexture, vL).rgb;
          vec3 R = texture2D(uTexture, vR).rgb;
          vec3 T = texture2D(uTexture, vT).rgb;
          vec3 B = texture2D(uTexture, vB).rgb;
          vec3 C = texture2D(uTexture, vUv).rgb;
          float dx = length(R) - length(L);
          float dy = length(T) - length(B);
          vec3 n = normalize(vec3(dx, dy, length(texelSize)));
          vec3 l = vec3(0.0, 0.0, 1.0);
          float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
          C *= diffuse;
          vec3 bloom = texture2D(uBloom, vUv).rgb;
          vec3 noise = texture2D(uDithering, vUv * ditherScale).rgb;
          noise = noise * 2.0 - 1.0;
          bloom += noise / 800.0;
          bloom = pow(bloom.rgb, vec3(1.0 / 2.2));
          C += bloom;
          float a = max(C.r, max(C.g, C.b));
          gl_FragColor = vec4(C, a);
      }
  `);

  const bloomPrefilterShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform vec3 curve;
      uniform float threshold;
      void main () {
          vec3 c = texture2D(uTexture, vUv).rgb;
          float br = max(c.r, max(c.g, c.b));
          float rq = clamp(br - curve.x, 0.0, curve.y);
          rq = curve.z * rq * rq;
          c *= max(rq, br - threshold) / max(br, 0.0001);
          gl_FragColor = vec4(c, 0.0);
      }
  `);

  const bloomBlurShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      void main () {
          vec4 sum = vec4(0.0);
          sum += texture2D(uTexture, vL);
          sum += texture2D(uTexture, vR);
          sum += texture2D(uTexture, vT);
          sum += texture2D(uTexture, vB);
          sum *= 0.25;
          gl_FragColor = sum;
      }
  `);

  const bloomFinalShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform float intensity;
      void main () {
          vec4 sum = vec4(0.0);
          sum += texture2D(uTexture, vL);
          sum += texture2D(uTexture, vR);
          sum += texture2D(uTexture, vT);
          sum += texture2D(uTexture, vB);
          sum *= 0.25;
          gl_FragColor = sum * intensity;
      }
  `);

  const splatShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      void main () {
          vec2 p = vUv - point.xy;
          p.x *= aspectRatio;
          vec3 splat = exp(-dot(p, p) / radius) * color;
          vec3 base = texture2D(uTarget, vUv).xyz;
          gl_FragColor = vec4(base + splat, 1.0);
      }
  `);

  const advectionManualFilteringShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform vec2 dyeTexelSize;
      uniform float dt;
      uniform float dissipation;
      vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
          vec2 st = uv / tsize - 0.5;
          vec2 iuv = floor(st);
          vec2 fuv = fract(st);
          vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
          vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
          vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
          vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
          return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
      }
      void main () {
          vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
          gl_FragColor = dissipation * bilerp(uSource, coord, dyeTexelSize);
          gl_FragColor.a = 1.0;
      }
  `);

  const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform float dt;
      uniform float dissipation;
      void main () {
          vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
          gl_FragColor = dissipation * texture2D(uSource, coord);
          gl_FragColor.a = 1.0;
      }
  `);

  const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
          float L = texture2D(uVelocity, vL).x;
          float R = texture2D(uVelocity, vR).x;
          float T = texture2D(uVelocity, vT).y;
          float B = texture2D(uVelocity, vB).y;
          vec2 C = texture2D(uVelocity, vUv).xy;
          if (vL.x < 0.0) { L = -C.x; }
          if (vR.x > 1.0) { R = -C.x; }
          if (vT.y > 1.0) { T = -C.y; }
          if (vB.y < 0.0) { B = -C.y; }
          float div = 0.5 * (R - L + T - B);
          gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }
  `);

  const curlShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
          float L = texture2D(uVelocity, vL).y;
          float R = texture2D(uVelocity, vR).y;
          float T = texture2D(uVelocity, vT).x;
          float B = texture2D(uVelocity, vB).x;
          float vorticity = R - L - T + B;
          gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }
  `);

  const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;
      void main () {
          float L = texture2D(uCurl, vL).x;
          float R = texture2D(uCurl, vR).x;
          float T = texture2D(uCurl, vT).x;
          float B = texture2D(uCurl, vB).x;
          float C = texture2D(uCurl, vUv).x;
          vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
          force /= length(force) + 0.0001;
          force *= curl * C;
          force.y *= -1.0;
          vec2 vel = texture2D(uVelocity, vUv).xy;
          gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
      }
  `);

  const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;
      vec2 boundary (vec2 uv) {
          return uv;
      }
      void main () {
          float L = texture2D(uPressure, boundary(vL)).x;
          float R = texture2D(uPressure, boundary(vR)).x;
          float T = texture2D(uPressure, boundary(vT)).x;
          float B = texture2D(uPressure, boundary(vB)).x;
          float C = texture2D(uPressure, vUv).x;
          float divergence = texture2D(uDivergence, vUv).x;
          float pressure = (L + R + B + T - divergence) * 0.25;
          gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }
  `);

  const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;
      vec2 boundary (vec2 uv) {
          return uv;
      }
      void main () {
          float L = texture2D(uPressure, boundary(vL)).x;
          float R = texture2D(uPressure, boundary(vR)).x;
          float T = texture2D(uPressure, boundary(vT)).x;
          float B = texture2D(uPressure, boundary(vB)).x;
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          velocity.xy -= vec2(R - L, T - B);
          gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
  `);

  const blit = (() => {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      return (destination: any) => {
          gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
          gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }
  })();

  let simWidth: any, simHeight: any, dyeWidth: any, dyeHeight: any;
  let density: any, velocity: any, divergence: any, curl: any, pressure: any, bloom: any;
  let ditheringTexture = createNoiseTexture(256);

  const clearProgram = new GLProgram(baseVertexShader, clearShader);
  const colorProgram = new GLProgram(baseVertexShader, colorShader);
  const backgroundProgram = new GLProgram(baseVertexShader, backgroundShader);
  const displayProgram = new GLProgram(baseVertexShader, displayShader);
  const displayBloomProgram = new GLProgram(baseVertexShader, displayBloomShader);
  const displayShadingProgram = new GLProgram(baseVertexShader, displayShadingShader);
  const displayBloomShadingProgram = new GLProgram(baseVertexShader, displayBloomShadingShader);
  const bloomPrefilterProgram = new GLProgram(baseVertexShader, bloomPrefilterShader);
  const bloomBlurProgram = new GLProgram(baseVertexShader, bloomBlurShader);
  const bloomFinalProgram = new GLProgram(baseVertexShader, bloomFinalShader);
  const splatProgram = new GLProgram(baseVertexShader, splatShader);
  const advectionProgram = new GLProgram(baseVertexShader, ext.supportLinearFiltering ? advectionShader : advectionManualFilteringShader);
  const divergenceProgram = new GLProgram(baseVertexShader, divergenceShader);
  const curlProgram = new GLProgram(baseVertexShader, curlShader);
  const vorticityProgram = new GLProgram(baseVertexShader, vorticityShader);
  const pressureProgram = new GLProgram(baseVertexShader, pressureShader);
  const gradienSubtractProgram = new GLProgram(baseVertexShader, gradientSubtractShader);

  function initFramebuffers() {
      let simRes = getResolution(config.SIM_RESOLUTION);
      let dyeRes = getResolution(config.DYE_RESOLUTION);

      simWidth = simRes.width;
      simHeight = simRes.height;
      dyeWidth = dyeRes.width;
      dyeHeight = dyeRes.height;

      const texType = ext.halfFloatTexType;
      const rgba = ext.formatRGBA;
      const rg = ext.formatRG;
      const r = ext.formatR;
      const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

      if (density == null) density = createDoubleFBO(dyeWidth, dyeHeight, rgba.internalFormat, rgba.format, texType, filtering);
      else density = resizeDoubleFBO(density, dyeWidth, dyeHeight, rgba.internalFormat, rgba.format, texType, filtering);

      if (velocity == null) velocity = createDoubleFBO(simWidth, simHeight, rg.internalFormat, rg.format, texType, filtering);
      else velocity = resizeDoubleFBO(velocity, simWidth, simHeight, rg.internalFormat, rg.format, texType, filtering);

      divergence = createFBO(simWidth, simHeight, r.internalFormat, r.format, texType, gl.NEAREST);
      curl = createFBO(simWidth, simHeight, r.internalFormat, r.format, texType, gl.NEAREST);
      pressure = createDoubleFBO(simWidth, simHeight, r.internalFormat, r.format, texType, gl.NEAREST);
      initBloomFramebuffers();
  }

  function initBloomFramebuffers() {
      let res = getResolution(config.BLOOM_RESOLUTION);
      const texType = ext.halfFloatTexType;
      const rgba = ext.formatRGBA;
      const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      bloom = createFBO(res.width, res.height, rgba.internalFormat, rgba.format, texType, filtering);
      bloomFramebuffers.length = 0;
      for (let i = 0; i < config.BLOOM_ITERATIONS; i++) {
          let width = res.width >> (i + 1);
          let height = res.height >> (i + 1);
          if (width < 2 || height < 2) break;
          let fbo = createFBO(width, height, rgba.internalFormat, rgba.format, texType, filtering);
          bloomFramebuffers.push(fbo);
      }
  }

  function createFBO(w: any, h: any, internalFormat: any, format: any, type: any, param: any) {
      gl.activeTexture(gl.TEXTURE0);
      let texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

      let fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);

      return {
          texture, fbo, width: w, height: h,
          attach(id: any) {
              gl.activeTexture(gl.TEXTURE0 + id);
              gl.bindTexture(gl.TEXTURE_2D, texture);
              return id;
          }
      };
  }

  function createDoubleFBO(w: any, h: any, internalFormat: any, format: any, type: any, param: any) {
      let fbo1 = createFBO(w, h, internalFormat, format, type, param);
      let fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
          get read() { return fbo1; },
          set read(value) { fbo1 = value; },
          get write() { return fbo2; },
          set write(value) { fbo2 = value; },
          swap() {
              let temp = fbo1;
              fbo1 = fbo2;
              fbo2 = temp;
          }
      }
  }

  function resizeFBO(target: any, w: any, h: any, internalFormat: any, format: any, type: any, param: any) {
      let newFBO = createFBO(w, h, internalFormat, format, type, param);
      clearProgram.bind();
      gl.uniform1i(clearProgram.uniforms.uTexture, target.attach(0));
      gl.uniform1f(clearProgram.uniforms.value, 1);
      blit(newFBO.fbo);
      return newFBO;
  }

  function resizeDoubleFBO(target: any, w: any, h: any, internalFormat: any, format: any, type: any, param: any) {
      target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
      target.write = createFBO(w, h, internalFormat, format, type, param);
      return target;
  }

  function createNoiseTexture(size: any) {
      const data = new Uint8Array(size * size * 3);
      for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 256);
      let texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, size, size, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
      return {
          texture, width: size, height: size,
          attach(id: any) {
              gl.activeTexture(gl.TEXTURE0 + id);
              gl.bindTexture(gl.TEXTURE_2D, texture);
              return id;
          }
      };
  }

  initFramebuffers();
  multipleSplats(34);
  for (let i = 0; i < 8; i++) splatStack.push(10 + parseInt((Math.random() * 10).toString()));

  let lastColorChangeTime = Date.now();
  let virtualSeeded = false;
  let orbitAngle = 0;
  let vPrevX = 0, vPrevY = 0;
  let virtualColor: any = null;
  let lastVColorTime = 0;
  const engineStart = Date.now();
  const ORBIT_RADIUS = 300;
  const ORBIT_SPEED = 0.026;
  const ORBIT_START_DELAY = 700;

  let rafHandle = 0;
  let destroyed = false;

  update();

  function update() {
      if (destroyed) return;
      resizeCanvas();
      driveVirtualPointer();
      input();
      if (!config.PAUSED) step(0.016);
      render(null);
      rafHandle = requestAnimationFrame(update);
  }

  function driveVirtualPointer() {
      if (Date.now() - engineStart < ORBIT_START_DELAY) return;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const base = Math.min(ORBIT_RADIUS, canvas.width * 0.35, canvas.height * 0.35);
      const r = base * (0.72 + 0.28 * Math.sin(orbitAngle * 0.37));
      orbitAngle += ORBIT_SPEED;
      const x = cx + Math.cos(orbitAngle) * r;
      const y = cy + Math.sin(orbitAngle) * r;
      if (!virtualSeeded) {
          virtualSeeded = true;
          vPrevX = x;
          vPrevY = y;
          return;
      }
      if (!virtualColor || Date.now() - lastVColorTime > 120) {
          virtualColor = generateColor();
          virtualColor.r *= 3.2;
          virtualColor.g *= 3.2;
          virtualColor.b *= 3.2;
          lastVColorTime = Date.now();
      }
      const dx = (x - vPrevX) * 9.0;
      const dy = (y - vPrevY) * 9.0;
      vPrevX = x;
      vPrevY = y;
      splat(x, y, dx, dy, virtualColor);
  }

  function input() {
      if (splatStack.length > 0) multipleSplats(splatStack.pop());
      for (let i = 0; i < pointers.length; i++) {
          const p = pointers[i];
          if (p.moved) {
              splat(p.x, p.y, p.dx, p.dy, p.color);
              p.moved = false;
          }
      }
      if (!config.COLORFUL) return;
      if (lastColorChangeTime + 100 < Date.now()) {
          lastColorChangeTime = Date.now();
          for (let i = 0; i < pointers.length; i++) {
              pointers[i].color = generateColor();
          }
      }
  }

  function step(dt: any) {
      gl.disable(gl.BLEND);
      gl.viewport(0, 0, simWidth, simHeight);

      curlProgram.bind();
      gl.uniform2f(curlProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(curl.fbo);

      vorticityProgram.bind();
      gl.uniform2f(vorticityProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
      gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write.fbo);
      velocity.swap();

      divergenceProgram.bind();
      gl.uniform2f(divergenceProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergence.fbo);

      clearProgram.bind();
      gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
      gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE_DISSIPATION);
      blit(pressure.write.fbo);
      pressure.swap();

      pressureProgram.bind();
      gl.uniform2f(pressureProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
          gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
          blit(pressure.write.fbo);
          pressure.swap();
      }

      gradienSubtractProgram.bind();
      gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
      gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
      gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write.fbo);
      velocity.swap();

      advectionProgram.bind();
      gl.uniform2f(advectionProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
      if (!ext.supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, 1.0 / simWidth, 1.0 / simHeight);
      let velocityId = velocity.read.attach(0);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
      gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
      blit(velocity.write.fbo);
      velocity.swap();

      gl.viewport(0, 0, dyeWidth, dyeHeight);
      if (!ext.supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, 1.0 / dyeWidth, 1.0 / dyeHeight);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, density.read.attach(1));
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
      blit(density.write.fbo);
      density.swap();
  }

  function render(target: any) {
      if (config.BLOOM) applyBloom(density.read, bloom);
      if (target == null || !config.TRANSPARENT) {
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          gl.enable(gl.BLEND);
      } else {
          gl.disable(gl.BLEND);
      }

      let width = target == null ? gl.drawingBufferWidth : dyeWidth;
      let height = target == null ? gl.drawingBufferHeight : dyeHeight;
      gl.viewport(0, 0, width, height);

      if (!config.TRANSPARENT) {
          colorProgram.bind();
          let bc = config.BACK_COLOR;
          gl.uniform4f(colorProgram.uniforms.color, bc.r / 255, bc.g / 255, bc.b / 255, 1);
          blit(target);
      }
      if (target == null && config.TRANSPARENT) {
          backgroundProgram.bind();
          gl.uniform1f(backgroundProgram.uniforms.aspectRatio, canvas.width / canvas.height);
          blit(null);
      }

      if (config.SHADING) {
          let program = config.BLOOM ? displayBloomShadingProgram : displayShadingProgram;
          program.bind();
          gl.uniform2f(program.uniforms.texelSize, 1.0 / width, 1.0 / height);
          gl.uniform1i(program.uniforms.uTexture, density.read.attach(0));
          if (config.BLOOM) {
              gl.uniform1i(program.uniforms.uBloom, bloom.attach(1));
              gl.uniform1i(program.uniforms.uDithering, ditheringTexture.attach(2));
              let scale = getTextureScale(ditheringTexture, width, height);
              gl.uniform2f(program.uniforms.ditherScale, scale.x, scale.y);
          }
      } else {
          let program = config.BLOOM ? displayBloomProgram : displayProgram;
          program.bind();
          gl.uniform1i(program.uniforms.uTexture, density.read.attach(0));
          if (config.BLOOM) {
              gl.uniform1i(program.uniforms.uBloom, bloom.attach(1));
              gl.uniform1i(program.uniforms.uDithering, ditheringTexture.attach(2));
              let scale = getTextureScale(ditheringTexture, width, height);
              gl.uniform2f(program.uniforms.ditherScale, scale.x, scale.y);
          }
      }
      blit(target);
  }

  function applyBloom(source: any, destination: any) {
      if (bloomFramebuffers.length < 2) return;
      let last = destination;
      gl.disable(gl.BLEND);
      bloomPrefilterProgram.bind();
      let knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
      let curve0 = config.BLOOM_THRESHOLD - knee;
      let curve1 = knee * 2;
      let curve2 = 0.25 / knee;
      gl.uniform3f(bloomPrefilterProgram.uniforms.curve, curve0, curve1, curve2);
      gl.uniform1f(bloomPrefilterProgram.uniforms.threshold, config.BLOOM_THRESHOLD);
      gl.uniform1i(bloomPrefilterProgram.uniforms.uTexture, source.attach(0));
      gl.viewport(0, 0, last.width, last.height);
      blit(last.fbo);
      bloomBlurProgram.bind();
      for (let i = 0; i < bloomFramebuffers.length; i++) {
          let dest = bloomFramebuffers[i];
          gl.uniform2f(bloomBlurProgram.uniforms.texelSize, 1.0 / last.width, 1.0 / last.height);
          gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
          gl.viewport(0, 0, dest.width, dest.height);
          blit(dest.fbo);
          last = dest;
      }
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.enable(gl.BLEND);
      for (let i = bloomFramebuffers.length - 2; i >= 0; i--) {
          let baseTex = bloomFramebuffers[i];
          gl.uniform2f(bloomBlurProgram.uniforms.texelSize, 1.0 / last.width, 1.0 / last.height);
          gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
          gl.viewport(0, 0, baseTex.width, baseTex.height);
          blit(baseTex.fbo);
          last = baseTex;
      }
      gl.disable(gl.BLEND);
      bloomFinalProgram.bind();
      gl.uniform2f(bloomFinalProgram.uniforms.texelSize, 1.0 / last.width, 1.0 / last.height);
      gl.uniform1i(bloomFinalProgram.uniforms.uTexture, last.attach(0));
      gl.uniform1f(bloomFinalProgram.uniforms.intensity, config.BLOOM_INTENSITY);
      gl.viewport(0, 0, destination.width, destination.height);
      blit(destination.fbo);
  }

  function splat(x: any, y: any, dx: any, dy: any, color: any) {
      gl.viewport(0, 0, simWidth, simHeight);
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(splatProgram.uniforms.point, x / canvas.width, 1.0 - y / canvas.height);
      gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 1.0);
      gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS / 100.0);
      blit(velocity.write.fbo);
      velocity.swap();
      gl.viewport(0, 0, dyeWidth, dyeHeight);
      gl.uniform1i(splatProgram.uniforms.uTarget, density.read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
      blit(density.write.fbo);
      density.swap();
  }

  function multipleSplats(amount: any) {
      for (let i = 0; i < amount; i++) {
          const color = generateColor();
          color.r *= 10.0; color.g *= 10.0; color.b *= 10.0;
          const x = canvas.width * Math.random();
          const y = canvas.height * Math.random();
          const dx = 1000 * (Math.random() - 0.5);
          const dy = 1000 * (Math.random() - 0.5);
          splat(x, y, dx, dy, color);
      }
  }

  function resizeCanvas() {
      if (canvas.width != canvas.clientWidth || canvas.height != canvas.clientHeight) {
          canvas.width = canvas.clientWidth;
          canvas.height = canvas.clientHeight;
          initFramebuffers();
      }
  }

  function pointerPos(clientX: any, clientY: any) {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
  }

  const teardown: any[] = [];
  function on(target: any, type: any, handler: any, opts?: any) {
      target.addEventListener(type, handler, opts);
      teardown.push(() => target.removeEventListener(type, handler, opts));
  }

  on(window, 'mousemove', (e: any) => {
      const { x, y } = pointerPos(e.clientX, e.clientY);
      const p = pointers[0];
      if (!p.everMoved) {
          p.everMoved = true;
          p.x = x; p.y = y; p.down = true;
          return;
      }
      p.down = true; p.moved = true;
      p.dx = (x - p.x) * 5.0; p.dy = (y - p.y) * 5.0;
      p.x = x; p.y = y;
      p.color = generateColor();
  });

  on(window, 'touchmove', (e: any) => {
      const touches = e.targetTouches;
      for (let i = 0; i < touches.length; i++) {
          if (i >= pointers.length) pointers.push(new (PointerPrototype as any)());
          const p = pointers[i];
          const { x, y } = pointerPos(touches[i].clientX, touches[i].clientY);
          p.down = true;
          p.moved = p.everMoved === true;
          p.everMoved = true;
          p.dx = (x - p.x) * 8.0; p.dy = (y - p.y) * 8.0;
          p.x = x; p.y = y;
      }
  }, { passive: true });

  on(window, 'touchstart', (e: any) => {
      const touches = e.targetTouches;
      for (let i = 0; i < touches.length; i++) {
          if (i >= pointers.length) pointers.push(new (PointerPrototype as any)());
          const p = pointers[i];
          const { x, y } = pointerPos(touches[i].clientX, touches[i].clientY);
          p.id = touches[i].identifier;
          p.down = true; p.x = x; p.y = y;
          p.color = generateColor();
      }
  }, { passive: true });

  on(window, 'mouseup', () => pointers[0].down = false);
  on(window, 'touchend', (e: any) => {
      const touches = e.changedTouches;
      for (let i = 0; i < touches.length; i++)
          for (let j = 0; j < pointers.length; j++)
              if (touches[i].identifier == pointers[j].id) pointers[j].down = false;
  });

  return function destroy() {
      destroyed = true;
      if (rafHandle) cancelAnimationFrame(rafHandle);
      for (const off of teardown) off();
  };

  function generateColor() {
      const h = 0.5 + Math.random() * 0.42;
      let c = HSVtoRGB(h, 0.95, 1.0);
      c.r *= 0.92; c.g *= 0.92; c.b *= 0.92;
      return c;
  }

  function HSVtoRGB(h: any, s: any, v: any) {
      let r = 0, g = 0, b = 0, i, f, p, q, t;
      i = Math.floor(h * 6);
      f = h * 6 - i;
      p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s);
      switch (i % 6) {
          case 0: r = v; g = t; b = p; break;
          case 1: r = q; g = v; b = p; break;
          case 2: r = p; g = v; b = t; break;
          case 3: r = p; g = q; b = v; break;
          case 4: r = t; g = p; b = v; break;
          case 5: r = v; g = p; b = q; break;
      }
      return { r, g, b };
  }

  function getResolution(resolution: any) {
      let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
      let max = Math.round(resolution * aspectRatio);
      let min = Math.round(resolution);
      if (gl.drawingBufferWidth > gl.drawingBufferHeight) return { width: max, height: min };
      else return { width: min, height: max };
  }

  function getTextureScale(texture: any, width: any, height: any) {
      return { x: width / texture.width, y: height / texture.height };
  }
}
