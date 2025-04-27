import os
import sys
# sys.path.append(os.path.abspath('../retrieve_data'))

import json
import boto3
from datetime import datetime, timedelta
import pandas as pd
from google import genai
from dotenv import load_dotenv
import requests
import uuid

from data_retriever import DynamoDBRetriever
from prompts import small_prompt, large_prompt

class GeminiDatabaseInsights:
    def __init__(self):
        self.retriever = DynamoDBRetriever()
                
        load_dotenv()
        # api_key = os.environ.get("GOOGLE_API_KEY")
        api_key = "AIzaSyCDeL8KKTtSy9XZZLbfszx_WvcNMEWWFqM" 
            
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

    def extract_weather(self, lat, lon, days_ahead=3):
        """
        Generate Complete weather based on coordinates from sensor
        Keep in mind days ahead will linearly increase the context size of the weather
        """
        weather_key = "756e5e39fb2941a9acd65155252604"
        endpoint = f"http://api.weatherapi.com/v1/forecast.json?key={weather_key}&q={lat},{lon}&days={days_ahead}"
        # Make a request to the weather API
        response = requests.get(endpoint)

        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to fetch weather data: {response.status_code}, {response.text}")

    
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

        response = self.client.models.generate_content(
            model="gemini-2.0-flash",  
            # model="gemini-2.5-pro-preview-03-25",
            # model="gemini-2.5-flash",
            contents=full_prompt
        )
        
        return response.text


