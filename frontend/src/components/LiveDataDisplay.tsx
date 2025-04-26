import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { MQTTMessage, TemperaturePayload, GNSSPayload } from '../types';
import socketService from '../services/socket';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import SensorMap from './SensorMap';
import SensorDataSurface from './SensorDataSurface';
import { hashIdToColor } from '../lib/utils';

const LiveDataDisplay: React.FC = () => {
  const [messages, setMessages] = useState<MQTTMessage[]>([]);
  const [temperatureData, setTemperatureData] = useState<MQTTMessage[]>([]);
  const [gnssData, setGnssData] = useState<MQTTMessage[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const connectToSocket = () => {
    setConnectionError(null);
    
    try {
      // Make sure we're connected
      socketService.connect();
      setConnected(true);
      console.log("Attempting to connect to WebSocket...");
    } catch (err) {
      setConnectionError("Failed to connect to WebSocket server");
      console.error("WebSocket connection error:", err);
    }
  };
  
  useEffect(() => {
    // Subscribe to all MQTT messages
    const unsubscribeAll = socketService.subscribe('mqtt_message', (data: MQTTMessage) => {
      console.log("Received mqtt_message:", data);
      setMessages(prev => [data, ...prev].slice(0, 20));
      setConnected(true);
      setConnectionError(null);
    });
    
    // Subscribe to temperature sensor data
    const unsubscribeTemp = socketService.subscribe('sensors_temperature', (data: MQTTMessage) => {
      console.log("Received sensors_temperature:", data);
      setTemperatureData(prev => [data, ...prev].slice(0, 10));
      setConnected(true);
      setConnectionError(null);
    });
    
    // Subscribe to GNSS sensor data
    const unsubscribeGnss = socketService.subscribe('sensors_gnss', (data: MQTTMessage) => {
      console.log("Received sensors_gnss:", data);
      setGnssData(prev => [data, ...prev].slice(0, 10));
      setConnected(true);
      setConnectionError(null);
    });
    
    // Connect on component mount
    connectToSocket();
    
    // Clean up subscriptions on unmount
    return () => {
      unsubscribeAll();
      unsubscribeTemp();
      unsubscribeGnss();
    };
  }, []);
  
  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss');
    } catch (e) {
      return timestamp;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium">
                {connected ? 'Connected to WebSocket' : 'Disconnected'}
              </span>
            </div>
            
            {!connected && (
              <Button onClick={connectToSocket}>
                Reconnect
              </Button>
            )}
          </div>
          
          {connectionError && (
            <div className="mt-2 p-2 text-sm bg-red-50 text-red-600 rounded border border-red-200">
              {connectionError}
            </div>
          )}
        </CardContent>
      </Card>

      <SensorDataSurface temperatureData={temperatureData} gnssData={gnssData}/>
      
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="md:col-span-2 xl:col-span-2">
          <CardHeader>
            <CardTitle>Temperature, Moisture & Pressure</CardTitle>
            <CardDescription>Latest sensor readings with visualization</CardDescription>
          </CardHeader>
          <CardContent>
            {temperatureData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                {connected ? 'Waiting for data...' : 'Connect to see data'}
              </div>
            ) : (
              <Tabs defaultValue="gauge">
                <TabsList className="mb-4">
                  <TabsTrigger value="gauge">Gauges</TabsTrigger>
                  <TabsTrigger value="charts">Charts</TabsTrigger>
                  <TabsTrigger value="list">List</TabsTrigger>
                </TabsList>
                
                <TabsContent value="gauge">
                  <div className="space-y-4">
                    {temperatureData.reduce((acc, msg) => (
                        acc.some(m => m.payload.sensor_node === msg.payload.sensor_node) ? acc : [...acc, msg]
                      ), [] as typeof temperatureData).sort((a, b) => a.payload.sensor_node - b.payload.sensor_node).map((msg, idx) => {
                      const payload = msg.payload as TemperaturePayload;
                      
                      // Use default values if data is missing
                      // Default values or handle existing data
                      const temperature = payload.temperature || 0;
                      const moisture = payload.moisture || 0;
                      const pressure = payload.pressure || 1000; // Default atmospheric pressure if not present
                      
                      // Create data for the semi-circle gauge charts
                      const tempValue = Math.min(100, Math.max(0, (temperature + 20) * (100 / 60)));
                      const moistValue = Math.min(100, Math.max(0, moisture));
                      const pressValue = Math.min(100, Math.max(0, pressure - 950));
                      
                      // Colors based on temperature ranges
                      const getTempColor = (temp: number) => {
                        if (temp <= 5) return "#3b82f6"; // cool blue
                        if (temp <= 30) return "#10b981"; // green
                        if (temp <= 35) return "#f59e0b"; // orange
                        return "#ef4444"; // red
                      };
                      
                      // Colors based on moisture ranges
                      const getMoistColor = (moist: number) => {
                        if (moist <= 15) return "#ef4444"; // red - too dry
                        if (moist <= 30) return "#f59e0b"; // orange
                        if (moist <= 70) return "#10b981"; // green - good moisture
                        return "#3b82f6"; // blue - too wet
                      };
                      
                      // Colors based on pressure ranges
                      const getPressColor = (press: number) => {
                        if (press < 950) return "#ef4444"; // red - low pressure
                        if (press < 1020) return "#10b981"; // green - normal pressure
                        return "#f59e0b"; // orange - high pressure
                      };
                      
                      const tempColor = getTempColor(temperature);
                      const moistColor = getMoistColor(moisture);
                      const pressColor = getPressColor(pressure);
                      
                      return (
                        <div key={idx} className="border rounded-md p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="font-semibold text-lg">Node {payload.sensor_node}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatTimestamp(msg.timestamp)}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            {/* Temperature gauge */}
                            <div className="flex flex-col items-center">
                              <div className="w-full h-32 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={[
                                        { name: 'value', value: tempValue },
                                        { name: 'remainder', value: 100 - tempValue }
                                      ]}
                                      cx="50%"
                                      cy="100%"
                                      startAngle={180}
                                      endAngle={0}
                                      innerRadius={60}
                                      outerRadius={80}
                                      paddingAngle={0}
                                      dataKey="value"
                                    >
                                      <Cell key="value" fill={tempColor} />
                                      <Cell key="remainder" fill="#f1f1f1" />
                                    </Pie>
                                  </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-[-35%] text-center">
                                  <div className="text-3xl font-bold">{temperature.toFixed(1)}</div>
                                  <div className="text-xs font-medium">°C</div>
                                </div>
                              </div>
                              <div className="text-sm font-medium mt-1">Temperature</div>
                            </div>
                            
                            {/* Moisture gauge */}
                            <div className="flex flex-col items-center">
                              <div className="w-full h-32 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={[
                                        { name: 'value', value: moistValue },
                                        { name: 'remainder', value: 100 - moistValue }
                                      ]}
                                      cx="50%"
                                      cy="100%"
                                      startAngle={180}
                                      endAngle={0}
                                      innerRadius={60}
                                      outerRadius={80}
                                      paddingAngle={0}
                                      dataKey="value"
                                    >
                                      <Cell key="value" fill={moistColor} />
                                      <Cell key="remainder" fill="#f1f1f1" />
                                    </Pie>
                                  </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-[-35%] text-center">
                                  <div className="text-3xl font-bold">{moisture.toFixed(1)}</div>
                                  <div className="text-xs font-medium">%</div>
                                </div>
                              </div>
                              <div className="text-sm font-medium mt-1">Moisture</div>
                            </div>
                            
                            {/* Pressure gauge */}
                            <div className="flex flex-col items-center">
                              <div className="w-full h-32 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={[
                                        { name: 'value', value: pressValue },
                                        { name: 'remainder', value: 100 - pressValue }
                                      ]}
                                      cx="50%"
                                      cy="100%"
                                      startAngle={180}
                                      endAngle={0}
                                      innerRadius={60}
                                      outerRadius={80}
                                      paddingAngle={0}
                                      dataKey="value"
                                    >
                                      <Cell key="value" fill={pressColor} />
                                      <Cell key="remainder" fill="#f1f1f1" />
                                    </Pie>
                                  </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-[-35%] text-center">
                                  <div className="text-3xl font-bold">{pressure.toFixed(0)}</div>
                                  <div className="text-xs font-medium">hPa</div>
                                </div>
                              </div>
                              <div className="text-sm font-medium mt-1">Pressure</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
                
                <TabsContent value="charts">
                  <div className="space-y-6">
                    {/* Temperature multi-line chart */}
                    <div className="h-[180px]">
                      <div className="font-medium">Temperature</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={temperatureData.slice(0, 50).reverse()
                            .map(msg => {
                              const time = new Date(msg.timestamp);
                              return {
                                time: format(time, 'HH:mm:ss'),
                                timestamp: time.getTime(),
                              };
                            })
                            .sort((a, b) => a.timestamp - b.timestamp)
                            // Only keep unique timestamps for the x-axis
                            .filter((item, index, self) => 
                              index === self.findIndex(t => t.time === item.time)
                            )}
                          margin={{ top: 10, right: 30, left: 5, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                          <YAxis domain={['dataMin - 10', 'dataMax + 10']} tick={{ fontSize: 10 }} />
                          <Tooltip 
                            labelFormatter={(time) => `Time: ${time}`}
                            formatter={(value, name, props) => {
                              const sensorNode = (props.payload as any).sensor_node;
                              return [`${value}°C`, `Node ${sensorNode}`];
                            }}
                          />
                          <Legend formatter={(value) => {
                            return `Node ${value}`;
                          }} />
                          
                          {/* Generate a line for each unique sensor node */}
                          {temperatureData
                            .reduce((nodes, msg) => {
                              const nodeId = msg.payload.sensor_node;
                              return nodes.includes(nodeId) ? nodes : [...nodes, nodeId];
                            }, [] as number[])
                            .map(nodeId => (
                            <Line
                              key={nodeId}
                              type="monotone"
                              dataKey="temperature"
                              name={`${nodeId}`}
                              data={temperatureData.slice(0, 50).reverse()
                                .filter(msg => msg.payload.sensor_node === nodeId)
                                .map(msg => {
                                  const payload = msg.payload as TemperaturePayload;
                                  const time = new Date(msg.timestamp);
                                  return {
                                    time: format(time, 'HH:mm:ss'),
                                    timestamp: time.getTime(),
                                    sensor_node: payload.sensor_node,
                                    temperature: payload.temperature || 0
                                  };
                                }).sort((a, b) => a.timestamp - b.timestamp)}
                              stroke={hashIdToColor(nodeId)}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Moisture multi-line chart */}
                    <div className="h-[180px]">
                      <div className="font-medium">Moisture</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={temperatureData.slice(0, 50).reverse()
                            .map(msg => {
                              const time = new Date(msg.timestamp);
                              return {
                                time: format(time, 'HH:mm:ss'),
                                timestamp: time.getTime(),
                              };
                            })
                            .sort((a, b) => a.timestamp - b.timestamp)
                            // Only keep unique timestamps for the x-axis
                            .filter((item, index, self) => 
                              index === self.findIndex(t => t.time === item.time)
                            )}
                          margin={{ top: 10, right: 30, left: 5, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Tooltip 
                            labelFormatter={(time) => `Time: ${time}`}
                            formatter={(value, name, props) => {
                              const sensorNode = (props.payload as any).sensor_node;
                              return [`${value}%`, `Node ${sensorNode}`];
                            }}
                          />
                          <Legend formatter={(value) => {
                            return `Node ${value}`;
                          }} />
                          
                          {/* Generate a line for each unique sensor node */}
                          {temperatureData
                            .reduce((nodes, msg) => {
                              const nodeId = msg.payload.sensor_node;
                              return nodes.includes(nodeId) ? nodes : [...nodes, nodeId];
                            }, [] as number[])
                            .map(nodeId => (
                            <Line
                              key={nodeId}
                              type="monotone"
                              dataKey="moisture"
                              name={`${nodeId}`}
                              data={temperatureData.slice(0, 50).reverse()
                                .filter(msg => msg.payload.sensor_node === nodeId)
                                .map(msg => {
                                  const payload = msg.payload as TemperaturePayload;
                                  const time = new Date(msg.timestamp);
                                  return {
                                    time: format(time, 'HH:mm:ss'),
                                    timestamp: time.getTime(),
                                    sensor_node: payload.sensor_node,
                                    moisture: payload.moisture || 0
                                  };
                                }).sort((a, b) => a.timestamp - b.timestamp)}
                              stroke={hashIdToColor(nodeId)}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Pressure multi-line chart */}
                    <div className="h-[180px]">
                      <div className="font-medium">Pressure</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={temperatureData.slice(0, 50).reverse()
                            .map(msg => {
                              const time = new Date(msg.timestamp);
                              return {
                                time: format(time, 'HH:mm:ss'),
                                timestamp: time.getTime(),
                              };
                            })
                            .sort((a, b) => a.timestamp - b.timestamp)
                            // Only keep unique timestamps for the x-axis
                            .filter((item, index, self) => 
                              index === self.findIndex(t => t.time === item.time)
                            )}
                          margin={{ top: 10, right: 30, left: 5, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                          <YAxis domain={['dataMin - 10', 'dataMax + 10']} tick={{ fontSize: 10 }} />
                          <Tooltip 
                            labelFormatter={(time) => `Time: ${time}`}
                            formatter={(value, name, props) => {
                              const sensorNode = (props.payload as any).sensor_node;
                              return [`${value} hPa`, `Node ${sensorNode}`];
                            }}
                          />
                          <Legend formatter={(value) => {
                            return `Node ${value}`;
                          }} />
                          
                          {/* Generate a line for each unique sensor node */}
                          {temperatureData
                            .reduce((nodes, msg) => {
                              const nodeId = msg.payload.sensor_node;
                              return nodes.includes(nodeId) ? nodes : [...nodes, nodeId];
                            }, [] as number[])
                            .map(nodeId => (
                            <Line
                              key={nodeId}
                              type="monotone"
                              dataKey="pressure"
                              name={`${nodeId}`}
                              data={temperatureData.slice(0, 50).reverse()
                                .filter(msg => msg.payload.sensor_node === nodeId)
                                .map(msg => {
                                  const payload = msg.payload as TemperaturePayload;
                                  const time = new Date(msg.timestamp);
                                  return {
                                    time: format(time, 'HH:mm:ss'),
                                    timestamp: time.getTime(),
                                    sensor_node: payload.sensor_node,
                                    pressure: payload.pressure || 1000
                                  };
                                }).sort((a, b) => a.timestamp - b.timestamp)}
                              stroke={hashIdToColor(nodeId)}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="list">
                  <div className="space-y-4">
                  {temperatureData
                      .slice()
                      .reverse()
                      .reduce((acc, msg) => (
                        acc.some(m => m.payload.sensor_node === msg.payload.sensor_node) ? acc : [...acc, msg]
                      ), [] as typeof temperatureData)
                      .sort((a, b) => a.payload.sensor_node - b.payload.sensor_node)
                      .map((msg, idx) => {
                        const payload = msg.payload as TemperaturePayload;
                        const temperature = payload.temperature || 0;
                        const moisture = payload.moisture || 0;
                        const pressure = payload.pressure || 1000;

                        return (
                          <div key={idx} className="border rounded-md p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium">Node {payload.sensor_node}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatTimestamp(msg.timestamp)}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-sm">
                                <span className="text-muted-foreground mr-2">Temperature:</span>
                                <span className="font-medium">{temperature}°C</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-muted-foreground mr-2">Moisture:</span>
                                <span className="font-medium">{moisture}%</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-muted-foreground mr-2">Pressure:</span>
                                <span className="font-medium">{pressure} hPa</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      
        <Card className="xl:col-span-1">
            <SensorMap gnssData={gnssData} />
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Messages</CardTitle>
          <CardDescription>Raw message stream from all topics</CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              {connected ? 'Waiting for messages...' : 'Connect to see messages'}
            </div>
          ) : (
            <div className="h-[300px] overflow-y-auto space-y-2 border rounded-md p-3">
              {messages.map((msg, idx) => (
                <div key={idx} className="border-b last:border-0 pb-2 mb-2 last:pb-0 last:mb-0">
                  <div className="flex justify-between items-start">
                    <div className="font-medium">{msg.topic}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTimestamp(msg.timestamp)}
                    </div>
                  </div>
                  <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(msg.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveDataDisplay;
