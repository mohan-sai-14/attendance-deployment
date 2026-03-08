import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';

// Fix leaflet icon paths in Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  defaultLocation?: { lat: number; lng: number } | null;
}

// Subcomponent to handle Map invalidation when Dialog opens (fixes blank map on desktop)
function MapEffect() {
  const map = useMap();
  useEffect(() => {
    // Wait a brief moment for the dialog animation to finish, then resize map
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timeout);
  }, [map]);
  return null;
}

// Subcomponent to handle the GeoSearch Bar
function SearchField({ setPosition }: { setPosition: (pos: L.LatLng) => void }) {
  const map = useMap();

  useEffect(() => {
    const provider = new OpenStreetMapProvider();
    const searchControl = new (GeoSearchControl as any)({
      provider: provider,
      style: 'bar',
      showMarker: false,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      keepResult: false,
      searchLabel: 'Enter address or city...'
    });

    map.addControl(searchControl);

    map.on('geosearch/showlocation', (result: any) => {
      if (result && result.location) {
        const { x, y } = result.location;
        setPosition(new L.LatLng(y, x));
      }
    });

    return () => {
      map.removeControl(searchControl);
      map.off('geosearch/showlocation');
    };
  }, [map, setPosition]);

  return null;
}

function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

export function LocationPicker({ onLocationSelect, defaultLocation }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  
  // Create an initial center based on defaultLocation or a generic fallback
  const initialCenter = defaultLocation ? new L.LatLng(defaultLocation.lat, defaultLocation.lng) : new L.LatLng(17.3850, 78.4867); // Default to Hyderabad
  
  const [position, setPosition] = useState<L.LatLng | null>(initialCenter);

  // Sync position if defaultLocation prop changes from outside
  useEffect(() => {
    if (defaultLocation) {
        setPosition(new L.LatLng(defaultLocation.lat, defaultLocation.lng));
    }
  }, [defaultLocation]);

  const handleConfirm = () => {
    if (position) {
      onLocationSelect(position.lat, position.lng);
      setOpen(false);
    }
  };

  return (
    <>
      <Button 
        type="button" 
        variant="outline" 
        className="w-full border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
        onClick={() => setOpen(true)}
      >
        <MapPin className="mr-2 h-4 w-4" />
        {defaultLocation ? 'Adjust Map Location' : 'Override GPS Location (Manual Pin)'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[700px] h-[90vh] sm:h-[80vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>Select Classroom Location</DialogTitle>
            <DialogDescription>
              Search for your college/building or click on the map to drop a pin. This exact location restricts where students can scan the QR code.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 w-full rounded-md overflow-hidden border mt-2 relative z-0">
            {open && ( 
                <MapContainer 
                  center={initialCenter} 
                  zoom={16} 
                  scrollWheelZoom={true} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapEffect />
                  <SearchField setPosition={setPosition} />
                  <LocationMarker position={position} setPosition={setPosition} />
                </MapContainer>
            )}
          </div>
          
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
             <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
             <Button type="button" onClick={handleConfirm} disabled={!position}>Confirm Location</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
