import React, { useMemo, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { MQTTMessage, GNSSPayload, TemperaturePayload } from '../types';
import { hashIdToColor, gaussianRBF, euclidean, computeRBFInterpolator } from '../lib/utils';
import { Color, BufferGeometry, Float32BufferAttribute, MeshBasicMaterial } from 'three';

interface SensorDataSurfaceProps {
  gnssData: MQTTMessage[];
  temperatureData: MQTTMessage[];
}

interface SensorPoint {
  nodeId: number;
  x: number;
  y: number;
  z: number;
  color: string;
  value: number;
}

const DataPoint: React.FC<{ point: SensorPoint; size?: number }> = ({ point, size = 0.5 }) => {
  return (
    <mesh position={[point.x, point.z, point.y]}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial 
        color={point.color} 
        emissive={point.color}
        emissiveIntensity={0.5}
        metalness={0.7}
        roughness={0.2}
      />
    </mesh>
  );
};

const DataPoints: React.FC<{ points: SensorPoint[] }> = ({ points }) => {
  return <>{points.map((point, idx) => <DataPoint key={idx} point={point} />)}</>;
};

const RBFGrid: React.FC<{ sensorPoints: SensorPoint[]; gridSize?: number }> = ({ sensorPoints, gridSize = 1 }) => {
  // Check if we have enough points for interpolation
  if (sensorPoints.length < 2) {
    return null;
  }
  
  const points: [number, number][] = sensorPoints.map(({ x, y }) => [x, y]);
  const values = sensorPoints.map(({ z }) => z);

  const rbfInterpolator = useMemo(() => {
    try {
      return computeRBFInterpolator(points, values);
    } catch (error) {
      console.error("Failed to compute RBF interpolator:", error);
      return null;
    }
  }, [points, values]);
  
  // If interpolation failed, don't render anything
  if (!rbfInterpolator) return null;

  const xMin = Math.floor(Math.min(...sensorPoints.map(p => p.x)));
  const xMax = Math.ceil(Math.max(...sensorPoints.map(p => p.x)));
  const yMin = Math.floor(Math.min(...sensorPoints.map(p => p.y)));
  const yMax = Math.ceil(Math.max(...sensorPoints.map(p => p.y)));
  let zMin = Math.floor(Math.min(...sensorPoints.map(p => p.z)));
  let zMax = Math.ceil(Math.max(...sensorPoints.map(p => p.z)));

  // Ensure we have at least some grid size
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const cols = Math.floor(xRange / gridSize) + 1;
  const rows = Math.floor(yRange / gridSize) + 1;

  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];

  for (let yIdx = 0; yIdx < rows; yIdx++) {
    for (let xIdx = 0; xIdx < cols; xIdx++) {
      const x = xMin + xIdx * gridSize;
      const y = yMin + yIdx * gridSize;
      let z = 0;

      try {
        z = rbfInterpolator(x, y);
      } catch (error) {
        console.error(`Interpolation failed at (${x}, ${y})`, error);
      }

      if (z > zMax) {
        zMax = z;
      } else if (z < zMin) {
          zMin = z;
      }


      positions.push(x, z, y);
    }
  }

  for (let i = 1; i < positions.length; i+=3) {
      // Create a color gradient based on the y-value
      const gradient = (positions[i] - zMin) / (zMax - zMin); // Normalize Z value to range [0, 1]
      const color = new Color().lerpColors(
        new Color('blue'),    // Start color (for low Z) 
        new Color('orange'),  // End color (for high Z)
        gradient
      );

      colors.push(color.r, color.g, color.b); // Store the color for each vertex
  }

  for (let yIdx = 0; yIdx < rows - 1; yIdx++) {
    for (let xIdx = 0; xIdx < cols - 1; xIdx++) {
      const i = yIdx * cols + xIdx;
      indices.push(i, i + cols, i + 1);
      indices.push(i + 1, i + cols, i + cols + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); // Apply colors here
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors={true} // Enable vertex colors
        opacity={0.6}
        transparent
        wireframe={false} // Set to true if you want wireframe style
      />
    </mesh>
  );
};

const SensorDataSurface: React.FC<SensorDataSurfaceProps> = ({ gnssData, temperatureData }) => {
  const [dataType, setDataType] = useState<'elevation' | 'pressure' | 'moisture' | 'temperature'>('temperature');
  const [sensorPoints, setSensorPoints] = useState<SensorPoint[]>([]);

  useEffect(() => {
    const gnssMap = new Map<number, GNSSPayload>();
    const tempMap = new Map<number, TemperaturePayload>();

    gnssData.forEach(msg => {
      const payload = msg.payload as GNSSPayload;
      const nodeId = payload.sensor_node;
      if (!gnssMap.has(nodeId) || new Date(msg.timestamp) > new Date(gnssMap.get(nodeId)!.timestamp)) {
        gnssMap.set(nodeId, payload);
      }
    });

    temperatureData.forEach(msg => {
      const payload = msg.payload as TemperaturePayload;
      const nodeId = payload.sensor_node;
      if (!tempMap.has(nodeId) || new Date(msg.timestamp) > new Date(tempMap.get(nodeId)!.timestamp)) {
        tempMap.set(nodeId, payload);
      }
    });

    const rawPoints: { nodeId: number; originalX: number; originalY: number; z: number; color: string; value: number }[] = [];
    const xValues: number[] = [];
    const yValues: number[] = [];

    gnssMap.forEach((gnssPayload, nodeId) => {
      if (tempMap.has(nodeId)) {
        const tempPayload = tempMap.get(nodeId)!;
        let zValue = 0;
        let rawValue = 0;

        switch (dataType) {
          case 'elevation': {
            const pressure = tempPayload.pressure || 1013.25;
            zValue = 44330 * (1 - Math.pow(pressure / 1013.25, 0.1903));
            zValue *= pressure < 1013.25 ? -1 : 1;
            rawValue = zValue;
            break;
          }
          case 'pressure': {
            rawValue = tempPayload.pressure || 1013;
            zValue = (rawValue - 1013) / 10;
            break;
          }
          case 'moisture': {
            rawValue = tempPayload.moisture || 50;
            zValue = rawValue / 5 - 10;
            break;
          }
          case 'temperature': {
            rawValue = tempPayload.temperature || 20;
            zValue = rawValue - 20;
            break;
          }
        }

        zValue = Math.max(zValue, 1);

        xValues.push(gnssPayload.longitude);
        yValues.push(gnssPayload.latitude);

        const nodeColor = hashIdToColor(nodeId);

        rawPoints.push({ nodeId, originalX: gnssPayload.longitude, originalY: gnssPayload.latitude, z: zValue, color: nodeColor, value: rawValue });
      }
    });

    if (rawPoints.length === 0) return;

    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const latLonToMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371000;
      const lat1Rad = lat1 * Math.PI / 180;
      const lat2Rad = lat2 * Math.PI / 180;
      const lon1Rad = lon1 * Math.PI / 180;
      const lon2Rad = lon2 * Math.PI / 180;
      const dLon = lon2Rad - lon1Rad;
      const dx = R * Math.cos((lat1Rad + lat2Rad) / 2) * dLon;
      const dLat = lat2Rad - lat1Rad;
      const dy = R * dLat;
      return { dx, dy };
    };

    const refLat = (minY + maxY) / 2;
    const refLon = (minX + maxX) / 2;

    const normalizedPoints: SensorPoint[] = rawPoints.map(point => {
      const { dx, dy } = latLonToMeters(refLat, refLon, point.originalY, point.originalX);
      return { nodeId: point.nodeId, x: dx, y: dy, z: point.z, color: point.color, value: point.value };
    });

    setSensorPoints(normalizedPoints);
  }, [gnssData, temperatureData, dataType]);

  const renderDataInfo = () => {
    let units = '';
    switch (dataType) {
      case 'elevation': units = 'm'; break;
      case 'pressure': units = 'hPa'; break;
      case 'moisture': units = '%'; break;
      case 'temperature': units = '°C'; break;
    }
    return (
      <div className="flex flex-col gap-1 mt-2 text-xs">
        <div className="font-semibold text-base">{dataType.charAt(0).toUpperCase() + dataType.slice(1)} ({units})</div>
        <div className="mt-2">
          <p className="font-medium text-sm mb-1">Node Information:</p>
          {sensorPoints.map((point) => (
            <div key={point.nodeId} className="flex items-center mb-1">
              <div className="w-4 h-4 mr-2" style={{ backgroundColor: point.color }}></div>
              <span className="text-xs">
                Node {point.nodeId}: {point.value.toFixed(1)} {units}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>3D Sensor Data Visualization</CardTitle>
        <CardDescription>Visualize sensor data across the soil mesh network</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="temperature" value={dataType} onValueChange={(value) => setDataType(value as any)} className="mb-2">
          <TabsList>
            <TabsTrigger value="temperature">Temperature</TabsTrigger>
            <TabsTrigger value="moisture">Moisture</TabsTrigger>
            <TabsTrigger value="pressure">Pressure</TabsTrigger>
            <TabsTrigger value="elevation">Elevation</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-3 h-[400px] border rounded-md overflow-hidden">
            {sensorPoints.length > 0 ? (
              <Canvas camera={{ position: [0, 20, 20], fov: 60 }}>
                <ambientLight intensity={0.6} />
                <pointLight position={[10, 10, 20]} intensity={1.0} />
                <directionalLight position={[-5, 5, 15]} intensity={0.7} />
                <spotLight position={[0, 0, 20]} angle={0.5} penumbra={0.8} intensity={0.8} castShadow />
                <DataPoints points={sensorPoints} />
                {sensorPoints.length >= 2 && <RBFGrid sensorPoints={sensorPoints} />}
                <gridHelper args={[2000, 2000, 0xeeeeee, 0xdddddd]} />
                <axesHelper args={[10]} />
                <OrbitControls enablePan enableZoom enableRotate minDistance={5} maxDistance={100} target={[0, 0, 0]} />
              </Canvas>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Waiting for sensor data...
              </div>
            )}
          </div>
          <div className="col-span-1">
            {renderDataInfo()}
            <div className="mt-4 text-xs text-muted-foreground">
              <p className="mb-2">This 3D visualization shows the actual sensor nodes in space.</p>
              <p className="mb-2">• Each node has a unique color based on its ID</p>
              <p className="mb-2">• Z axis height represents the selected data type</p>
              <p className="mb-2">• X and Y axes show actual real-world distances in meters</p>
              <p>• 1 unit on the grid = 1 meter</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SensorDataSurface;
