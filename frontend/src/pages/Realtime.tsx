import React, { useEffect } from 'react';
import LiveDataDisplay from '../components/LiveDataDisplay';
import SensorDataSurface from '../components/SensorDataSurface';
import socketService from '../services/socket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const Realtime: React.FC = () => {
  useEffect(() => {
    // Connect to the WebSocket when the component mounts
    socketService.connect();
    
    // Clean up the WebSocket connection when the component unmounts
    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Real-Time Sensor Data</h1>
        <p className="text-muted-foreground mt-1">
          Live streaming data from the Dirt Mesh LA sensor network
        </p>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Live Streaming</CardTitle>
          <CardDescription>
            Data is streamed in real-time via WebSockets from the MQTT broker
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page shows real-time data as it arrives from the sensors. The data is streamed from the MQTT broker to the server,
            and then to the browser via WebSockets. The temperature and distance data are displayed separately, and all messages are
            shown in the raw message feed below.
          </p>
        </CardContent>
      </Card>
      
      <LiveDataDisplay />
    </div>
  );
};

export default Realtime;

