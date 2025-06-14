"use client"

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function PostProcessOverlay() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current!
    const width = container.clientWidth
    const height = container.clientHeight

    const renderer = new THREE.WebGLRenderer({ alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const quadGeometry = new THREE.PlaneGeometry(2, 2)
    const quadMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(width, height) },
        mouse: { value: new THREE.Vector2(0.5, 0.5) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float time;
        uniform vec2 resolution;
        uniform vec2 mouse;
        varying vec2 vUv;

        float random(vec2 st) {
          return fract(sin(dot(st, vec2(12.9898,78.233))) * 43758.5453);
        }

        vec2 curve(vec2 uv) {
          uv = uv * 2.0 - 1.0;
          uv *= 1.05;
          uv += uv * dot(uv, uv) * 0.35;
          return uv * 0.5 + 0.5;
        }

        void main() {
          vec2 uv = curve(vUv);

          // --- Distance from mouse for magnify zone ---
          vec2 delta = uv - mouse;
          float dist = length(delta);
          float zoom = smoothstep(0.25, 0.0, dist);
          vec2 zoomedUV = mix(uv, mouse + delta * 0.6, zoom);

          // --- RGB glitch only near mouse ---
          vec2 offset = 1.5 / resolution; // pixel offset
          float scanline = sin(zoomedUV.y * resolution.y * 2.0 + time * 50.0) * 0.15;
          float staticNoise = (random(zoomedUV * resolution + time * 50.0) - 0.5) * 0.12;
          float base = staticNoise + scanline;

          float r = base + zoom * sin(zoomedUV.x * 80.0 + time) * 0.02;
          float g = base;
          float b = base + zoom * cos(zoomedUV.y * 80.0 - time) * 0.02;

          vec3 color = vec3(r, g, b);

          vec2 center = vec2(0.5);
          float edgeDist = length(vUv - center);

          float alpha = 1.0 - smoothstep(0.0, 1.0, edgeDist * 4.0);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
    })

    const quad = new THREE.Mesh(quadGeometry, quadMaterial)
    scene.add(quad)

    const clock = new THREE.Clock()
    const animate = () => {
      requestAnimationFrame(animate)
      quadMaterial.uniforms.time.value = clock.getElapsedTime()
      renderer.render(scene, camera)
    }
    animate()

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      quadMaterial.uniforms.mouse.value.set(
        (e.clientX - rect.left) / rect.width,
        1.0 - (e.clientY - rect.top) / rect.height
      )
    }

    window.addEventListener('mousemove', handleMouseMove)

    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      renderer.setSize(w, h)
      quadMaterial.uniforms.resolution.value.set(w, h)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      renderer.dispose()
      container.removeChild(renderer.domElement)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-[10]"
    />
  )
}
