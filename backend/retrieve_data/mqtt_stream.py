#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import time
import threading
import logging
import random
from datetime import datetime
from decimal import Decimal
import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from utils import pressure_to_elevation
# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# A class to handle Decimal serialization for JSON
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

class MQTTHandler:
    def __init__(self, socketio=None):
        self.socketio = socketio
        self.client = mqtt.Client()
        self.connected = False
        self.topics = [
            "soilMesh/test/sensor",
            "soilMesh/test/gps"
        ]
        
        # Set up callbacks
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        # Set up authentication if provided in environment variables
        aws_iot_endpoint = os.getenv("AWS_IOT_ENDPOINT")
        aws_iot_port = int(os.getenv("AWS_IOT_PORT", "8883"))
        aws_iot_root_ca = os.getenv("AWS_IOT_ROOT_CA")
        aws_iot_cert = os.getenv("AWS_IOT_CERT")
        aws_iot_private_key = os.getenv("AWS_IOT_PRIVATE_KEY")
        
        if (aws_iot_endpoint and aws_iot_root_ca and aws_iot_cert and aws_iot_private_key and
            os.path.isfile(aws_iot_root_ca) and os.path.isfile(aws_iot_cert) and os.path.isfile(aws_iot_private_key)):
            try:
                self.client.tls_set(
                    ca_certs=aws_iot_root_ca,
                    certfile=aws_iot_cert,
                    keyfile=aws_iot_private_key
                )
                self.mqtt_host = aws_iot_endpoint
                self.mqtt_port = aws_iot_port
                logger.info(f"AWS IoT credentials found. Using endpoint {aws_iot_endpoint}")
            except Exception as e:
                logger.error(f"Error setting up TLS: {e}")
                logger.warning("Falling back to local MQTT broker.")
                self.mqtt_host = "localhost"
                self.mqtt_port = 1883
        else:
            # Use local MQTT broker for testing
            logger.warning("AWS IoT credentials not found or files missing. Using simulated local data.")
            self.mqtt_host = "localhost"
            self.mqtt_port = 1883
            
            # Log the values for debugging
            if aws_iot_root_ca:
                logger.debug(f"Root CA path: {aws_iot_root_ca}, exists: {os.path.isfile(aws_iot_root_ca) if aws_iot_root_ca else False}")
            if aws_iot_cert:
                logger.debug(f"Cert path: {aws_iot_cert}, exists: {os.path.isfile(aws_iot_cert) if aws_iot_cert else False}")
            if aws_iot_private_key:
                logger.debug(f"Key path: {aws_iot_private_key}, exists: {os.path.isfile(aws_iot_private_key) if aws_iot_private_key else False}")
    
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info(f"Connected to MQTT broker at {self.mqtt_host}:{self.mqtt_port}")
            self.connected = True
            
            # Subscribe to topics
            for topic in self.topics:
                client.subscribe(topic)
                logger.info(f"Subscribed to {topic}")
        else:
            logger.error(f"Failed to connect to MQTT broker with code {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        logger.warning(f"Disconnected from MQTT broker with code {rc}")
        self.connected = False
        
        # Attempt to reconnect
        if rc != 0:
            logger.info("Attempting to reconnect...")
            time.sleep(5)
            self.connect()
    
    def on_message(self, client, userdata, msg):
        topic = msg.topic
        try:
            payload = json.loads(msg.payload.decode())
            logger.info(f"Received message on {topic}: {payload}")
            
            # Format the message for the WebSocket
            formatted_message = {
                "topic": topic,
                "payload": payload,
                "timestamp": datetime.now().isoformat()
            }
            
            # Emit to WebSocket if connected
            if self.socketio:
                self.socketio.emit('mqtt_message', json.dumps(formatted_message, cls=DecimalEncoder))
                
                # Process different topics and adapt the data format
                if topic == 'soilMesh/test/sensor':
                    # Map the nodeId, temperature, pressure and moisture to our expected format
                    sensor_data = {
                        "topic": topic,
                        "payload": {
                            "sensor_node": payload.get("nodeId"),
                            "temperature": payload.get("temperature", 0),
                            "moisture": payload.get("moisture", 0) * 100,  # Scale moisture to 0-100 range for frontend
                            "pressure": payload.get("pressure", 0), 
                            "elevation": pressure_to_elevation(payload.get("pressure", 0)), 
                            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        },
                        "timestamp": datetime.now().isoformat()
                    }
                    self.socketio.emit('sensors_temperature', json.dumps(sensor_data, cls=DecimalEncoder))
                
                elif topic == 'soilMesh/test/gps':
                    # Pass through the nodeId, latitude, longitude intact
                    gnss_data = {
                        "topic": topic,
                        "payload": {
                            "sensor_node": payload.get("nodeId"),
                            "longitude": payload.get("longitude", 0),
                            "latitude": payload.get("latitude", 0),
                            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        },
                        "timestamp": datetime.now().isoformat()
                    }
                    self.socketio.emit('sensors_gnss', json.dumps(gnss_data, cls=DecimalEncoder))
                
                # Emit to specific topic channel (for backward compatibility)
                topic_channel = topic.replace('/', '_')
                self.socketio.emit(topic_channel, json.dumps(formatted_message, cls=DecimalEncoder))
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    def connect(self):
        try:
            self.client.connect(self.mqtt_host, self.mqtt_port, 60)
            self.client.loop_start()
        except Exception as e:
            logger.error(f"Error connecting to MQTT broker: {e}")
    
    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()
        logger.info("Disconnected from MQTT broker")

    def generate_mock_data(self):
        """Generate mock data for testing when no real MQTT connection is available"""
        logger.info("Starting mock data generator")
        
        # Get mock data settings from environment variables
        node_count = int(os.getenv("MOCK_NODES", "3"))
        update_interval = int(os.getenv("MOCK_UPDATE_INTERVAL", "5"))
        
        node_ids = list(range(1, node_count + 1))
        logger.info(f"Generating mock data for {node_count} nodes with {update_interval}s interval")
        
        def mock_data_thread():
            while True:
                try:
                    for node_id in node_ids:
                        # Generate mock temperature, pressure and moisture data
                        temp_payload = {
                            "sensor_node": node_id,
                            "temperature": 20 + 5 * (node_id / 3) + round(random.uniform(-1, 1), 1),
                            "moisture": 40 + 10 * (node_id / 3) + round(random.uniform(-5, 5), 1),
                            "pressure": 1013 + round(random.uniform(-5, 5), 1),
                            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        }
                        
                        temp_msg = {
                            "topic": "soilMesh/test/sensor",
                            "payload": temp_payload,
                            "timestamp": datetime.now().isoformat()
                        }
                        
                        # Emit to WebSocket if connected
                        if self.socketio:
                            self.socketio.emit('mqtt_message', json.dumps(temp_msg, cls=DecimalEncoder))
                            if 'soilMesh/test/sensor' in temp_msg['topic']:
                                self.socketio.emit('sensors_temperature', json.dumps(temp_msg, cls=DecimalEncoder))
                            # Log only once in a while to avoid flooding
                            if node_id == 1:
                                logger.info(f"Emitted mock temperature data for {node_count} nodes")
                        
                        # Generate mock GNSS data
                        gnss_payload = {
                            "sensor_node": node_id,
                            "longitude": 100 + node_id * 10 + round(random.uniform(-2, 2), 2),
                            "latitude": 200 + node_id * 5 + round(random.uniform(-2, 2), 2),
                            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        }
                        
                        gnss_msg = {
                            "topic": "soilMesh/test/gps",
                            "payload": gnss_payload,
                            "timestamp": datetime.now().isoformat()
                        }
                        
                        # Emit to WebSocket if connected
                        if self.socketio:
                            self.socketio.emit('mqtt_message', json.dumps(gnss_msg, cls=DecimalEncoder))
                            if 'soilMesh/test/gps' in gnss_msg['topic']:
                                self.socketio.emit('sensors_gnss', json.dumps(gnss_msg, cls=DecimalEncoder))
                        
                    # Wait before generating next batch of data
                    time.sleep(update_interval)
                
                except Exception as e:
                    logger.error(f"Error generating mock data: {e}")
                    time.sleep(10)  # Wait longer if there's an error
        
        mock_thread = threading.Thread(target=mock_data_thread)
        mock_thread.daemon = True
        mock_thread.start()
        logger.info("Mock data generator started")

    def start(self):
        # Check if mock data is explicitly requested
        use_mock_data = os.getenv("MOCK_DATA", "false").lower() == "true"
        
        if use_mock_data or (self.mqtt_host == "localhost" and self.mqtt_port == 1883):
            # Use mock data if explicitly requested or if no AWS IoT credentials are found
            logger.info("Using mock data generator instead of real MQTT connection")
            self.generate_mock_data()
        else:
            # Connect to the real MQTT broker
            logger.info(f"Connecting to real MQTT broker at {self.mqtt_host}:{self.mqtt_port}")
            self.connect()
            
            # Start a thread to monitor connection and reconnect if needed
            def monitor_connection():
                while True:
                    if not self.connected:
                        logger.info("Connection monitor detected disconnection. Reconnecting...")
                        self.connect()
                    time.sleep(60)  # Check every minute
            
            monitor_thread = threading.Thread(target=monitor_connection)
            monitor_thread.daemon = True
            monitor_thread.start()


# For testing only
if __name__ == "__main__":
    handler = MQTTHandler()
    handler.connect()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        handler.disconnect()
