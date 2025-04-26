import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Popup, CircleMarker } from 'react-leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { MQTTMessage, GNSSPayload } from '../types';
import { format } from 'date-fns';
import { hashIdToColor } from '../lib/utils';
import L from 'leaflet';

// Fix Leaflet icon issues by setting default icon options directly
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface SensorMapProps {
  gnssData: MQTTMessage[];
}

interface SensorPosition {
  sensor_node: number;
  longitude: number;
  latitude: number;
  timestamp: string;
  lastUpdate: string;
}


const SensorMap: React.FC<SensorMapProps> = ({ gnssData }) => {
  const [sensorPositions, setSensorPositions] = useState<Record<number, SensorPosition>>({});

  // Process GNSS data and update positions
  useEffect(() => {
    if (gnssData.length === 0) return;

    const updatedPositions = { ...sensorPositions };

    gnssData.forEach((message) => {
      const payload = message.payload as GNSSPayload;
      const sensorId = payload.sensor_node;

      if (
        !updatedPositions[sensorId] ||
        new Date(message.timestamp) > new Date(updatedPositions[sensorId].lastUpdate)
      ) {
        updatedPositions[sensorId] = {
          sensor_node: sensorId,
          longitude: payload.longitude,
          latitude: payload.latitude,
          timestamp: payload.timestamp,
          lastUpdate: message.timestamp,
        };
      }
    });

    setSensorPositions(updatedPositions);
  }, [gnssData, sensorPositions]);

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss');
    } catch (e) {
      return timestamp;
    }
  };

  const sensorArray = Object.values(sensorPositions);

  if (sensorArray.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Sensor Map</CardTitle>
          <CardDescription>Real-time sensor locations</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <div className="text-muted-foreground">Waiting for sensor location data...</div>
        </CardContent>
      </Card>
    );
  }

  const minLng = Math.min(...sensorArray.map((s) => s.longitude));
  const maxLng = Math.max(...sensorArray.map((s) => s.longitude));
  const minLat = Math.min(...sensorArray.map((s) => s.latitude));
  const maxLat = Math.max(...sensorArray.map((s) => s.latitude));

  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Sensor Map</CardTitle>
        <CardDescription>Real-time sensor locations</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <MapContainer center={[centerLat, centerLng]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {sensorArray.map((sensor) => (
            <CircleMarker
              key={sensor.sensor_node}
              center={[sensor.latitude, sensor.longitude]}
              radius={10}
              pathOptions={{
                fillColor: hashIdToColor(sensor.sensor_node),
                color: 'white',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8,
              }}
            >
              <Popup>
                <div>
                  <h3 className="font-bold">Node {sensor.sensor_node}</h3>
                  <p>Longitude: {sensor.longitude.toFixed(2)}</p>
                  <p>Latitude: {sensor.latitude.toFixed(2)}</p>
                  <p className="text-xs mt-2">Updated: {formatTimestamp(sensor.lastUpdate)}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        <div className="mt-4 text-xs text-muted-foreground text-center">
          Showing {sensorArray.length} active sensors.
        </div>

        {/* Color legend */}
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
          {sensorArray.map((sensor) => (
            <div key={sensor.sensor_node} className="flex items-center gap-2">
              <span
                className="inline-block w-4 h-4 rounded-full"
                style={{ backgroundColor: hashIdToColor(sensor.sensor_node) }}
              ></span>
              <span>Node {sensor.sensor_node}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SensorMap;

