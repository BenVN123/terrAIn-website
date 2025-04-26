"""
main pipeline where data flows through, all calculations and queries done here
(single-threaded version with no class)
"""

import time
from data_streamer import TopicReader
from parse_mqtt import sensor, distance
from data_query import DynamoDBHandler

def main_loop():
    # Initialize components
    db_handler = DynamoDBHandler()
    running = True
    
    # Initialize and start readers
    sensors_reader = TopicReader(
        config_path='topic_parsing/test_sensors.ini',
        parse_function=sensor,
        verbose=False
    )
    
    distances_reader = TopicReader(
        config_path='topic_parsing/test_distances.ini',
        parse_function=distance,
        verbose=False
    )
    
    sensors_reader.start(blocking=False)
    distances_reader.start(blocking=False)
    
    try:
        while running:
            # Check for sensor data
            sensor_message = sensors_reader.get_message(block=False)
            # print('message in')

            if sensor_message:
                topic, data = sensor_message
                print(f"Processing sensor data: {data['nodeId']}, temp: {data['temperature']}")
            
            # Check for distance data
            distance_message = distances_reader.get_message(block=False)

            if distance_message:
                print("distance:", distance_message)
                topic, data = distance_message

            time.sleep(0.1)
            
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        # Clean up
        sensors_reader.disconnect()
        distances_reader.disconnect()

if __name__ == "__main__":
    main_loop()