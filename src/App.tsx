import { SceneRoot } from "./scene/SceneRoot";
import { HUD } from "./ui/HUD";
import { SearchBar } from "./ui/SearchBar";
import { FilterRail } from "./ui/FilterRail";
import { InfoPanel } from "./ui/InfoPanel";
import { CraftPanel } from "./ui/CraftPanel";
import { BodyPanel } from "./ui/BodyPanel";
import { TourButton } from "./ui/TourButton";
import { EventsMenu } from "./ui/EventsMenu";
import { TimeControls } from "./ui/TimeControls";
import { Ticker } from "./ui/Ticker";
import { FlyToggle } from "./ui/AstronautToggle";
import { ControlsHelp } from "./ui/ControlsHelp";
import { LevelTitle } from "./ui/LevelTitle";
import { ScaleRuler } from "./ui/ScaleRuler";
import { LoadingOverlay } from "./ui/LoadingOverlay";
import { useBootstrap } from "./hooks/useBootstrap";

export default function App() {
  useBootstrap();

  return (
    <div className="app">
      <SceneRoot />
      <div className="hud">
        <HUD />
        <LevelTitle />
        <SearchBar />
        <FilterRail />
        <InfoPanel />
        <CraftPanel />
        <BodyPanel />
        <TimeControls />
        <TourButton />
        <EventsMenu />
        <ScaleRuler />
        <Ticker />
        <FlyToggle />
        <ControlsHelp />
      </div>
      <LoadingOverlay />
    </div>
  );
}
