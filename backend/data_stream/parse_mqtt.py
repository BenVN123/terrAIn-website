"""
Functions for parsing mqtt messages and querying
Function name should align with topic parsed from
topic -> string
payload -> json
"""
import json

from data_query import query_sensor, query_distance
from dist_2_euclid import dist_2_euclid

def sensor(topic, payload):
    """
    payload format:
        sensor_node: int,
        temperature: double(2 prec),
        moisture: double(2 prec),
        pressure: double(2 prec),
        timestamp: date ("%Y-%m-%d %H:%M:%S")
    """

    if isinstance(payload, str):
        payload = json.loads(payload)
    
    # Call the existing implementation to store in DynamoDB
    processed_data = query_sensor(topic, payload)
    
    return processed_data


def distance(topic, payload):
    """
    payload format:
    sensor_node: int, 
    distance 0: int,
    distance 1: int,
    ..... distance n: int
    * to note: distance of self will not be included
    * will pass data too distance2_euclid -> convert into plane
    """

    if isinstance(payload, str):
        payload = json.loads(payload)

    # euclid_payload = dist_2_euclid(payload)
    
    # Call the existing implementation to store in DynamoDB
    processed_data = query_distance(topic, payload)
    # query_coord(topic, euclid_payload)
    
    return processed_data





