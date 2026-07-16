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
import { NamedAsteroids } from "./NamedAsteroids";
import { Comets } from "./Comets";
import { Galaxy } from "./Galaxy";
import { KuiperBelt, OortCloud } from "./OuterBelts";
import { SunLight } from "./Lighting";
import { StarField } from "./Stars";
import { RealStars } from "./RealStars";
import { Constellations } from "./Constellations";
import { DeepSky } from "./DeepSky";
import { MeteorShowers } from "./MeteorShowers";
import { Supernovae } from "./Supernovae";
import { OrionNursery } from "./OrionNursery";
import { EclipseShadows } from "./EclipseShadows";
import { RemoteStars } from "./RemoteStars";
import { BlackHole } from "./BlackHole";
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
      camera={{ fov: 42, near: 0.05, far: 40_000_000, position: [0.2, 0.6, 8.5] }}
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
        <RealStars />
        <Constellations />
        <DeepSky />
        <MeteorShowers />
        <Supernovae />
        <Galaxy />
        <OrionNursery />
        <BlackHole />
        <Sun />
        <RemoteStars />
        <Planets />
        <OrbitLines />
        <AsteroidBelt />
        <NamedAsteroids />
        <Comets />
        <KuiperBelt />
        <OortCloud />
        <EclipseShadows />
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
