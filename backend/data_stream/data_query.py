import json
import boto3
from datetime import datetime
import uuid
from boto3.dynamodb.conditions import Key
from decimal import Decimal

class DynamoDBHandler:
    def __init__(self, region_name='us-east-1'):
        self.dynamodb = boto3.resource('dynamodb', region_name=region_name)
        self.client = boto3.client('dynamodb', region_name=region_name)
        
        self.nodes_table_name = 'Nodes'
        self.readings_table_name = 'Readings'
        self.distances_table_name = 'Distances'
        
        self.create_tables_if_not_exist()
    
    def create_tables_if_not_exist(self):
        existing_tables = self.client.list_tables()['TableNames']
        
        if self.nodes_table_name not in existing_tables:
            self.dynamodb.create_table(
                TableName=self.nodes_table_name,
                KeySchema=[
                    {'AttributeName': 'nodeId', 'KeyType': 'HASH'},
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'nodeId', 'AttributeType': 'S'},
                ],
                ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            )
            print(f"Created {self.nodes_table_name} table")
        
        if self.readings_table_name not in existing_tables:
            self.dynamodb.create_table(
                TableName=self.readings_table_name,
                KeySchema=[
                    {'AttributeName': 'nodeId', 'KeyType': 'HASH'},
                    {'AttributeName': 'timestamp', 'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'nodeId', 'AttributeType': 'S'},
                    {'AttributeName': 'timestamp', 'AttributeType': 'S'},
                    {'AttributeName': 'readingId', 'AttributeType': 'S'}
                ],
                GlobalSecondaryIndexes=[
                    {
                        'IndexName': 'ReadingIdIndex',
                        'KeySchema': [
                            {'AttributeName': 'readingId', 'KeyType': 'HASH'},
                        ],
                        'Projection': {'ProjectionType': 'ALL'},
                        'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
                    },
                ],
                ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            )
            print(f"Created {self.readings_table_name} table")
        
        if self.distances_table_name not in existing_tables:
            self.dynamodb.create_table(
                TableName=self.distances_table_name,
                KeySchema=[
                    {'AttributeName': 'fromNodeId', 'KeyType': 'HASH'},
                    {'AttributeName': 'timestamp_toNodeId', 'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'fromNodeId', 'AttributeType': 'S'},
                    {'AttributeName': 'timestamp_toNodeId', 'AttributeType': 'S'},
                    {'AttributeName': 'distanceId', 'AttributeType': 'S'}
                ],
                GlobalSecondaryIndexes=[
                    {
                        'IndexName': 'DistanceIdIndex',
                        'KeySchema': [
                            {'AttributeName': 'distanceId', 'KeyType': 'HASH'},
                        ],
                        'Projection': {'ProjectionType': 'ALL'},
                        'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
                    },
                ],
                ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            )
            print(f"Created {self.distances_table_name} table")
        
        waiter = self.client.get_waiter('table_exists')
        for table_name in [self.nodes_table_name, self.readings_table_name, self.distances_table_name]:
            if table_name not in existing_tables:
                waiter.wait(TableName=table_name)
                print(f"Table {table_name} is now available")

def query_sensor(topic, payload):
    if isinstance(payload, str):
        payload = json.loads(payload)
    
    node_id = f"node{payload['sensor_node']}"
    temperature = Decimal(str(round(float(payload['temperature']), 2)))
    moisture = Decimal(str(round(float(payload.get('moisture', 0)), 2)))
    pressure = Decimal(str(round(float(payload.get('pressure', 1000)), 2)))
    
    try:
        timestamp = payload.get('timestamp')
        if not timestamp:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        dt = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")
        iso_timestamp = dt.isoformat() + "Z"
    except Exception:
        iso_timestamp = datetime.now().isoformat() + "Z"
    
    reading_id = f"r{uuid.uuid4().hex[:6]}"
    
    reading_item = {
        "readingId": reading_id,
        "nodeId": node_id,
        "temperature": temperature,
        "moisture": moisture,
        "pressure": pressure,
        "timestamp": iso_timestamp
    }
    
    try:
        db_handler = DynamoDBHandler()
        readings_table = db_handler.dynamodb.Table(db_handler.readings_table_name)
        readings_table.put_item(Item=reading_item)
        
        nodes_table = db_handler.dynamodb.Table(db_handler.nodes_table_name)
        response = nodes_table.query(KeyConditionExpression=Key('nodeId').eq(node_id))
        
        if not response.get('Items'):
            node_item = {
                "nodeId": node_id,
                "name": f"Sensor Node {payload['sensor_node']}",
                "description": "Environmental sensor",
                "createdAt": iso_timestamp,
                "lastUpdated": iso_timestamp
            }
            nodes_table.put_item(Item=node_item)
        else:
            nodes_table.update_item(
                Key={'nodeId': node_id},
                UpdateExpression="set lastUpdated=:ts",
                ExpressionAttributeValues={':ts': iso_timestamp}
            )
    except Exception as e:
        print(f"Error storing sensor data: {e}")
    
    return reading_item

def query_distance(topic, payload):
    if isinstance(payload, str):
        payload = json.loads(payload)
    
    from_node_id = f"node{payload['sensor_node']}"
    
    # Use provided timestamp if available, otherwise use current time
    try:
        timestamp = payload.get('timestamp')
        if timestamp:
            dt = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")
            timestamp = dt.isoformat() + "Z"
        else:
            timestamp = datetime.now().isoformat() + "Z"
    except Exception:
        timestamp = datetime.now().isoformat() + "Z"
    
    processed_data = []
    
    try:
        db_handler = DynamoDBHandler()
        distances_table = db_handler.dynamodb.Table(db_handler.distances_table_name)
        
        # Process the nested 'distances' dictionary
        if 'distances' in payload and isinstance(payload['distances'], dict):
            for node_idx, distance_value in payload['distances'].items():
                try:
                    # Convert distance value to float
                    distance_value = float(distance_value)
                    
                    # Create the to_node_id
                    to_node_id = f"node{node_idx}"
                    distance_id = f"d{uuid.uuid4().hex[:6]}"
                    timestamp_to_node = f"{timestamp}_{to_node_id}"
                    
                    distance_item = {
                        "distanceId": distance_id,
                        "fromNodeId": from_node_id,
                        "toNodeId": to_node_id,
                        "distance": Decimal(str(distance_value)),
                        "timestamp": timestamp,
                        "timestamp_toNodeId": timestamp_to_node
                    }
                    
                    distances_table.put_item(Item=distance_item)
                    processed_data.append(distance_item)
                    
                    # Update the last updated timestamp for both nodes
                    try:
                        nodes_table = db_handler.dynamodb.Table(db_handler.nodes_table_name)
                        for node in [from_node_id, to_node_id]:
                            response = nodes_table.query(KeyConditionExpression=Key('nodeId').eq(node))
                            
                            if not response.get('Items'):
                                # Create node if it doesn't exist
                                node_item = {
                                    "nodeId": node,
                                    "name": f"Sensor Node {node.replace('node', '')}",
                                    "description": "Distance sensor",
                                    "createdAt": timestamp,
                                    "lastUpdated": timestamp
                                }
                                nodes_table.put_item(Item=node_item)
                            else:
                                nodes_table.update_item(
                                    Key={'nodeId': node},
                                    UpdateExpression="set lastUpdated=:ts",
                                    ExpressionAttributeValues={':ts': timestamp}
                                )
                    except Exception as e:
                        print(f"Error updating node data: {e}")
                        
                except (ValueError, TypeError) as e:
                    print(f"Error processing distance value for node {node_idx}: {e}")
                    continue
    except Exception as e:
        print(f"Error storing distance data: {e}")
    
    return {
        "fromNodeId": from_node_id,
        "timestamp": timestamp,
        "distances": processed_data
    }

if __name__ == "__main__":

    sensor_payload = {
        "sensor_node": 123,
        "temperature": 22.567,
        "moisture": 45.789,
        "pressure": 1013.25,
        "timestamp": "2025-04-14 15:30:45"
    }
    
    distance_payload = {
        "sensor_node": 0,
        "timestamp": "2025-04-14 17:23:15",
        "distances": {
            "1": 9.9,
            "2": 10.08,
            "3": 14.05,
            "4": 7.2
        }
    }
    
    print("Processing sensor data:")
    result1 = query_sensor("sensors/temperature", sensor_payload)
    print(json.dumps(result1, indent=2, default=str))
    
    print("\nProcessing distance data:")
    result2 = query_distance("sensors/distance", distance_payload)
    print(json.dumps(result2, indent=2, default=str))