class AgriculturalChatConversation:
    def __init__(self, api_key=None):
        load_dotenv()
        self.api_key = api_key or "AIzaSyCDeL8KKTtSy9XZZLbfszx_WvcNMEWWFqM"
        self.client = genai.Client(api_key=self.api_key)
        
        # Dictionary to store conversations by session_id
        self.conversations = {}
        
        # Initialize Gemini insights for sensor data access
        self.gemini_insights = GeminiDatabaseInsights()
        
    def _get_conversation(self, session_id):
        """Get an existing conversation or create a new one."""
        if session_id not in self.conversations:
            # Initialize a new conversation
            self.conversations[session_id] = {
                "messages": [],
                "context": None,
                "created_at": datetime.now().isoformat()
            }
            
            # Get initial farm data for context
            data = self.gemini_insights.extract_data_for_analysis()
            context = self.gemini_insights.generate_data_summary(data)
            
            # Add system prompt with context
            system_message = f"""You are an agricultural advisory AI for a smart farm.
            You have access to sensor data from the farm, which includes temperature, moisture, and other metrics.
            Here's the current data summary:

            {context}

            Respond to user queries about their farm data, providing specific advice based on the data.
            Keep your answers concise, relevant, and actionable. If you don't know something, say so.
            Remember previous parts of the conversation to provide consistent and relevant responses."""

            self.conversations[session_id]["messages"].append({
                "role": "system",
                "content": system_message
            })
            
            self.conversations[session_id]["context"] = context
            
        return self.conversations[session_id]
        
    def add_message(self, session_id, message, role="user"):
        """Add a message to the conversation."""
        conversation = self._get_conversation(session_id)
        conversation["messages"].append({
            "role": role,
            "content": message
        })
        return conversation
        
    def get_conversation_history(self, session_id):
        """Get the full conversation history."""
        conversation = self._get_conversation(session_id)
        return conversation["messages"]
        
    def clear_conversation(self, session_id):
        """Clear a conversation."""
        if session_id in self.conversations:
            del self.conversations[session_id]
            
    def generate_response(self, session_id, message, custom_context=None):
        """Generate a response to the user's message."""
        # Add the user message
        conversation = self.add_message(session_id, message)
        
        # Update context if custom context provided
        if custom_context:
            # Get fresh data for merging with custom context
            data = self.gemini_insights.extract_data_for_analysis()
            base_context = self.gemini_insights.generate_data_summary(data)
            
            # Merge contexts
            full_context = f"{base_context}\n\nAdditional User-Provided Context:\n{custom_context}"
            
            # Update system message with new context
            for msg in conversation["messages"]:
                if msg["role"] == "system":
                    msg["content"] = f"""You are an agricultural advisory AI for a smart farm.
                    You have access to sensor data from the farm, which includes temperature, moisture, and other metrics.
                    Here's the current data summary:

                    {full_context}

                    Respond to user queries about their farm data, providing specific advice based on the data.
                    Keep your answers concise, relevant, and actionable. If you don't know something, say so.
                    Remember previous parts of the conversation to provide consistent and relevant responses."""
                    break
        try:
            # Get weather data for additional context
            weather_data = None
            try:
                lat, lon = 34.0522, -118.2437  # Los Angeles coordinates as default
                weather_data = self.gemini_insights.extract_weather(lat, lon)
                
                # Add weather as context message
                weather_context = "Weather Forecast:\n"
                for day in weather_data.get('forecast', {}).get('forecastday', []):
                    date = day.get('date', 'Unknown')
                    max_temp = day.get('day', {}).get('maxtemp_c', 'Unknown')
                    min_temp = day.get('day', {}).get('mintemp_c', 'Unknown')
                    condition = day.get('day', {}).get('condition', {}).get('text', 'Unknown')
                    weather_context += f"- {date}: {min_temp}°C to {max_temp}°C, {condition}\n"
                
                self.add_message(session_id, f"For context, here's the current weather forecast:\n{weather_context}", "system")
            except Exception as e:
                # Continue without weather data if it fails
                print(f"Failed to fetch weather data: {str(e)}")
            
            # Convert conversation to format for Gemini Content API
            conversation_history = []
            system_prompt = ""
            
            # Extract system prompt and build conversation history
            for msg in conversation["messages"]:
                if msg["role"] == "system":
                    system_prompt = msg["content"]
                else:
                    conversation_history.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
                    
            # Extract just the last user message
            last_user_message = message
            
            # Generate response with the Content Generation API
            # Construct the full prompt
            full_prompt = f"""
{system_prompt}

Previous conversation:
{json.dumps(conversation_history, indent=2)}

User question: {last_user_message}

Your response:"""

            # Using the basic content generation instead of chat API
            response = self.client.models.generate_content(
                model="gemini-2.0-flash-thinking-exp-01-21",
                # model="gemini-2.5-pro-preview-03-25",
                # model="gemini-2.0-flash",
                contents=full_prompt
            )
            
            # Get the response text from the generated content
            response_text = response.text if hasattr(response, 'text') else response.candidates[0].content.parts[0].text
            
            # Add the response to the conversation
            self.add_message(session_id, response_text, "model")
            
            return response_text
            
        except Exception as e:
            error_response = f"I encountered an error processing your request: {str(e)}"
            self.add_message(session_id, error_response, "model")
            return error_response
    
    def create_session(self, custom_context=None):
        """Create a new conversation session."""
        session_id = str(uuid.uuid4())
        self._get_conversation(session_id)
        
        # If custom context is provided, update the system message
        if custom_context:
            conversation = self.conversations[session_id]
            
            # Update the first system message
            for i, msg in enumerate(conversation["messages"]):
                if msg["role"] == "system":
                    # Get fresh data for context
                    data = self.gemini_insights.extract_data_for_analysis()
                    base_context = self.gemini_insights.generate_data_summary(data)
                    
                    # Merge contexts
                    full_context = f"{base_context}\n\nAdditional User-Provided Context:\n{custom_context}"
                    
                    # Update system message
                    conversation["messages"][i]["content"] = f"""You are an agricultural advisory AI for a smart farm.
You have access to sensor data from the farm, which includes temperature, moisture, and other metrics.
Here's the current data summary:

{full_context}

Respond to user queries about their farm data, providing specific advice based on the data.
Keep your answers concise, relevant, and actionable. If you don't know something, say so.
Remember previous parts of the conversation to provide consistent and relevant responses."""
                    break
                    
        return session_id
    
    def get_farm_assistant_advice(self, n_readings=5, context=None, weather_data=None):
        """
        Generate farming advice using the small_prompt template optimized for smaller models
        
        Args:
            n_readings: Number of recent readings to analyze
            context: Optional pre-generated context data
            weather_data: Optional weather forecast data
        
        Returns:
            The generated advice from Gemini
        """
        # Get fresh data for context if none provided
        if not context:
            data = self.extract_data_for_analysis()
            context = self.generate_data_summary(data)
        
        # Prepare weather data string if provided
        weather_context = ""
        if weather_data:
            weather_context = "\nWeather Forecast:\n"
            for day in weather_data.get('forecast', {}).get('forecastday', []):
                date = day.get('date', 'Unknown')
                max_temp = day.get('day', {}).get('maxtemp_c', 'Unknown')
                min_temp = day.get('day', {}).get('mintemp_c', 'Unknown')
                condition = day.get('day', {}).get('condition', {}).get('text', 'Unknown')
                weather_context += f"- {date}: {min_temp}°C to {max_temp}°C, {condition}\n"
            
        # Format the small prompt with the number of readings
        formatted_prompt = small_prompt.format(n=n_readings)
        
        # Combine everything
        full_prompt = f"{context}\n{weather_context}\n\n{formatted_prompt}"
        
        # Query Gemini
        response = self.client.models.generate_content(
            model="gemini-2.0-flash",
            
         #model="gemini-2.5-flash",  # Using the faster model for the small prompt
            contents=full_prompt
        )
        
        return response.text
    
    def get_detailed_agriculture_plan(self, context=None, weather_data=None):
        """
        Generate a comprehensive agricultural management plan using the large_prompt template
        
        Args:
            context: Optional pre-generated context data
            weather_data: Optional weather forecast data
        
        Returns:
            The generated detailed plan from Gemini
        """
        # Get fresh data for context if none provided
        if not context:
            data = self.extract_data_for_analysis()
            context = self.generate_data_summary(data)
            
        # Prepare weather data string if provided
        weather_context = ""
        if weather_data:
            weather_context = "\nWeather Forecast:\n"
            for day in weather_data.get('forecast', {}).get('forecastday', []):
                date = day.get('date', 'Unknown')
                max_temp = day.get('day', {}).get('maxtemp_c', 'Unknown')
                min_temp = day.get('day', {}).get('mintemp_c', 'Unknown')
                condition = day.get('day', {}).get('condition', {}).get('text', 'Unknown')
                weather_context += f"- {date}: {min_temp}°C to {max_temp}°C, {condition}\n"
        
        # Format the large prompt with the number of nodes
        formatted_prompt = large_prompt.format(n=data['summary']['total_nodes'] if 'summary' in data else 'unknown')
        
        # Combine everything
        full_prompt = f"{context}\n{weather_context}\n\n{formatted_prompt}"
        
        # Query Gemini with the larger model for more comprehensive results
        response = self.client.models.generate_content(
            model="gemini-2.0-flash",
            # model="gemini-2.5-flash",  # Can use a more powerful model if available
            contents=full_prompt
        )
        
        return response.text

if __name__ == "__main__":
    insights = GeminiDatabaseInsights()
    
    # Extract data for analysis
    data = insights.extract_data_for_analysis(days=30)
    context = insights.generate_data_summary(data)
    
    # Example 1: Get quick advice with the small prompt
    print("\n=== FARM ASSISTANT ADVICE (SMALL PROMPT) ===\n")
    quick_advice = insights.get_farm_assistant_advice(n_readings=10, context=context)
    print(quick_advice)
    
    # Example 2: Get detailed plan with the large prompt
    print("\n=== DETAILED AGRICULTURAL PLAN (LARGE PROMPT) ===\n")
    detailed_plan = insights.get_detailed_agriculture_plan(context=context)
    print(detailed_plan)
    
    # Original example for backward compatibility
    print("\n=== CUSTOM QUERY ===\n")
    result = insights.query_gemini(
        "Which node has the highest average temperature and what might be causing it?", 
        context=context
    )
    print(result)   
