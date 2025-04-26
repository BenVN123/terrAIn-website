import axios from 'axios';
import { Node, NodeReadings, InsightResponse } from './types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getNodes = async (): Promise<Node[]> => {
  const response = await api.get<Node[]>('/nodes');
  return response.data;
};

export const getNode = async (nodeId: string): Promise<Node> => {
  const response = await api.get<Node>(`/nodes/${nodeId}`);
  return response.data;
};

export const getReadings = async (
  n: number = 10,
  nodeIds?: string[]
): Promise<NodeReadings> => {
  let url = `/readings?n=${n}`;
  if (nodeIds && nodeIds.length > 0) {
    url += `&nodes=${nodeIds.join(',')}`;
  }
  const response = await api.get<NodeReadings>(url);
  return response.data;
};

export const getLLMInsights = async (
  promptType: string = 'small',
  nReadings: number = 10,
  customPrompt?: string,
  includeWeather: boolean = false,
  lat?: number,
  lon?: number
): Promise<InsightResponse> => {
  let url = `/call_llm?prompt_type=${promptType}&n_readings=${nReadings}&include_weather=${includeWeather}`;
  
  if (customPrompt) {
    url += `&custom_prompt=${encodeURIComponent(customPrompt)}`;
  }
  
  if (includeWeather && lat !== undefined && lon !== undefined) {
    url += `&lat=${lat}&lon=${lon}`;
  }
  
  const response = await api.get<InsightResponse>(url);
  return response.data;
};