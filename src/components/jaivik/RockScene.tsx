"use client";

/**
 * Floating, slowly-rotating photoreal rock — the hero centerpiece for the
 * Jaivik Sathi page, in the spirit of alethia.earth's floating 3D object.
 * Model: Poly Haven "namaqualand_boulder_04" (CC0), tinted toward moss-green.
 * Pauses rendering when scrolled out of view so it never starves the
 * page's scroll-reveal animations.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Float, Center, Clone } from "@react-three/drei";
import { Color } from "three";
import type { Group, Mesh, MeshStandardMaterial } from "three";

const MODEL = "/models/rock/namaqualand_boulder_04_1k.gltf";
const TINT = new Color(0.6, 0.9, 0.52); // push the rusty rock toward moss-green

/** Smaller satellite rocks that drift around the main one */
const SATELLITES = [
  { position: [3.4, 1.5, -1.8] as const, scale: 0.12, rot: [0.4, 1, 0.2] as const, speed: 1.7, floatI: 1.4 },
  { position: [-3.5, -1.1, -0.6] as const, scale: 0.19, rot: [0.2, -0.6, 0.3] as const, speed: 1.1, floatI: 1.1 },
  { position: [3.7, -1.5, -1.2] as const, scale: 0.2, rot: [-0.3, 0.8, -0.2] as const, speed: 1.4, floatI: 1.2 },
];

function Rocks() {
  const mainRef = useRef<Group>(null);
  const { scene } = useGLTF(MODEL);

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as Mesh;
      if ((m as Mesh).isMesh) {
        const mat = m.material as MeshStandardMaterial;
        if (mat?.color) mat.color.copy(TINT);
        if (mat) mat.roughness = Math.min(1, (mat.roughness ?? 1) * 1.05);
      }
    });
  }, [scene]);

  useFrame((_, delta) => {
    if (mainRef.current) mainRef.current.rotation.y += delta * 0.1;
  });

  return (
    <>
      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.9}>
        <group ref={mainRef} scale={0.6}>
          <Center>
            <Clone object={scene} />
          </Center>
        </group>
      </Float>

      {SATELLITES.map((s, i) => (
        <Float key={i} speed={s.speed} rotationIntensity={0.8} floatIntensity={s.floatI}>
          <Clone object={scene} position={s.position} scale={s.scale} rotation={s.rot} />
        </Float>
      ))}
    </>
  );
}

useGLTF.preload(MODEL);

export default function RockScene() {
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="h-full w-full">
      <Canvas
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0, 5], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <hemisphereLight args={["#a9d18a", "#0a140a", 0.7]} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 6, 4]} intensity={2.3} color="#fff4e2" />
        <directionalLight position={[-5, 2, -3]} intensity={1.1} color="#9ecb6b" />
        <pointLight position={[0, -3, 2]} intensity={0.6} color="#c9e87d" />
        <Suspense fallback={null}>
          <Rocks />
        </Suspense>
      </Canvas>
    </div>
  );
}
