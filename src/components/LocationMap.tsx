import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MapCoords = { lat: number; lon: number };

type Props = {
  location: string;
  onLocationChange: (value: string) => void;
  onCoordsChange?: (coords: MapCoords | null) => void;
  className?: string;
};

/**
 * Physical-job location picker: geolocation + Leaflet/OpenStreetMap.
 * Falls back to a plain text field if permission is denied or Leaflet fails.
 */
export function LocationMap({
  location,
  onLocationChange,
  onCoordsChange,
  className,
}: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);

  const [coords, setCoords] = useState<MapCoords | null>(null);
  const [geoStatus, setGeoStatus] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [mapReady, setMapReady] = useState(false);

  // Request browser geolocation once
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("denied");
      onCoordsChange?.(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(next);
        onCoordsChange?.(next);
        setGeoStatus("ready");

        // Reverse-geocode city name (Nominatim — free, no key)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${next.lat}&lon=${next.lon}`,
            { headers: { Accept: "application/json" } },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              address?: {
                city?: string;
                town?: string;
                village?: string;
                state?: string;
                country?: string;
              };
              display_name?: string;
            };
            const city =
              data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              data.address?.state;
            if (city) {
              const label = data.address?.country
                ? `${city}, ${data.address.country}`
                : city;
              onLocationChange(label);
            } else if (data.display_name && !location.trim()) {
              onLocationChange(data.display_name.split(",").slice(0, 2).join(",").trim());
            }
          }
        } catch (e) {
          console.warn("[LocationMap] reverse geocode failed", e);
        }
      },
      (err) => {
        console.warn("[LocationMap] geolocation denied/failed", err);
        setGeoStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
        onCoordsChange?.(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // Init / update Leaflet map when we have coords
  useEffect(() => {
    if (!coords || !mapEl.current || geoStatus !== "ready") return;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        // Ensure default marker icons resolve (Vite asset paths)
        // @ts-expect-error leaflet icon url patch
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        // Load CSS once
        if (!document.getElementById("leaflet-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }

        if (cancelled || !mapEl.current) return;

        if (!mapRef.current) {
          mapRef.current = L.map(mapEl.current).setView([coords.lat, coords.lon], 13);
          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
            maxZoom: 19,
          }).addTo(mapRef.current);
          markerRef.current = L.marker([coords.lat, coords.lon]).addTo(mapRef.current);
          setMapReady(true);
          // Fix grey tiles when container was hidden during init
          setTimeout(() => mapRef.current?.invalidateSize(), 100);
        } else {
          mapRef.current.setView([coords.lat, coords.lon], 13);
          markerRef.current?.setLatLng([coords.lat, coords.lon]);
        }
      } catch (e) {
        console.error("[LocationMap] leaflet init failed", e);
        setGeoStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coords, geoStatus]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const showMap = geoStatus === "ready" && coords;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
        <input
          type="text"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          placeholder="City or area e.g. Ikeja, Lagos"
          className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-border bg-card text-base focus:border-primary outline-none"
        />
      </div>

      {geoStatus === "loading" && (
        <div className="h-48 rounded-2xl border border-border bg-muted flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Detecting your location…
        </div>
      )}

      {showMap && (
        <div
          id="map-container"
          ref={mapEl}
          className="h-48 w-full rounded-2xl overflow-hidden border border-border z-0"
          style={{ minHeight: 192 }}
        />
      )}

      {(geoStatus === "denied" || geoStatus === "error") && (
        <p className="text-xs text-muted-foreground">
          {geoStatus === "denied"
            ? "Location access was denied. Enter your city or area above."
            : "Could not load the map. Enter your city or area above."}
        </p>
      )}

      {showMap && mapReady && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your exact address is only shared with the worker you hire — not shown publicly
        </p>
      )}
      {!showMap && geoStatus !== "loading" && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your exact address is only shared with the worker you hire — not shown publicly
        </p>
      )}
    </div>
  );
}
