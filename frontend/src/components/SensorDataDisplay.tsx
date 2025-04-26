import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Bar, ScatterChart, Scatter, ZAxis, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { format, parseISO, subHours } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Node, NodeReadings, Reading } from '../types';

interface SensorDataDisplayProps {
  readings: NodeReadings;
  nodes: Node[];
}

interface ChartDataPoint {
  timestamp: string;
  formattedTime: string;
  [key: string]: string | number;
}

const SensorDataDisplay: React.FC<SensorDataDisplayProps> = ({ readings, nodes }) => {
  const nodeMap = new Map<string, Node>();
  nodes.forEach(node => nodeMap.set(node.nodeId, node));

  // Check if we have any readings
  const hasReadings = Object.keys(readings).length > 0;
  
  if (!hasReadings) {
    return (
      <div className="flex items-center justify-center h-64 p-4 border rounded-md bg-muted/40">
        <p className="text-muted-foreground">No sensor data to display. Select nodes to view their data.</p>
      </div>
    );
  }

  // Process readings for temperature chart
  const tempChartData: ChartDataPoint[] = [];
  const moistureChartData: ChartDataPoint[] = [];
  const pressureChartData: ChartDataPoint[] = [];
  
  // Process each node's readings
  Object.entries(readings).forEach(([nodeId, nodeReadings]) => {
    const nodeName = nodeMap.get(nodeId)?.name || `Node ${nodeId}`;
    
    // Sort readings by timestamp
    const sortedReadings = [...nodeReadings].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Add each reading to the chart data
    sortedReadings.forEach((reading) => {
      try {
        // Format timestamp for display
        const date = parseISO(reading.timestamp);
        const formattedTime = format(date, 'HH:mm:ss');
        
        // Add to temperature chart data
        const tempPointIndex = tempChartData.findIndex(p => p.timestamp === reading.timestamp);
        if (tempPointIndex === -1) {
          tempChartData.push({ 
            timestamp: reading.timestamp,
            formattedTime,
            [nodeName]: reading.temperature
          });
        } else {
          tempChartData[tempPointIndex][nodeName] = reading.temperature;
        }
        
        // Add to moisture chart data
        const moistValue = reading.moisture || 0;
        const moisturePointIndex = moistureChartData.findIndex(p => p.timestamp === reading.timestamp);
        if (moisturePointIndex === -1) {
          moistureChartData.push({ 
            timestamp: reading.timestamp,
            formattedTime,
            [nodeName]: moistValue
          });
        } else {
          moistureChartData[moisturePointIndex][nodeName] = moistValue;
        }
        
        // Add to pressure chart data (with default value for backward compatibility)
        const pressValue = reading.pressure || 1000;
        const pressurePointIndex = pressureChartData.findIndex(p => p.timestamp === reading.timestamp);
        if (pressurePointIndex === -1) {
          pressureChartData.push({ 
            timestamp: reading.timestamp,
            formattedTime,
            [nodeName]: pressValue
          });
        } else {
          pressureChartData[pressurePointIndex][nodeName] = pressValue;
        }
      } catch (e) {
        console.error('Error processing timestamp:', reading.timestamp, e);
      }
    });
  });
  
  // Sort chart data by timestamp
  tempChartData.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  moistureChartData.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  pressureChartData.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  
  // Generate a unique color for each node
  const getNodeColor = (index: number) => {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
      '#ec4899', '#06b6d4', '#84cc16', '#f43f5e', '#6366f1'
    ];
    return colors[index % colors.length];
  };
  
  // Get the list of selected node names
  const selectedNodeNames = Object.keys(readings).map((nodeId, index) => {
    return {
      id: nodeId,
      name: nodeMap.get(nodeId)?.name || `Node ${nodeId}`,
      color: getNodeColor(index)
    };
  });

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(parseISO(timestamp), 'MMM dd, yyyy HH:mm:ss');
    } catch (e) {
      return timestamp;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sensor Readings</CardTitle>
          <CardDescription>
            Visualizing temperature, moisture, and pressure data from selected nodes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="temperature">
            <TabsList className="mb-4">
              <TabsTrigger value="temperature">Temperature</TabsTrigger>
              <TabsTrigger value="moisture">Moisture</TabsTrigger>
              <TabsTrigger value="pressure">Pressure</TabsTrigger>
              <TabsTrigger value="combined">Combined View</TabsTrigger>
              <TabsTrigger value="radar">Radar Analysis</TabsTrigger>
            </TabsList>
            
            <TabsContent value="temperature" className="space-y-4">
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={tempChartData}
                    margin={{ top: 15, right: 30, left: 20, bottom: 15 }}
                  >
                    <defs>
                      {selectedNodeNames.map((node, index) => (
                        <linearGradient key={node.id} id={`colorTemp${node.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={node.color} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={node.color} stopOpacity={0.15}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ccc" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="formattedTime" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      interval="preserveStartEnd"
                      label={{ value: 'Time', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      label={{ 
                        value: 'Temperature (°C)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: '#666' },
                        offset: -5
                      }}
                      tick={{ fontSize: 12, fill: '#666' }}
                    />
                    <Tooltip 
                      formatter={(value) => [`${value}°C`, '']}
                      labelFormatter={(label) => `Time: ${label}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                    <Legend 
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ paddingTop: '10px' }}
                    />
                    <ReferenceLine y={20} label="Min Comfort" stroke="rgba(255, 99, 132, 0.5)" strokeDasharray="3 3" />
                    <ReferenceLine y={25} label="Max Comfort" stroke="rgba(75, 192, 192, 0.5)" strokeDasharray="3 3" />
                    {selectedNodeNames.map((node, index) => (
                      <Area
                        key={node.id}
                        type="monotone"
                        dataKey={node.name}
                        stroke={node.color}
                        fillOpacity={1}
                        fill={`url(#colorTemp${node.id})`}
                        activeDot={{ r: 8, stroke: node.color, strokeWidth: 2, fill: '#fff' }}
                        strokeWidth={3}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-center text-muted-foreground">
                <p>Temperature readings over time with comfort zone references (20-25°C)</p>
              </div>
            </TabsContent>
            
            <TabsContent value="moisture" className="space-y-4">
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={moistureChartData}
                    margin={{ top: 15, right: 30, left: 20, bottom: 15 }}
                  >
                    <defs>
                      {selectedNodeNames.map((node, index) => (
                        <linearGradient key={node.id} id={`colorMoist${node.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={node.color} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={node.color} stopOpacity={0.15}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ccc" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="formattedTime" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      interval="preserveStartEnd"
                      label={{ value: 'Time', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      label={{ 
                        value: 'Moisture (%)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: '#666' },
                        offset: -5
                      }}
                      tick={{ fontSize: 12, fill: '#666' }}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      formatter={(value) => [`${value}%`, '']}
                      labelFormatter={(label) => `Time: ${label}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                    <Legend 
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ paddingTop: '10px' }}
                    />
                    <ReferenceLine y={30} label="Low Moisture" stroke="rgba(255, 99, 132, 0.5)" strokeDasharray="3 3" />
                    <ReferenceLine y={60} label="High Moisture" stroke="rgba(75, 192, 192, 0.5)" strokeDasharray="3 3" />
                    {selectedNodeNames.map((node, index) => (
                      <Area
                        key={node.id}
                        type="monotone"
                        dataKey={node.name}
                        stroke={node.color}
                        fillOpacity={1}
                        fill={`url(#colorMoist${node.id})`}
                        activeDot={{ r: 8, stroke: node.color, strokeWidth: 2, fill: '#fff' }}
                        strokeWidth={3}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-center text-muted-foreground">
                <p>Moisture readings over time with optimal range references (30-60%)</p>
              </div>
            </TabsContent>
            
            <TabsContent value="pressure" className="space-y-4">
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={pressureChartData}
                    margin={{ top: 15, right: 30, left: 20, bottom: 15 }}
                  >
                    <defs>
                      {selectedNodeNames.map((node, index) => (
                        <linearGradient key={node.id} id={`colorPress${node.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={node.color} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={node.color} stopOpacity={0.15}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ccc" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="formattedTime" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      interval="preserveStartEnd"
                      label={{ value: 'Time', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      label={{ 
                        value: 'Pressure (hPa)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: '#666' },
                        offset: -5
                      }}
                      tick={{ fontSize: 12, fill: '#666' }}
                      domain={['dataMin - 5', 'dataMax + 5']}
                    />
                    <Tooltip 
                      formatter={(value) => [`${value} hPa`, '']}
                      labelFormatter={(label) => `Time: ${label}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                    <Legend 
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ paddingTop: '10px' }}
                    />
                    <ReferenceLine y={1000} label="Standard Pressure" stroke="rgba(75, 192, 192, 0.5)" strokeDasharray="3 3" />
                    {selectedNodeNames.map((node, index) => (
                      <Area
                        key={node.id}
                        type="monotone"
                        dataKey={node.name}
                        stroke={node.color}
                        fillOpacity={1}
                        fill={`url(#colorPress${node.id})`}
                        activeDot={{ r: 8, stroke: node.color, strokeWidth: 2, fill: '#fff' }}
                        strokeWidth={3}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-center text-muted-foreground">
                <p>Pressure readings over time (standard pressure ≈ 1013.25 hPa at sea level)</p>
              </div>
            </TabsContent>

            <TabsContent value="combined" className="space-y-4">
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={tempChartData}
                    margin={{ top: 15, right: 30, left: 20, bottom: 15 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ccc" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="formattedTime" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      label={{ value: 'Time', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      yAxisId="left"
                      label={{ 
                        value: 'Temperature (°C)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: '#666' },
                        offset: -5
                      }}
                      tick={{ fontSize: 12, fill: '#666' }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      label={{ 
                        value: 'Moisture (%) / Pressure (hPa)', 
                        angle: 90, 
                        position: 'insideRight',
                        style: { textAnchor: 'middle', fill: '#666' },
                        offset: 5
                      }}
                      tick={{ fontSize: 12, fill: '#666' }}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      formatter={(value, name, props) => {
                        const nameStr = String(name);
                        if (nameStr.includes("Temp")) return [`${value}°C`, nameStr.replace("Temp", "Temperature")];
                        if (nameStr.includes("Moist")) return [`${value}%`, nameStr.replace("Moist", "Moisture")];
                        if (nameStr.includes("Press")) return [`${value} hPa`, nameStr.replace("Press", "Pressure")];
                        return [value, name];
                      }}
                      labelFormatter={(label) => `Time: ${label}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                    <Legend 
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ paddingTop: '10px' }}
                    />
                    
                    {/* Temperature Lines and other sensor data */}
                    {selectedNodeNames.map((node, index) => {
                      // Extract corresponding moisture data for this node
                      const moistureForNode = moistureChartData.map(entry => ({
                        timestamp: entry.timestamp,
                        value: entry[node.name]
                      }));
                      
                      // Extract corresponding pressure data for this node
                      const pressureForNode = pressureChartData.map(entry => ({
                        timestamp: entry.timestamp,
                        value: entry[node.name]
                      }));
                      
                      return (
                        <React.Fragment key={`temp-${node.id}`}>
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey={node.name}
                            name={`Temp - ${node.name}`}
                            stroke={node.color}
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 1 }}
                            activeDot={{ r: 8, stroke: node.color, strokeWidth: 1, fill: '#fff' }}
                          />
                          {/* Find matching moisture data point for this node and timestamp */}
                          {tempChartData.map((point, i) => {
                            const matchingMoisture = moistureChartData.find(m => m.timestamp === point.timestamp);
                            if (matchingMoisture && matchingMoisture[node.name] !== undefined) {
                              return (
                                <Line
                                  key={`moist-${node.id}-${i}`}
                                  yAxisId="right"
                                  type="monotone"
                                  dataKey={node.name}
                                  name={`Moist - ${node.name}`}
                                  stroke={`${node.color}80`} // transparent version
                                  strokeDasharray="5 5"
                                  strokeWidth={2}
                                  dot={{ r: 4, strokeWidth: 1 }}
                                  activeDot={{ r: 6, stroke: `${node.color}80`, strokeWidth: 1, fill: '#fff' }}
                                />
                              );
                            }
                            return null;
                          })}
                          
                          {/* Pressure data is displayed selectively in the tooltip but not shown on chart */}
                        </React.Fragment>
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-center text-muted-foreground">
                <p>Combined view showing correlation between temperature (solid lines) and moisture (dashed lines)</p>
              </div>
            </TabsContent>
            
            <TabsContent value="radar" className="space-y-4">
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart outerRadius={150} width={730} height={400} data={
                    selectedNodeNames.map(node => {
                      // Find latest temperature, moisture, and pressure readings for this node
                      // Add fallback values for backward compatibility
                      const latestTemp = tempChartData.length > 0 ? 
                        (tempChartData[tempChartData.length - 1][node.name] || 0) : 0;
                      const latestMoist = moistureChartData.length > 0 ? 
                        (moistureChartData[moistureChartData.length - 1][node.name] || 0) : 0;
                      const latestPress = pressureChartData.length > 0 ? 
                        (pressureChartData[pressureChartData.length - 1][node.name] || 1000) : 1000;
                        
                      return {
                        subject: node.name,
                        "Temperature": latestTemp,
                        "Moisture": latestMoist,
                        "Pressure": latestPress,
                        // Normalize to 0-100 scale for visualization
                        "Temp Normalized": (Number(latestTemp) / 40) * 100,
                        "Moisture Normalized": latestMoist,
                        "Pressure Normalized": (Number(latestPress) / 1100) * 100,
                        fullMark: 100,
                      };
                    })
                  }>
                    <PolarGrid stroke="#bbb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#666', fontSize: 14 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar name="Temperature" dataKey="Temp Normalized" stroke="#FF5252" fill="#FF5252" fillOpacity={0.5} />
                    <Radar name="Moisture" dataKey="Moisture Normalized" stroke="#536DFE" fill="#536DFE" fillOpacity={0.5} />
                    <Radar name="Pressure" dataKey="Pressure Normalized" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.5} />
                    <Legend />
                    <Tooltip 
                      formatter={(value, name) => {
                        const nameStr = String(name);
                        const valueNum = Number(value);
                        if (nameStr === "Temp Normalized") return [`${(valueNum / 100 * 40).toFixed(1)}°C`, "Temperature"];
                        if (nameStr === "Moisture Normalized") return [`${valueNum.toFixed(1)}%`, "Moisture"];
                        if (nameStr === "Pressure Normalized") return [`${(valueNum / 100 * 1100).toFixed(0)} hPa`, "Pressure"];
                        return [value, name];
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-center text-muted-foreground">
                <p>Radar chart comparing temperature, moisture, and pressure values across all nodes</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Raw Data</CardTitle>
          <CardDescription>Historical sensor readings for selected nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {Object.entries(readings).map(([nodeId, nodeReadings]) => {
              const nodeName = nodeMap.get(nodeId)?.name || `Node ${nodeId}`;
              return (
                <div key={nodeId} className="space-y-3">
                  <h4 className="text-lg font-semibold">{nodeName}</h4>
                  <div className="border rounded-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted">
                            <th className="px-4 py-2 text-left">Timestamp</th>
                            <th className="px-4 py-2 text-left">Temperature (°C)</th>
                            <th className="px-4 py-2 text-left">Moisture (%)</th>
                            <th className="px-4 py-2 text-left">Pressure (hPa)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nodeReadings.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                                No data available
                              </td>
                            </tr>
                          ) : (
                            nodeReadings.map((reading, i) => (
                              <tr key={reading.readingId || i} className="border-t">
                                <td className="px-4 py-2 text-sm">
                                  {formatTimestamp(reading.timestamp)}
                                </td>
                                <td className="px-4 py-2">{reading.temperature || 0}</td>
                                <td className="px-4 py-2">{reading.moisture || 0}</td>
                                <td className="px-4 py-2">{reading.pressure || 1000}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SensorDataDisplay;