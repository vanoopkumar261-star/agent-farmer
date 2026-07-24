"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Instance, Instances, PresentationControls, Sky, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

/** Direction the dawn sun sits — low on the horizon, to the side for warm raking light. */
const SUN_POS: [number, number, number] = [12, 2.6, 4];

/** Shared terrain height field so crops sit exactly on the rolling ground. */
function heightAt(x: number, z: number): number {
  return (
    0.55 * Math.sin(x * 0.35) * Math.cos(z * 0.32) +
    0.28 * Math.sin(x * 0.16 + 1.7) * Math.cos(z * 0.52 + 0.6) +
    0.14 * Math.sin(x * 0.7 + z * 0.3)
  );
}

const FIELD = {
  width: 44,
  depth: 44,
  rowSpacingX: 0.5, // gap between planted rows (furrows)
  plantStepZ: 0.34, // plant density along a row
  halfX: 9.5,
  halfZ: 9.5,
};

function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(FIELD.width, FIELD.depth, 140, 140);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#4a3524" roughness={1} metalness={0} />
    </mesh>
  );
}

function CropField() {
  const bushes = useMemo(() => {
    const arr: {
      position: [number, number, number];
      scale: [number, number, number];
      rotationY: number;
      color: string;
    }[] = [];
    // Warm dawn-lit greens.
    const palette = ["#3b7d4a", "#4a9057", "#2f6b3c", "#57a066"];
    let seed = 1;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let x = -FIELD.halfX; x <= FIELD.halfX; x += FIELD.rowSpacingX) {
      for (let z = -FIELD.halfZ; z <= FIELD.halfZ; z += FIELD.plantStepZ) {
        const jx = (rand() - 0.5) * 0.12;
        const jz = (rand() - 0.5) * 0.12;
        const px = x + jx;
        const pz = z + jz;
        const y = heightAt(px, pz);
        const s = 0.09 + rand() * 0.06;
        arr.push({
          position: [px, y + s * 0.7, pz],
          scale: [s, s * (1.3 + rand() * 0.6), s],
          rotationY: rand() * Math.PI,
          color: palette[Math.floor(rand() * palette.length)],
        });
      }
    }
    return arr;
  }, []);

  const count = bushes.length;

  return (
    <Instances limit={count} range={count} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.85} metalness={0} flatShading />
      {bushes.map((b, i) => (
        <Instance
          key={i}
          position={b.position}
          scale={b.scale}
          rotation={[0, b.rotationY, 0]}
          color={b.color}
        />
      ))}
    </Instances>
  );
}

function Drone() {
  const group = useRef<THREE.Group>(null);
  const propRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (group.current) {
      const rx = 3.4;
      const rz = 2.4;
      const x = Math.sin(t * 0.3) * rx;
      const z = Math.cos(t * 0.42) * rz;
      const y = 2.35 + heightAt(x, z) + Math.sin(t * 0.9) * 0.1;
      group.current.position.set(x, y, z);

      const dx = Math.cos(t * 0.3) * 0.3 * rx;
      const dz = -Math.sin(t * 0.42) * 0.42 * rz;
      group.current.rotation.y = Math.atan2(dx, dz);
      group.current.rotation.z = Math.sin(t * 0.9) * 0.05;
    }
    propRefs.current.forEach((p) => {
      if (p) p.rotation.y += 1.4;
    });
  });

  const arms: [number, number][] = [
    [0.26, 0.26],
    [-0.26, 0.26],
    [0.26, -0.26],
    [-0.26, -0.26],
  ];

  return (
    <group ref={group}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[0.34, 0.09, 0.34]} />
        <meshStandardMaterial color="#12181a" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Nav light — blooms */}
      <mesh position={[0, -0.02, 0.19]}>
        <boxGeometry args={[0.08, 0.05, 0.05]} />
        <meshStandardMaterial color="#39ffb0" emissive="#39ffb0" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>

      {arms.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.36, 6]} rotation={[0, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#12181a" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh
            ref={(el) => {
              propRefs.current[i] = el;
            }}
            position={[0, 0.04, 0]}
          >
            <cylinderGeometry args={[0.13, 0.13, 0.008, 12]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.32} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Glowing sun disc that the bloom pass flares out. */
function SunFlare() {
  return (
    <mesh position={SUN_POS}>
      <sphereGeometry args={[1.1, 24, 24]} />
      <meshBasicMaterial color="#ffe6b0" toneMapped={false} />
    </mesh>
  );
}

function HudChip({
  position,
  label,
  value,
  color,
}: {
  position: [number, number, number];
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Html position={position} center distanceFactor={7.5} occlude={false} zIndexRange={[1, 0]}>
      <div
        className="pointer-events-none select-none whitespace-nowrap rounded-md border bg-black/55 px-2.5 py-1.5 backdrop-blur-md"
        style={{ borderColor: color }}
      >
        <div className="font-mono text-[8px] font-bold uppercase tracking-[0.18em]" style={{ color }}>
          {label}
        </div>
        <div className="font-mono text-[10px] font-bold text-white">{value}</div>
      </div>
    </Html>
  );
}

function Scene() {
  const sunRef = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    if (sunRef.current) {
      sunRef.current.target.position.set(0, 0, 0);
      sunRef.current.target.updateMatrixWorld();
    }
  }, []);

  return (
    <>
      {/* Procedural dawn sky */}
      <Sky
        distance={450000}
        sunPosition={SUN_POS}
        inclination={0}
        azimuth={0.25}
        turbidity={9}
        rayleigh={3.2}
        mieCoefficient={0.02}
        mieDirectionalG={0.92}
      />

      {/* Warm sky bounce */}
      <hemisphereLight color="#ffd9a8" groundColor="#4a3a24" intensity={0.7} />
      <ambientLight intensity={0.22} />

      {/* Low golden sun — long dramatic shadows */}
      <directionalLight
        ref={sunRef}
        position={SUN_POS}
        intensity={2.4}
        color="#ffb867"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={48}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0004}
      />

      {/* Cool sky-side fill so backlit shadows don't go pure black */}
      <directionalLight position={[6, 5, 8]} intensity={0.4} color="#bcd4ff" />

      <SunFlare />
      <Terrain />
      <CropField />
      <Drone />

      <HudChip position={[2.8, 1.6, -1.2]} label="Soil" value="Optimal" color="#39ffb0" />
      <HudChip position={[-3.0, 2.0, 1.4]} label="NDVI" value="0.82" color="#4c9eff" />
      <HudChip position={[0.4, 2.7, -2.6]} label="Yield" value="+18%" color="#ffb454" />

      {/* Golden pollen drifting through the sun — blooms into glowing motes */}
      <Sparkles count={90} scale={[16, 4, 16]} size={2.6} speed={0.18} color="#ffe1a0" opacity={0.9} />
    </>
  );
}

export default function FarmDiorama() {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [6.5, 3.6, 6.5], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Warm haze fading the field into the dawn horizon */}
        <fog attach="fog" args={["#d9a874", 14, 38]} />
        <PresentationControls
          global
          polar={[-0.1, 0.16]}
          azimuth={[-0.28, 0.28]}
          config={{ mass: 1, tension: 170, friction: 26 }}
          snap
        >
          <Scene />
        </PresentationControls>

        <EffectComposer disableNormalPass>
          <Bloom
            intensity={0.9}
            luminanceThreshold={0.55}
            luminanceSmoothing={0.25}
            mipmapBlur
            radius={0.7}
          />
          <Vignette eskil={false} offset={0.4} darkness={0.3} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
