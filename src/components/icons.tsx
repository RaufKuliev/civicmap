import type { SVGProps } from "react";

export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
}

export function RussiaSchematic() {
  return (
    <svg className="map-schematic" viewBox="0 0 760 360" role="img" aria-label="Схематичное изображение карты России">
      <path className="map-land" d="M49 172l26-18 25 3 12-22 29-7 12-27 34 11 17-20 38 16 28-5 21 21 37-9 27 16 31-4 28 17 45-14 42 13 31-10 45 19 32-4 31 15 42-7 37 15-6 24-30 6-15 23-47-5-22 17-42-3-20 22-48-12-21 19-35-10-27 20-33-17-31 8-27-17-28 12-22-20-28 4-17-19-25-3-15-27-34-4-13-26-27-3-8-29-21-10z" />
      <g className="map-lines">
        <path d="M112 145l41 75 34-112m0 0l55 107 33-109m0 0l45 119 40-126m0 0l46 130 39-133m0 0l40 126 45-116m0 0l35 103 54-93" />
        <path d="M81 176l614 17M128 128l522 108" />
      </g>
      <g className="map-points"><circle cx="167" cy="175" r="6" /><circle cx="200" cy="187" r="5" /><circle cx="301" cy="183" r="5" /></g>
    </svg>
  );
}
