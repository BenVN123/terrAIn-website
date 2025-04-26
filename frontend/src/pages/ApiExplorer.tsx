import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { APIInfo, APIEndpoint } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ApiExplorer: React.FC = () => {
  const [apiInfo, setApiInfo] = useState<APIInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [responseData, setResponseData] = useState<any>(null);
  const [responseError, setResponseError] = useState<string | null>(null);
  
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
          setError('Connection timeout. Could not reach the API server. Make sure the backend is running at ' + API_URL.replace('/api', ''));
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

  const handleEndpointSelect = (endpoint: APIEndpoint) => {
    setSelectedEndpoint(endpoint);
    setResponseData(null);
    setResponseError(null);
  };

  const handleTryIt = async () => {
    if (!selectedEndpoint) return;
    
    try {
      setResponseData(null);
      setResponseError(null);
      setLoading(true);
      
      const response = await axios.get(`${API_URL}${selectedEndpoint.path.replace('/api', '')}`);
      setResponseData(response.data);
    } catch (err) {
      console.error('Error fetching from endpoint:', err);
      setResponseError('Failed to fetch data from this endpoint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">API Explorer</h1>
        <p className="text-muted-foreground mt-1">
          Explore and test the Dirt Mesh LA API endpoints
        </p>
      </div>

      {loading && !apiInfo ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-center">
              <p className="text-muted-foreground">Loading API information...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-destructive">
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : apiInfo && (
        <div className="grid gap-8 lg:grid-cols-[350px,1fr]">
          <div>
            <Card>
              <CardHeader>
                <CardTitle>{apiInfo.name}</CardTitle>
                <CardDescription>Version {apiInfo.version}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm">{apiInfo.description}</p>
                
                <Tabs defaultValue="rest">
                  <TabsList className="w-full">
                    <TabsTrigger value="rest" className="flex-1">REST Endpoints</TabsTrigger>
                    <TabsTrigger value="websocket" className="flex-1">WebSockets</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="rest" className="mt-4">
                    <div className="space-y-2">
                      {apiInfo.endpoints.map((endpoint, index) => (
                        <button
                          key={index}
                          onClick={() => handleEndpointSelect(endpoint)}
                          className={`w-full text-left p-3 rounded-md border ${
                            selectedEndpoint === endpoint 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{endpoint.method}</span>
                            <span className="text-xs text-muted-foreground">Endpoint</span>
                          </div>
                          <div className="font-mono text-sm truncate">{endpoint.path}</div>
                        </button>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="websocket" className="mt-4">
                    <div className="space-y-2">
                      {apiInfo.websockets.map((ws, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-md border"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{ws.event}</span>
                            <span className="text-xs text-muted-foreground">Event</span>
                          </div>
                          <div className="text-sm text-muted-foreground">{ws.description}</div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          <div>
            {selectedEndpoint ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <span className="font-mono">{selectedEndpoint.path}</span>
                  </CardTitle>
                  <CardDescription>{selectedEndpoint.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {selectedEndpoint.query_params && selectedEndpoint.query_params.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium mb-2">Query Parameters</h3>
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-muted">
                              <tr>
                                <th className="p-2 text-left">Name</th>
                                <th className="p-2 text-left">Type</th>
                                <th className="p-2 text-left">Description</th>
                                <th className="p-2 text-left">Default</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedEndpoint.query_params.map((param, idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="p-2 font-mono text-sm">{param.name}</td>
                                  <td className="p-2">{param.type}</td>
                                  <td className="p-2">{param.description}</td>
                                  <td className="p-2">
                                    {param.default !== undefined 
                                      ? `${param.default}` 
                                      : param.optional 
                                        ? 'Optional' 
                                        : 'Required'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <h3 className="text-lg font-medium mb-2">Try It</h3>
                      <button
                        onClick={handleTryIt}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                        disabled={loading}
                      >
                        {loading ? 'Loading...' : 'Send Request'}
                      </button>
                    </div>
                    
                    {responseError && (
                      <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                        {responseError}
                      </div>
                    )}
                    
                    {responseData && (
                      <div>
                        <h3 className="text-lg font-medium mb-2">Response</h3>
                        <div className="bg-muted p-4 rounded-md overflow-x-auto">
                          <pre className="text-sm">
                            {JSON.stringify(responseData, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <h3 className="text-xl font-medium mb-2">Select an Endpoint</h3>
                    <p className="text-muted-foreground">
                      Choose an endpoint from the left panel to see its details and test it.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiExplorer;