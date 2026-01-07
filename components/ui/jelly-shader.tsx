"use strict";
import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Vertex Shader
const vertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment Shader
const fragmentShader = `
uniform float uTime;
uniform float uSqueeze;
uniform vec2 uResolution;
uniform vec3 uColorBg;
uniform vec3 uColorFg;
uniform vec3 uColorAccent;
uniform float uGridSize;
uniform float uSeed;

varying vec2 vUv;
varying vec3 vPosition;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 st = uv;
    st.x *= aspect;

    // JELLY DISTORTION
    float squashFactor = 1.0 + uSqueeze * 0.8; 
    float centerY = 0.5;
    st.y = (st.y - centerY) * squashFactor + centerY;

    // Grid Logic
    float gridSize = uGridSize;
    vec2 gridSt = st * gridSize;
    vec2 gridId = floor(gridSt);
    vec2 gridUv = fract(gridSt);

    // Dynamic Gap / Collision Logic
    float baseGap = 0.15;
    float gap = baseGap;
    
    if (uSqueeze > 0.0) {
        // DRAG / STRETCH: Space out
        gap = baseGap + uSqueeze * 0.35; 
    } else {
        // REBOUND / COLLISION: Bunch up
        gap = baseGap + uSqueeze * 0.5;
    }
    
    // Box SDF
    vec2 boxSize = vec2(1.0 - gap);
    
    // Center the box
    vec2 pos = abs(gridUv - 0.5) * 2.0;
    vec2 box = step(pos, boxSize);
    
    // Mask logic
    float visibleHeight = 1.0 / squashFactor;
    float maskMin = 0.5 - visibleHeight * 0.5;
    float maskMax = 0.5 + visibleHeight * 0.5;
    float verticalMask = step(maskMin, uv.y) * step(uv.y, maskMax);
    
    // Combine shape
    float shape = box.x * box.y * verticalMask;

    // Random Accent with Seed
    float rnd = random(gridId + vec2(uSeed, uSeed + 12.34));
    if (uSqueeze < -0.1) {
       rnd += random(uv * uTime) * 0.2;
    }
    
    float isAccent = step(0.80, rnd);

    // Color logic
    vec3 color = uColorFg;
    if (isAccent > 0.5) {
        color = uColorAccent;
    }
    
    float alpha = shape;
    vec3 finalColor = mix(uColorBg, color, alpha);
    
    gl_FragColor = vec4(finalColor, alpha);
}
`;

// Using a standard function component with internal ref instead of forwardRef to avoid type issues
function JellyMaterial({ squeeze, colors, resolution, seed }: { squeeze: number, colors: any, resolution: { width: number, height: number }, seed: number }) {
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uSqueeze: { value: 0 },
        uResolution: { value: new THREE.Vector2(100, 100) },
        uColorBg: { value: new THREE.Color('#000000') },
        uColorFg: { value: new THREE.Color('#ffffff') },
        uColorAccent: { value: new THREE.Color('#c8ff00') },
        uGridSize: { value: 12.0 },
        uSeed: { value: 0 }
    }), [])

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
            materialRef.current.uniforms.uSqueeze.value = squeeze;
            materialRef.current.uniforms.uResolution.value.set(resolution.width, resolution.height);
            materialRef.current.uniforms.uColorBg.value.set(colors.background);
            materialRef.current.uniforms.uColorFg.value.set(colors.foreground);
            materialRef.current.uniforms.uColorAccent.value.set(colors.accent);
            materialRef.current.uniforms.uSeed.value = seed;
        }
    })

    return (
        <shaderMaterial
            ref={materialRef}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={uniforms}
            transparent={true}
        />
    );
}

function Scene({ squeeze, colors, seed }: { squeeze: number, colors: any, seed: number }) {
    const { viewport, size } = useThree();
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            const targetRotX = -state.mouse.y * 0.15;
            const targetRotY = state.mouse.x * 0.15;
            const squeezeTilt = squeeze * 0.3;

            meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX + squeezeTilt, 0.1);
            meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, 0.1);
        }
    });

    return (
        <mesh ref={meshRef}>
            <planeGeometry args={[viewport.width, viewport.height, 32, 32]} />
            <JellyMaterial squeeze={squeeze} colors={colors} resolution={size} seed={seed} />
        </mesh>
    );
}

export function JellyShader({ squeeze, colors, seed }: { squeeze: number, colors: any, seed: number }) {
    return (
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
            <Scene squeeze={squeeze} colors={colors} seed={seed} />
        </Canvas>
    );
}

export default JellyShader;
