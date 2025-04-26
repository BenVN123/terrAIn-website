import os
import sys
sys.path.append(os.path.abspath('../retrieve_data'))

import json
import boto3
from datetime import datetime, timedelta
import pandas as pd
from google import genai
from data_retriever import DynamoDBRetriever

class GeminiDatabaseInsights:
    def __init__(self, api_key=None):
        self.retriever = DynamoDBRetriever()
        
        # Get API key from parameter or environment variable
        if api_key is None:
            api_key = os.environ.get("GOOGLE_API_KEY")
            
        # Make sure we have an API key
        if not api_key:
            raise ValueError("API key must be provided either as a parameter or through the GOOGLE_API_KEY environment variable")
            
        # Initialize the client with API key
        self.client = genai.Client(api_key=api_key)
        
    def extract_data_for_analysis(self, days=7, node_limit=None):
        """Extract recent data for analysis"""
        # Get node information
        nodes = self.retriever.get_node_info()
        
        # Limit nodes if specified
        if node_limit and node_limit < len(nodes):
            nodes = nodes[:node_limit]
        
        # Get readings for each node
        all_readings = {}
        for node in nodes:
            node_id = node.get('nodeId')
            # You might need to modify this to get data from a specific timeframe
            readings = self.retriever.get_readings_for_specific_nodes([node_id], 100)
            if node_id in readings:
                all_readings[node_id] = readings[node_id]
        
        # Convert to a more analysis-friendly format
        processed_data = self._process_data(nodes, all_readings)
        
        return processed_data
    
    def _process_data(self, nodes, readings):
        """Process and format data for analysis"""
        # Extract node metadata
        node_info = {
            node.get('nodeId'): {
                'location': node.get('location', 'Unknown'),
                'type': node.get('type', 'Unknown'),
                'lastSeen': node.get('lastSeen', 'Unknown')
            } for node in nodes
        }
        
        # Process readings into a DataFrame-friendly format
        records = []
        for node_id, node_readings in readings.items():
            for reading in node_readings:
                record = {
                    'nodeId': node_id,
                    'timestamp': reading.get('timestamp'),
                    'temperature': reading.get('temperature'),
                    'moisture': reading.get('moisture'),
                }
                # Add node metadata
                if node_id in node_info:
                    record.update({
                        'location': node_info[node_id]['location'],
                        'node_type': node_info[node_id]['type']
                    })
                records.append(record)
        
        # Convert to DataFrame for easier analysis
        if records:
            df = pd.DataFrame(records)
            return {
                'node_info': node_info,
                'readings_df': df,
                'summary': {
                    'total_nodes': len(node_info),
                    'total_readings': len(records),
                    'date_range': f"{df['timestamp'].min()} to {df['timestamp'].max()}" if 'timestamp' in df.columns and not df.empty else "Unknown"
                }
            }
        return {
            'node_info': node_info,
            'readings_df': pd.DataFrame(),
            'summary': {
                'total_nodes': len(node_info),
                'total_readings': 0,
                'date_range': "Unknown"
            }
        }
    
    def generate_data_summary(self, data):
        """Generate a summary of the data for Gemini context"""
        # Create text representation of the data
        if data['readings_df'].empty:
            return "No readings available for analysis."
        
        df = data['readings_df']
        
        # Basic statistics
        stats = {
            'node_count': len(data['node_info']),
            'reading_count': len(df),
            'date_range': data['summary']['date_range'],
            'temperature_range': f"{df['temperature'].min()} to {df['temperature'].max()}" if 'temperature' in df.columns else "Unknown",
            'moisture_range': f"{df['moisture'].min()} to {df['moisture'].max()}" if 'moisture' in df.columns else "Unknown",
            'locations': set(df['location'].unique()) if 'location' in df.columns else "Unknown"
        }
        
        # Node-specific statistics
        node_stats = {}
        for node_id in df['nodeId'].unique():
            node_df = df[df['nodeId'] == node_id]
            node_stats[node_id] = {
                'reading_count': len(node_df),
                'avg_temperature': node_df['temperature'].mean() if 'temperature' in node_df.columns else "Unknown",
                'avg_moisture': node_df['moisture'].mean() if 'moisture' in node_df.columns else "Unknown",
                'location': node_df['location'].iloc[0] if 'location' in node_df.columns and not node_df.empty else "Unknown"
            }
        
        # Format the summary as text
        summary = f"""
Data Summary:
- Total nodes: {stats['node_count']}
- Total readings: {stats['reading_count']}
- Date range: {stats['date_range']}
- Temperature range: {stats['temperature_range']}
- Moisture range: {stats['moisture_range']}
- Locations: {', '.join(stats['locations']) if isinstance(stats['locations'], set) else stats['locations']}

Node Statistics:
"""
        
        for node_id, node_stat in node_stats.items():
            summary += f"""
Node {node_id}:
- Location: {node_stat['location']}
- Reading count: {node_stat['reading_count']}
- Average temperature: {node_stat['avg_temperature']}
- Average moisture: {node_stat['avg_moisture']}
"""
        
        return summary
    
    def query_gemini(self, prompt, context=None):
        """Query Gemini with a prompt and optional context"""
        if context:
            full_prompt = f"{context}\n\nBased on the above data: {prompt}"
        else:
            # Get fresh data for context if none provided
            data = self.extract_data_for_analysis()
            context = self.generate_data_summary(data)
            full_prompt = f"{context}\n\nBased on the above data: {prompt}"
        
        # Send the prompt to Gemini using the client API
        response = self.client.models.generate_content(
            model="gemini-2.0-flash",  # Or your preferred model
            contents=full_prompt
        )
        
        return response.text

# Example usage
if __name__ == "__main__":
    # Option 1: Pass the API key directly to the constructor
    API_KEY = "AIzaSyCDeL8KKTtSy9XZZLbfszx_WvcNMEWWFqM"  # Replace with your actual key
    insights = GeminiDatabaseInsights(api_key=API_KEY)
    
    # Extract data
    data = insights.extract_data_for_analysis(days=30)
    
    # Generate context
    context = insights.generate_data_summary(data)
    
    # Query with specific question
    result = insights.query_gemini(
        "Which node has the highest average temperature and what might be causing it?", 
        context=context
    )
    
    print(result)