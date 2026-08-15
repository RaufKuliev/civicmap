"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import mapRegions from "@/data/regions-map.json";

type MapRegion = { id: string | null; name: string; path: string };
const regions = mapRegions as MapRegion[];

export function RegionMap() {
  const [zoom, setZoom] = useState(1);

  const width = 900 / zoom;
  const height = 420 / zoom;
  const viewBox = `${(900 - width) / 2} ${(420 - height) / 2} ${width} ${height}`;

  return (
    <div className="region-map" aria-label="Интерактивная карта регионов">
      <div className="map-controls" aria-label="Масштаб карты">
        <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.5))} aria-label="Приблизить"><Plus /></button>
        <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} aria-label="Отдалить"><Minus /></button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Сбросить масштаб"><RotateCcw /></button>
      </div>
      <svg viewBox={viewBox} role="img" aria-label="Карта регионов России" preserveAspectRatio="xMidYMid meet">
          {regions.map((region, index) => region.id ? (
            <Link href={`/regions/${region.id}/`} key={`${region.id}-${index}`} aria-label={region.name}>
              <path d={region.path} className="region-shape region-shape-linked"><title>{region.name}</title></path>
            </Link>
          ) : <path d={region.path} className="region-shape" key={`unlinked-${index}`}><title>{region.name}</title></path>)}
      </svg>
      <span className="map-credit">Natural Earth · справочный слой</span>
    </div>
  );
}
