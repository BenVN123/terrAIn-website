import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { APIInfo } from '../types';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Home: React.FC = () => {
  const [apiInfo, setApiInfo] = useState<APIInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiInfo = async () => {
      try {
        setLoading(true);
        console.log("Fetching API info from:", API_URL.replace('/api', '/'));
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await axios.get<APIInfo>(API_URL.replace('/api', '/'), {
          signal: controller.signal,
          timeout: 5000
        });
        
        clearTimeout(timeoutId);
        console.log("API info response:", response.data);
        
        setApiInfo(response.data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching API info:', err);
        if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
          setError('Connection timeout. Could not reach the API server.');
        } else if (err.response) {
          setError(`Server error: ${err.response.status} ${err.response.statusText}`);
        } else if (err.request) {
          setError('No response from the server. Please make sure the backend is running.');
        } else {
          setError('Failed to load API information. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchApiInfo();
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold">Dirt Mesh LA</h1>
          <p className="text-xl text-muted-foreground">
            Sensor Network Monitoring System
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Real-Time Data</CardTitle>
              <CardDescription>
                Monitor sensor data in real time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                View live sensor data streamed directly from the MQTT broker. 
                See temperature, moisture, pressure, and location measurements as they happen.
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link to="/realtime">View Live Data</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Insights</CardTitle>
              <CardDescription>
                Use artificial intelligience to aid your needs 
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Talk to an intuitive chatbot to assist you by offering you AI-driven suggestions and alerts tailored to your needs. 
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link to="/insights">Go to AI Insights</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
            <CardDescription>
              About the Dirt Mesh LA Sensor Network
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              The Dirt Mesh LA sensor network provides real-time monitoring of environmental conditions
              across multiple sensor nodes. The system collects temperature, moisture, pressure, and location data
              to create a comprehensive view of the monitored environment.
            </p>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Network Features</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Real-time data streaming from multiple sensor nodes</li>
                  <li>Temperature, moisture, and pressure monitoring</li>
                  <li>Geographic location tracking</li>
                  <li>Historical data collection and visualization</li>
                  <li>Cloud-based data storage and processing</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Sensor Specifications</h3>
                <div className="border rounded-md">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Measurement</th>
                          <th className="p-2 text-left">Range</th>
                          <th className="p-2 text-left">Accuracy</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="p-2">Temperature</td>
                          <td className="p-2">-40°C to 85°C</td>
                          <td className="p-2">±0.5°C</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-2">Moisture</td>
                          <td className="p-2">0% to 100%</td>
                          <td className="p-2">±3%</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-2">Pressure</td>
                          <td className="p-2">300 to 1100 hPa</td>
                          <td className="p-2">±1 hPa</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-2">Location</td>
                          <td className="p-2">Global</td>
                          <td className="p-2">±2.5 meters</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;
