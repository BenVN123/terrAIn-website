export interface Node {
  nodeId: string;
  name: string;
  description: string;
  createdAt: string;
  lastUpdated: string;
}

export interface Reading {
  nodeId: string;
  timestamp: string;
  readingId: string;
  temperature: number;
  moisture: number;
  pressure: number;
}

export interface GNSSReading {
  nodeId: string;
  timestamp: string;
  gnssId: string;
  longitude: number;
  latitude: number;
}

export interface NodeReadings {
  [nodeId: string]: Reading[];
}

export interface APIEndpoint {
  path: string;
  method: string;
  description: string;
  query_params?: APIQueryParam[];
}

export interface APIQueryParam {
  name: string;
  type: string;
  description: string;
  default?: any;
  optional?: boolean;
}

export interface APIWebSocket {
  event: string;
  description: string;
}

export interface APIInfo {
  name: string;
  version: string;
  description: string;
  endpoints: APIEndpoint[];
  websockets: APIWebSocket[];
}

export interface MQTTMessage {
  topic: string;
  payload: any;
  timestamp: string;
}

// Specific sensor payload types
export interface TemperaturePayload {
  sensor_node: number;
  temperature: number;
  moisture: number;
  pressure: number;
  timestamp: string;
}

export interface GNSSPayload {
  sensor_node: number;
  longitude: number;
  latitude: number;
  timestamp: string;
}

export interface InsightResponse {
  insights: string;
  prompt_type: string;
  timestamp: string;
}

export interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: string;
}
