"use strict";
import React, { useMemo, useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// --- SHADERS (User Provided + Gravity Collapse) ---

const vertexShader = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 uGridDims;
uniform vec2 uCubeSize;
uniform float uVoxelateProgress;
uniform vec2 uRippleCenter;
uniform float uEffectSpread;
uniform float uEffectDepth;
uniform float uOrganicMode;
uniform float uUseRandomDepth;
uniform float uUsePixelate;
uniform float uUseRGBShift;
uniform float uCollapse;

attribute float aRandomDepth;

varying vec2 vUv;
varying vec3 vNormal;
varying float vHighlightStrength;
varying float vGlitchStrength;

const float PI = 3.141592653589793;
const float SUPPRESSION_RANGE = 0.05;
const float NORMAL_DAMPING = 6.0;
const float SLOW_DAMPING = 2.0;
const float PIXELATION_TIME = 0.9;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Rotate 2D
mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

float elasticOut(float t, float p, float damp_exp) {
  float tClamped = clamp(t, 0.0, 1.0);
  if(tClamped <= 0.0001)
    return 0.0;
  if(tClamped >= 0.9999)
    return 1.0;
  return pow(2.0, -damp_exp * tClamped) * sin((tClamped - p / 4.0) * (2.0 * PI) / p) + 1.0;
}

void main() {
  // --- 1. Get basic instance information ---
  float instanceId = float(gl_InstanceID);

  float col = mod(instanceId, uGridDims.x);
  float row = floor(instanceId / uGridDims.x);
  vec2 uvStep = 1.0 / uGridDims;
  vec2 baseUv = vec2(col, row) * uvStep;
  vec2 centerUv = baseUv + (uvStep * 0.5);

  float gridAspect = uGridDims.x / uGridDims.y;
  vec2 aspectVec = vec2(gridAspect, 1.0);
  float distFromCenter = distance(centerUv * aspectVec, uRippleCenter * aspectVec);

  float rndPhase = random(vec2(instanceId, 123.456));
  float rndBounce = random(vec2(instanceId, 987.654));

  // --- 2. Animation Progress (Wave Progress)
  // A. Organic Mode (Noise, Elastic) 
  float noisyDist = max(0.0, distFromCenter + (rndPhase - 0.5) * 0.3);
  float progressOrganic = clamp((uVoxelateProgress - noisyDist) / uEffectSpread, 0.0, 1.0);

  float suppression = 1.0 - smoothstep(0.0, SUPPRESSION_RANGE, noisyDist);
  float currentDamp = mix(NORMAL_DAMPING, SLOW_DAMPING, suppression);

  float valOrganic = elasticOut(progressOrganic, 0.2 + rndPhase * 0.2, currentDamp);
  float bounceDiff = max(0.0, valOrganic - 1.0);
  valOrganic += bounceDiff * (uEffectDepth + rndBounce * 1.1);

  float highlightOrganic = step(0.01, bounceDiff) * smoothstep(0.0, 0.35, 1.0 - progressOrganic) * (0.5 + rndPhase * 0.5);

  // B. Smooth Mode (No-Noise, Sine)
  float progressSmooth = smoothstep(distFromCenter, distFromCenter + uEffectSpread, uVoxelateProgress);

  float valSmoothBounce = sin(progressSmooth * PI) * step(progressSmooth, 0.99);
  float valSmooth = progressSmooth + (valSmoothBounce * uEffectDepth);

  float highlightSmooth = valSmoothBounce;

  float finalScaleVal = mix(valSmooth, valOrganic, uOrganicMode);
  vHighlightStrength = mix(highlightSmooth, highlightOrganic, uOrganicMode);

  // --- 3. UV Coordinates (Pixelate and Glitch) ---
  vec3 nMask = step(0.5, abs(normal));
  vec2 faceCoords = (position.zy * nMask.x) + (position.xz * nMask.y) + (position.xy * nMask.z);
  vec2 localRatio = clamp((faceCoords / uCubeSize.x) + 0.5, 0.0, 1.0);
  vec2 smoothUv = baseUv + (localRatio * uvStep);

  float effectiveProgress = mix(progressSmooth, progressOrganic, uOrganicMode);
  float pixelPhase = smoothstep(0.0, PIXELATION_TIME, effectiveProgress);

  float glitchIntensity = pow(sin(pixelPhase * PI), 0.5);

  vec2 noiseOffset = vec2(random(vec2(instanceId + pixelPhase * 100.0, 0.0)), random(vec2(instanceId + pixelPhase * 100.0, 1.0))) - 0.5;
  vec2 pixelateUv = mix(smoothUv, centerUv, pixelPhase) + (noiseOffset * glitchIntensity * 0.3);

  vUv = mix(smoothUv, pixelateUv, uUsePixelate);
  vGlitchStrength = glitchIntensity * uUseRGBShift;

  // --- 4. Coordinate Transformation (Depth & Collapse) ---
  float baseDepth = 0.05;
  float targetDepth = mix(1.0, aRandomDepth, uUseRandomDepth);
  float currentDepth = baseDepth + (targetDepth - baseDepth) * finalScaleVal;

  vec3 transformed = position;
  transformed.z *= currentDepth;
  
  // Apply transformations BEFORE world matrix (local space)
  // But for collapse (world space fall), we usually modify position after instanceMatrix.
  // However, InstancedMesh vertex shader applies instanceMatrix to position.
  
  // To do collapse properly, we need to modify the final world position (after instanceMatrix).
  vec4 worldPos = instanceMatrix * vec4(transformed, 1.0);
  
  // Collapse Logic
  if (uCollapse > 0.0) {
      float fallSpeed = 5.0 + rndBounce * 15.0; // Random fall speeds
      float fallDist = uCollapse * uCollapse * fallSpeed; // Quadratic fall (gravity)
      worldPos.y -= fallDist;
      
      // Random Rotation as they fall
      float spin = uCollapse * 10.0 * (rndPhase - 0.5) * 2.0;
      float s = sin(spin);
      float c = cos(spin);
      mat2 m = mat2(c, -s, s, c);
      worldPos.xz = m * worldPos.xz; // Rotate around Y axis (visually Z/X plane)
      
      // Shrink
      float scale = 1.0 - uCollapse * 0.5;
      worldPos.xyz *= scale;
  }

  vNormal = normalize((instanceMatrix * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * worldPos;
}
`;

const fragmentShader = `
precision mediump float;

uniform sampler2D uMap;
uniform vec3 uHighlightColor;
uniform float uHighlightIntensity;

varying vec2 vUv;
varying vec3 vNormal;
varying float vHighlightStrength;
varying float vGlitchStrength;

const vec3 LIGHT_DIR = vec3(0.8, 0.85, 1.0);
const float AMBIENT_INTENSITY = 0.95;
const float DIFFUSE_INTENSITY = 0.1;
const float SHIFT_OFFSET = 0.075;

void main() {
  // --- 1. Texture Sampling with RGB Shift ---
  float shift = vGlitchStrength * SHIFT_OFFSET;

  float r = texture2D(uMap, vUv + vec2(shift, 0.0)).r;
  float g = texture2D(uMap, vUv).g;
  float b = texture2D(uMap, vUv - vec2(shift, 0.0)).b;

  vec4 texColor = vec4(r, g, b, 1.0);

  // --- 2. Lighting  ---
  vec3 normLightDir = normalize(LIGHT_DIR);

  float diff = max(dot(vNormal, normLightDir), 0.0);

  vec3 ambient = vec3(AMBIENT_INTENSITY);
  vec3 diffuse = vec3(DIFFUSE_INTENSITY) * diff;

  vec3 lighting = ambient + diffuse;

  vec3 finalColor = texColor.rgb * lighting;

  // --- 3. Highlight Composition ---
  float effectIntensity = vHighlightStrength * uHighlightIntensity;

  finalColor = mix(finalColor, uHighlightColor, effectIntensity);

  gl_FragColor = vec4(finalColor, texColor.a);
}
`;

// --- COMPONENT ---

function VoxelScene({ squeeze, colors, seed }: { squeeze: number, colors: any, seed: number }) {
    const { viewport } = useThree();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    
    const [isCollapsed, setIsCollapsed] = useState(false);
    const collapseAnim = useRef(0);
    
    // Grid Configuration
    const COLS = 32;
    const ROWS = 20;
    const COUNT = COLS * ROWS;
    const BOX_SIZE = 0.4;
    const SPACING = 0.05;

    // Generate Texture on mount
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d')!;
        
        // Draw gradient background
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, colors.background);
        grad.addColorStop(1, colors.foreground);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);
        
        // Draw noise/pattern
        for(let i=0; i<50; i++) {
            ctx.fillStyle = colors.accent;
            ctx.globalAlpha = 0.2;
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const s = Math.random() * 100;
            ctx.beginPath();
            ctx.arc(x, y, s, 0, Math.PI*2);
            ctx.fill();
        }
        
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }, [colors]);

    const uniforms = useMemo(() => ({
        uGridDims: { value: new THREE.Vector2(COLS, ROWS) },
        uCubeSize: { value: new THREE.Vector2(BOX_SIZE, BOX_SIZE) },
        uVoxelateProgress: { value: 0 },
        uRippleCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uEffectSpread: { value: 0.5 },
        uEffectDepth: { value: 2.0 },
        uOrganicMode: { value: 1.0 },
        uUseRandomDepth: { value: 1.0 },
        uUsePixelate: { value: 1.0 },
        uUseRGBShift: { value: 1.0 },
        uMap: { value: texture },
        uHighlightColor: { value: new THREE.Color(colors.accent) },
        uHighlightIntensity: { value: 1.0 },
        uCollapse: { value: 0.0 }, // New uniform
    }), [texture, colors]);

    // Setup Instances
    useLayoutEffect(() => {
        if (!meshRef.current) return;

        const tempObj = new THREE.Object3D();
        const totalWidth = COLS * (BOX_SIZE + SPACING);
        const totalHeight = ROWS * (BOX_SIZE + SPACING);
        
        const startX = -totalWidth / 2;
        const startY = -totalHeight / 2;

        const randomDepths = new Float32Array(COUNT);

        for (let i = 0; i < COUNT; i++) {
            const col = i % COLS;
            const row = Math.floor(i / COLS);

            tempObj.position.set(
                startX + col * (BOX_SIZE + SPACING),
                startY + row * (BOX_SIZE + SPACING),
                0
            );
            tempObj.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObj.matrix);
            
            randomDepths[i] = Math.random() * 0.5 + 0.5;
        }
        
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.geometry.setAttribute(
            'aRandomDepth',
            new THREE.InstancedBufferAttribute(randomDepths, 1)
        );

    }, [COUNT, COLS, ROWS, BOX_SIZE, SPACING]);

    useFrame((state, delta) => {
        if (materialRef.current) {
            // Collapse Animation
            const targetCollapse = isCollapsed ? 1.0 : 0.0;
            collapseAnim.current = THREE.MathUtils.lerp(collapseAnim.current, targetCollapse, delta * 3.0);
            materialRef.current.uniforms.uCollapse.value = collapseAnim.current;

            // Map squeeze to voxelate progress
            const time = state.clock.getElapsedTime();
            const hoverX = (state.mouse.x * 0.5 + 0.5);
            const hoverY = (state.mouse.y * 0.5 + 0.5);
            
            const autoWave = Math.sin(time * 0.5) * 0.2 + 0.2;
            const targetProgress = Math.max(squeeze, autoWave);
            
            materialRef.current.uniforms.uVoxelateProgress.value = THREE.MathUtils.lerp(
                materialRef.current.uniforms.uVoxelateProgress.value,
                targetProgress,
                0.1
            );
            
            materialRef.current.uniforms.uRippleCenter.value.set(hoverX, hoverY);
            materialRef.current.uniforms.uHighlightColor.value.set(colors.accent);
        }
    });

    const handleClick = (e: any) => {
        e.stopPropagation();
        setIsCollapsed(!isCollapsed);
    }

    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
        }
    }

    return (
        <instancedMesh 
            ref={meshRef} 
            args={[undefined, undefined, COUNT]} 
            onClick={handleClick}
            onPointerOver={() => document.body.style.cursor = 'pointer'}
            onPointerOut={() => document.body.style.cursor = 'default'}
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            <boxGeometry args={[BOX_SIZE, BOX_SIZE, 1.0]} />
            <shaderMaterial
                ref={materialRef}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                // side={THREE.DoubleSide}
            />
        </instancedMesh>
    );
}

export function JellyShader({ squeeze, colors, seed }: { squeeze: number, colors: any, seed: number }) {
    return (
        <Canvas camera={{ position: [0, 0, 15], fov: 45 }} gl={{ alpha: true }} style={{ background: 'transparent' }}>
            <VoxelScene squeeze={squeeze} colors={colors} seed={seed} />
        </Canvas>
    );
}

export default JellyShader;
