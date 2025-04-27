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
from gemini import GeminiDatabaseInsights, AgriculturalChatConversation


app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

# Initialize the DynamoDB retriever
retriever = DynamoDBRetriever()

# Initialize and start the MQTT handler
mqtt_handler = MQTTHandler(socketio)

# Initialize the Gemini insights engine
gemini_insights = GeminiDatabaseInsights()

# Initialize the agricultural chat conversation handler
ag_chat = AgriculturalChatConversation()


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
                "path": "/api/chat/create_session",
                "method": "POST",
                "description": "Create a new chat session with the agricultural assistant",
                "query_params": [
                    {
                        "name": "custom_context",
                        "type": "string",
                        "description": "Optional custom context for the session",
                        "optional": True
                    }
                ]
            },
            {
                "path": "/api/chat/message",
                "method": "POST",
                "description": "Send a message to the agricultural assistant and get a response",
                "body_params": [
                    {
                        "name": "session_id",
                        "type": "string",
                        "description": "The session ID returned from create_session"
                    },
                    {
                        "name": "message",
                        "type": "string",
                        "description": "The user's message"
                    },
                    {
                        "name": "custom_context",
                        "type": "string",
                        "description": "Optional additional context",
                        "optional": True
                    }
                ]
            },
            {
                "path": "/api/chat/history",
                "method": "GET",
                "description": "Get the conversation history for a session",
                "query_params": [
                    {
                        "name": "session_id",
                        "type": "string",
                        "description": "The session ID to get history for"
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
    - include_weather: Whether to include weather forecast data (default: True)
    - lat: Latitude for weather data (optional)
    - lon: Longitude for weather data (optional)
    - custom_context: Custom context to add to the LLM prompt (optional)
    """
    # Get query parameters
    prompt_type = request.args.get('prompt_type', default='small', type=str)
    n_readings = request.args.get('n_readings', default=10, type=int)
    custom_prompt = request.args.get('custom_prompt', default=None, type=str)
    include_weather = request.args.get('include_weather', default=True, type=bool)
    lat = request.args.get('lat', default=None, type=float)
    lon = request.args.get('lon', default=None, type=float)
    custom_context = request.args.get('custom_context', default=None, type=str)
    
    # Get data for context
    data = gemini_insights.extract_data_for_analysis()
    context = gemini_insights.generate_data_summary(data)
    
    # Add custom context if provided
    if custom_context:
        context = f"{context}\n\nAdditional Context:\n{custom_context}"
    
    # Get weather data if coordinates are provided
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


@app.route('/api/chat/create_session', methods=['POST'])
def create_chat_session():
    """
    Create a new chat session with the agricultural assistant.
    
    Query parameters:
    - custom_context: Optional custom context for the session (optional)
    """
    # Get JSON body data
    data = request.get_json() or {}
    
    # Get custom context if provided
    custom_context = data.get('custom_context')
    
    # Create a new session
    session_id = ag_chat.create_session(custom_context)
    
    # Return the session ID
    return jsonify({
        "session_id": session_id,
        "timestamp": datetime.now().isoformat(),
        "status": "session_created"
    })


@app.route('/api/chat/message', methods=['POST'])
def send_chat_message():
    """
    Send a message to the agricultural assistant and get a response.
    
    Body parameters:
    - session_id: The session ID returned from create_session
    - message: The user's message
    - custom_context: Optional additional context (optional)
    """
    # Get JSON body data
    data = request.get_json()
    
    # Validate required fields
    if not data or 'session_id' not in data or 'message' not in data:
        return jsonify({"error": "Missing required fields: session_id, message"}), 400
    
    # Extract parameters
    session_id = data.get('session_id')
    message = data.get('message')
    custom_context = data.get('custom_context')
    
    # Generate response
    try:
        response = ag_chat.generate_response(session_id, message, custom_context)
        
        # Return the response
        return jsonify({
            "response": response,
            "session_id": session_id,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": f"Failed to generate response: {str(e)}"}), 500


@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    """
    Get the conversation history for a session.
    
    Query parameters:
    - session_id: The session ID to get history for
    """
    # Get query parameters
    session_id = request.args.get('session_id')
    
    # Validate required parameters
    if not session_id:
        return jsonify({"error": "Missing required parameter: session_id"}), 400
    
    # Get conversation history
    try:
        history = ag_chat.get_conversation_history(session_id)
        
        # Return the history
        return jsonify({
            "history": history,
            "session_id": session_id,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": f"Failed to get conversation history: {str(e)}"}), 500


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