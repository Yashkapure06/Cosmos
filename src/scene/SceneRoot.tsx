import { Suspense } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Earth } from "./Earth";
import { Moon } from "./Moon";
import { Sun } from "./Sun";
import { Planets } from "./Planets";
import { OrbitLines } from "./OrbitLines";
import { Markers } from "./Markers";
import { Spacecraft } from "./Spacecraft";
import { AsteroidBelt } from "./AsteroidBelt";
import { SunLight } from "./Lighting";
import { StarField } from "./Stars";
import { Satellites } from "./Satellites";
import { SelectedSatellite } from "./SelectedSatellite";
import { CameraRig } from "./CameraRig";
import { Picker } from "./Picker";
import { EarthFrame, FrameDriver, ScrollNavigator } from "./FocusSystem";

export function SceneRoot() {
  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, 2]}
      camera={{ fov: 42, near: 0.05, far: 5_000_000, position: [0.2, 0.6, 8.5] }}
      gl={{
        antialias: true,
        logarithmicDepthBuffer: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
        powerPreference: "high-performance",
      }}
    >
      <FrameDriver />
      <SunLight />
      <Suspense fallback={null}>
        <StarField />
        <Sun />
        <Planets />
        <OrbitLines />
        <AsteroidBelt />
        <EarthFrame>
          <Earth />
          <Moon />
          <Satellites />
          <SelectedSatellite />
        </EarthFrame>
        <Spacecraft />
        <Markers />
      </Suspense>
      <CameraRig />
      <ScrollNavigator />
      <Picker />
    </Canvas>
  );
}
