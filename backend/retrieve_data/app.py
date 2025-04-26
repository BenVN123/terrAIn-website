#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
from datetime import datetime
from flask import Flask, jsonify, request, render_template, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from data_retriever import DynamoDBRetriever
from mqtt_stream import MQTTHandler, DecimalEncoder
from ai_insights.gemini import GeminiDatabaseInsights


app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

# Initialize the DynamoDB retriever
retriever = DynamoDBRetriever()

# Initialize and start the MQTT handler
mqtt_handler = MQTTHandler(socketio)

# Initialize the Gemini insights engine
gemini_insights = GeminiDatabaseInsights()


@app.route('/')
def index():
    """Serve the API documentation."""
    return jsonify({
        "name": "Dirt Mesh LA API",
        "version": "1.0.0",
        "description": "API for retrieving sensor data from Dirt Mesh LA network",
        "endpoints": [
            {
                "path": "/api/nodes",
                "method": "GET",
                "description": "Get information about all nodes"
            },
            {
                "path": "/api/nodes/<node_id>",
                "method": "GET",
                "description": "Get information about a specific node"
            },
            {
                "path": "/api/readings",
                "method": "GET",
                "description": "Get the last n readings for all nodes or specific nodes",
                "query_params": [
                    {
                        "name": "n",
                        "type": "integer",
                        "description": "Number of readings to retrieve per node",
                        "default": 10
                    },
                    {
                        "name": "nodes",
                        "type": "string",
                        "description": "Comma-separated list of node IDs",
                        "optional": True
                    }
                ]
            },
            {
                "path": "/api/call_llm",
                "method": "GET",
                "description": "Generate agricultural insights using LLM",
                "query_params": [
                    {
                        "name": "prompt_type",
                        "type": "string",
                        "description": "Type of prompt to use (small, large, or custom)",
                        "default": "small"
                    },
                    {
                        "name": "n_readings",
                        "type": "integer",
                        "description": "Number of readings to analyze (for small prompt)",
                        "default": 10
                    },
                    {
                        "name": "custom_prompt",
                        "type": "string",
                        "description": "Custom prompt text (for custom prompt type)",
                        "optional": True
                    },
                    {
                        "name": "include_weather",
                        "type": "boolean",
                        "description": "Whether to include weather forecast data",
                        "default": False
                    },
                    {
                        "name": "lat",
                        "type": "float",
                        "description": "Latitude for weather data (required if include_weather=True)",
                        "optional": True
                    },
                    {
                        "name": "lon",
                        "type": "float",
                        "description": "Longitude for weather data (required if include_weather=True)",
                        "optional": True
                    }
                ]
            },
            {
                "path": "/api/health",
                "method": "GET",
                "description": "Health check endpoint"
            }
        ],
        "websockets": [
            {
                "event": "mqtt_message",
                "description": "All MQTT messages"
            },
            {
                "event": "sensors_temperature",
                "description": "Temperature sensor readings"
            },
            {
                "event": "sensors_gnss",
                "description": "GNSS position readings"
            }
        ]
    })


@app.route('/api/nodes', methods=['GET'])
def get_nodes():
    """Get information about all nodes."""
    nodes = retriever.get_node_info()
    return jsonify(nodes)


@app.route('/api/nodes/<node_id>', methods=['GET'])
def get_node(node_id):
    """Get information about a specific node."""
    nodes = retriever.get_node_info([node_id])
    if nodes:
        return jsonify(nodes[0])
    return jsonify({"error": "Node not found"}), 404


@app.route('/api/readings', methods=['GET'])
def get_readings():
    """
    Get the last n readings for all nodes or specific nodes.
    
    Query parameters:
    - n: Number of readings to retrieve per node (default: 10)
    - nodes: Comma-separated list of node IDs (optional)
    """
    # Get query parameters
    n = request.args.get('n', default=10, type=int)
    nodes_param = request.args.get('nodes', default=None, type=str)
    
    if nodes_param:
        # Get readings for specific nodes
        node_ids = nodes_param.split(',')
        readings = retriever.get_readings_for_specific_nodes(node_ids, n)
    else:
        # Get readings for all nodes
        readings = retriever.get_last_n_readings_for_all_nodes(n)
    
    return jsonify(readings)


@app.route('/api/call_llm', methods=['GET'])
def call_llm():
    """
    Generate agricultural insights using Gemini LLM.
    
    Query parameters:
    - prompt_type: Type of prompt to use (small, large, or custom) (default: small)
    - n_readings: Number of readings to analyze (for small prompt) (default: 10)
    - custom_prompt: Custom prompt text (for custom prompt type) (optional)
    - include_weather: Whether to include weather forecast data (default: False)
    - lat: Latitude for weather data (required if include_weather=True) (optional)
    - lon: Longitude for weather data (required if include_weather=True) (optional)
    """
    # Get query parameters
    prompt_type = request.args.get('prompt_type', default='small', type=str)
    n_readings = request.args.get('n_readings', default=10, type=int)
    custom_prompt = request.args.get('custom_prompt', default=None, type=str)
    include_weather = request.args.get('include_weather', default=False, type=bool)
    lat = request.args.get('lat', default=None, type=float)
    lon = request.args.get('lon', default=None, type=float)
    
    # Get data for context
    data = gemini_insights.extract_data_for_analysis()
    context = gemini_insights.generate_data_summary(data)
    
    # Get weather data if requested
    weather_data = None
    if include_weather and lat is not None and lon is not None:
        try:
            weather_data = gemini_insights.extract_weather(lat, lon)
        except Exception as e:
            return jsonify({"error": f"Failed to get weather data: {str(e)}"}), 500
    
    # Generate insights based on prompt type
    try:
        if prompt_type == 'small':
            insights = gemini_insights.get_farm_assistant_advice(
                n_readings=n_readings,
                context=context,
                weather_data=weather_data
            )
        elif prompt_type == 'large':
            insights = gemini_insights.get_detailed_agriculture_plan(
                context=context,
                weather_data=weather_data
            )
        elif prompt_type == 'custom':
            if not custom_prompt:
                return jsonify({"error": "Custom prompt required for prompt_type 'custom'"}), 400
            insights = gemini_insights.query_gemini(
                prompt=custom_prompt,
                context=context
            )
        else:
            return jsonify({"error": f"Invalid prompt_type: {prompt_type}"}), 400
        
        # Return the insights
        return jsonify({
            "insights": insights,
            "prompt_type": prompt_type,
            "timestamp": datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({"error": f"Failed to generate insights: {str(e)}"}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy"})


@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection."""
    sid = request.sid if hasattr(request, 'sid') else 'unknown'
    print(f'Client connected: {sid}')
    # Emit test data to verify connection
    test_data = {
        "topic": "test/connection",
        "payload": {
            "message": "Connection established successfully",
            "timestamp": datetime.now().isoformat()
        },
        "timestamp": datetime.now().isoformat()
    }
    socketio.emit('mqtt_message', json.dumps(test_data, cls=DecimalEncoder))
    print(f"Sent test data to client {sid}")


@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection."""
    sid = request.sid if hasattr(request, 'sid') else 'unknown'
    print(f'Client disconnected: {sid}')


if __name__ == '__main__':
    # Create the static directory if it doesn't exist
    os.makedirs('static', exist_ok=True)
    
    # Start the MQTT handler
    mqtt_handler.start()
    
    # Try to get the port from environment or use 5001 as alternative to 5000
    port = int(os.environ.get('FLASK_PORT', 5001))
    
    print(f"Starting Flask server on port {port}")
    
    # Run the Flask app with SocketIO
    socketio.run(app, debug=True, host='0.0.0.0', port=port)