import L from 'leaflet';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { DeliveryRouteStop } from '../../types/api';

export type MapGroup = {
  key: string;
  lat: number;
  lng: number;
  pending: boolean;
  number: number;
  stops: DeliveryRouteStop[];
};

export function DeliveryMap({
  center,
  groups,
  selectedKey,
  onSelect,
}: {
  center: { lat: number; lng: number };
  groups: MapGroup[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView([center.lat, center.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    for (const group of groups) {
      const selected = group.key === selectedKey;
      const marker = L.marker([group.lat, group.lng], {
        icon: L.divIcon({
          className: '',
          html: `<span class="flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold shadow-md ${
            selected
              ? 'border-ink bg-gold text-ink'
              : group.pending
                ? 'border-white bg-blood text-white'
                : 'border-white bg-forest text-white'
          }">${group.number}</span>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
      });
      marker.on('click', () => onSelectRef.current(group.key));
      marker.addTo(layer);
    }
  }, [groups, selectedKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (groups.length === 1) {
      map.setView([groups[0].lat, groups[0].lng], 16);
    } else if (groups.length > 1) {
      map.fitBounds(
        L.latLngBounds(groups.map((group) => [group.lat, group.lng])),
        { padding: [36, 36], maxZoom: 16 },
      );
    } else {
      map.setView([center.lat, center.lng], 14);
    }
  }, [center.lat, center.lng, groups]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = groups.find((group) => group.key === selectedKey);
    if (!map || !selected) return;
    map.panTo([selected.lat, selected.lng]);
  }, [groups, selectedKey]);

  return (
    <div
      ref={containerRef}
      className="h-[55vh] min-h-[280px] w-full overflow-hidden rounded-3xl bg-paper-2 md:h-[62vh]"
    />
  );
}
