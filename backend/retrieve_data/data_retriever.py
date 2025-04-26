#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import boto3
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


class DynamoDBRetriever:
    def __init__(self, region_name='us-east-1'):
        self.dynamodb = boto3.resource('dynamodb', region_name=region_name)
        self.readings_table = self.dynamodb.Table('Readings')
        self.nodes_table = self.dynamodb.Table('Nodes')
        self.gnss_table = self.dynamodb.Table('GNSS')

    def get_last_n_readings_for_all_nodes(self, n=10):
        """
        Retrieves the last n readings for all nodes.
        
        Args:
            n (int): Number of most recent readings to retrieve per node
            
        Returns:
            dict: Dictionary with node IDs as keys and lists of readings as values
        """
        # Get all node IDs from the Nodes table
        response = self.nodes_table.scan(
            ProjectionExpression="nodeId"
        )
        nodes = response.get('Items', [])
        
        # For each node, get the last n readings
        result = {}
        for node in nodes:
            node_id = node.get('nodeId')
            
            # Query the latest n readings for this node
            response = self.readings_table.query(
                KeyConditionExpression=Key('nodeId').eq(node_id),
                ScanIndexForward=False,  # Sort in descending order (newest first)
                Limit=n
            )
            
            # Add to result dictionary
            if response.get('Items'):
                result[node_id] = response.get('Items')
        
        return json.loads(json.dumps(result, cls=DecimalEncoder))

    def get_readings_for_specific_nodes(self, node_ids, n=10):
        """
        Retrieves the last n readings for specific nodes.
        
        Args:
            node_ids (list): List of node IDs to retrieve data for
            n (int): Number of most recent readings to retrieve per node
            
        Returns:
            dict: Dictionary with node IDs as keys and lists of readings as values
        """
        result = {}
        
        for node_id in node_ids:
            # Query the latest n readings for this node
            response = self.readings_table.query(
                KeyConditionExpression=Key('nodeId').eq(node_id),
                ScanIndexForward=False,  # Sort in descending order (newest first)
                Limit=n
            )
            
            # Add to result dictionary
            if response.get('Items'):
                result[node_id] = response.get('Items')
        
        return json.loads(json.dumps(result, cls=DecimalEncoder))

    def get_node_info(self, node_ids=None):
        """
        Retrieves information about nodes.
        
        Args:
            node_ids (list, optional): List of node IDs to retrieve. If None, retrieves all nodes.
            
        Returns:
            list: List of node information dictionaries
        """
        if node_ids:
            # Get specific nodes
            result = []
            for node_id in node_ids:
                response = self.nodes_table.get_item(
                    Key={'nodeId': node_id}
                )
                if 'Item' in response:
                    result.append(response['Item'])
        else:
            # Get all nodes
            response = self.nodes_table.scan()
            result = response.get('Items', [])
        
        return json.loads(json.dumps(result, cls=DecimalEncoder))


# Example usage
if __name__ == "__main__":
    retriever = DynamoDBRetriever()
    
    # Get the last 5 readings for all nodes
    all_nodes_data = retriever.get_last_n_readings_for_all_nodes(5)
    print(f"Retrieved data for {len(all_nodes_data)} nodes")
    
    # Get node information
    nodes_info = retriever.get_node_info()
    print(f"Retrieved information for {len(nodes_info)} nodes")