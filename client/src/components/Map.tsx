import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type MapCenter = { lat: number; lng: number };
type GoogleMap = {
  setCenter?: (center: MapCenter) => void;
  setZoom?: (zoom: number) => void;
};
type GoogleMapsGlobal = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: {
        zoom: number;
        center: MapCenter;
        mapTypeControl: boolean;
        fullscreenControl: boolean;
        zoomControl: boolean;
        streetViewControl: boolean;
        mapId: string;
      },
    ) => GoogleMap;
  };
};

declare global {
  interface Window {
    google?: GoogleMapsGlobal;
  }
}

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

let scriptLoadPromise: Promise<void> | null = null;

function loadMapScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: MapCenter;
  initialZoom?: number;
  onMapReady?: (map: GoogleMap) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<GoogleMap | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await loadMapScript();
        if (!mounted || !mapContainer.current) return;
        map.current = new window.google!.maps.Map(mapContainer.current, {
          zoom: initialZoom,
          center: initialCenter,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          streetViewControl: true,
          mapId: "DEMO_MAP_ID",
        });
        onMapReady?.(map.current);
      } catch (err) {
        console.error("Map init failed", err);
      }
    };
    init();
    return () => {
      mounted = false;
      if (mapContainer.current) {
        mapContainer.current.innerHTML = "";
      }
      map.current = null;
    };
  }, [initialCenter, initialZoom, onMapReady]);

  return <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />;
}
