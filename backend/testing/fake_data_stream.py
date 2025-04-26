"""
FOR TESTING:
Should emulate sensors publishing into topics
meaning on the server side there should be 3 diff datastreams for each one

for actual sensors -> /prod/ topic will have them 


/test/sensor
/test/distance
/test/alerts
"""

import paho.mqtt.client as mqtt
import ssl
import time
import json
import random
from datetime import datetime

endpoint = "a2nkc7jmrkgiu6-ats.iot.us-east-2.amazonaws.com"
cert_path = "../keys/e3af66cda61e45bb49b5f28cdb14a11e854fe59d5d0bab45fafe36a93fd89594-certificate.pem.crt"
private_key_path = "../keys/e3af66cda61e45bb49b5f28cdb14a11e854fe59d5d0bab45fafe36a93fd89594-private.pem.key"
ca_path = "../keys/AmazonRootCA1.pem"

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")

def on_publish(client, userdata, mid):
    print(f"Message {mid} published successfully")

def send_mqtt_message(topic, message, qos=0):
    """
    Send a message to a specific MQTT topic.
    
    Args:
        topic (str): The MQTT topic to publish to
        message (dict or str): The message to publish (will be converted to JSON if dict)
        qos (int): Quality of Service level (0, 1, or 2)
    
    Returns:
        bool: True if message was sent successfully, False otherwise
    """
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_publish = on_publish
    
    try:
        client.tls_set(ca_path,
                      certfile=cert_path,
                      keyfile=private_key_path,
                      cert_reqs=ssl.CERT_REQUIRED,
                      tls_version=ssl.PROTOCOL_TLSv1_2)
        print("TLS configuration successful")
    except Exception as e:
        print(f"TLS configuration failed: {e}")
        return False
    
    try:
        print(f"Connecting to AWS IoT Core at {endpoint}...")
        client.connect(endpoint, 8883, 60)
        print("Connected!")
        
        client.loop_start()
        
        if isinstance(message, dict):
            message = json.dumps(message)
        
        print(f"Publishing message to topic '{topic}'...")
        result = client.publish(topic, message, qos=qos)
        result.wait_for_publish()
        
        if result.is_published():
            print("Message published successfully")
        else:
            print("Failed to publish message")
        
        time.sleep(1)
        
        client.loop_stop()
        client.disconnect()
        
        return result.is_published()
    except Exception as e:
        print(f"Error in sending message: {e}")
        return False

def main():
    """
    Main function to simulate IoT sensor network data flow:
    - Sends random sensor data for each node (0-4) every 10 seconds
    - Sends one consolidated distance measurement message every 120 seconds
    """
    # Define node positions (x,y coordinates in meters)
    node_positions = {
        0: (0, 0),      # Node 0 at origin
        1: (10, 0),     # Node 1 at 10m east
        2: (0, 10),     # Node 2 at 10m north
        3: (10, 10),    # Node 3 at 10m northeast
        4: (5, 5)       # Node 4 at center
    }
    
    # Function to calculate distance between two nodes
    def calculate_distance(node1, node2):
        x1, y1 = node_positions[node1]
        x2, y2 = node_positions[node2]
        # Euclidean distance formula
        return round(((x2 - x1)**2 + (y2 - y1)**2)**0.5, 2)
    
    last_sensor_time = 0
    last_distance_time = 0
    rank = 0
    
    print("Starting soil mesh data simulation...")
    
    try:
        while True:
            current_time = time.time()
            
            # Send sensor data every 10 seconds
            if current_time - last_sensor_time >= 10:
                for node_id in range(5):
                    sensor_data = {
                        "nodeId": node_id,
                        "temperature": round(random.uniform(18.0, 28.0), 2),
                        "pressure": round(random.uniform(0.0, 5000.0), 2), 
                        "elevation": round(random.uniform(40.0, 80.0), 2),
                        "moisture": round(random.uniform(0.0, 1.0), 2), 
                    }
                    
                    print(f"{rank} MSG | Sending sensor data for node {node_id}: {json.dumps(sensor_data)}")
                    rank += 1
                    send_mqtt_message(f"soilMesh/test/sensor", sensor_data)
                    time.sleep(0.5)
                
                last_sensor_time = current_time
                print(f"Sensor data sent at {datetime.fromtimestamp(current_time).strftime('%H:%M:%S')}")
            
            # Send consolidated distance data every 120 seconds
            if current_time - last_distance_time >= 10:
                
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                # Create a single consolidated distance message
                consolidated_distances = {
                    "timestamp": timestamp,
                    "nodes": {}
                }
                
                # Calculate all node-to-node distances
                for from_node in range(5):
                    node_distances = {}
                    
                    print(f"Calculating distances from Node {from_node}:")
                    for to_node in range(5):
                        if from_node != to_node:
                            base_distance = calculate_distance(from_node, to_node)
                            distance = round(base_distance + random.uniform(-0.2, 0.2), 2)
                            node_distances[str(to_node)] = distance
                            print(f"  - Distance to Node {to_node}: {distance}m")
                    
                    # Add this node's distances to the consolidated message
                    consolidated_distances["nodes"][str(from_node)] = node_distances
                
                # Send the single consolidated message
                rank += 1
                send_mqtt_message(f"soilMesh/test/distance", consolidated_distances)
                print(consolidated_distances)
                
                last_distance_time = current_time
                print(f"Consolidated distance data sent at {datetime.fromtimestamp(current_time).strftime('%H:%M:%S')}")
                print("--- Completed distance measurements ---\n")
            
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("Simulation stopped by user")
    except Exception as e:
        print(f"Error in simulation: {e}")

if __name__ == "__main__":
    main()
