import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

def create_test_table():
    """Create a simple test table in DynamoDB"""
    table = dynamodb.create_table(
        TableName='Test',
        KeySchema=[
            {
                'AttributeName': 'id',
                'KeyType': 'HASH'  # Partition key
            }
        ],
        AttributeDefinitions=[
            {
                'AttributeName': 'id',
                'AttributeType': 'S'
            }
        ],
        ProvisionedThroughput={
            'ReadCapacityUnits': 5,
            'WriteCapacityUnits': 5
        }
    )
    
    # Wait for the table to be created
    table.meta.client.get_waiter('table_exists').wait(TableName='Test')
    print("Table 'Test' created successfully!")
    
    return table

def add_items_to_table(table):
    """Add some sample items to the test table"""
    # Add first item
    table.put_item(
        Item={
            'id': '1',
            'name': 'Item One',
            'description': 'This is the first test item',
            'price': Decimal('10.99'),
            'in_stock': True
        }
    )
    
    # Add second item
    table.put_item(
        Item={
            'id': '2',
            'name': 'Item Two',
            'description': 'This is the second test item',
            'price': Decimal('24.50'),
            'in_stock': False
        }
    )
    
    # Add third item
    table.put_item(
        Item={
            'id': '3',
            'name': 'Item Three',
            'description': 'This is the third test item',
            'price': Decimal('5.25'),
            'in_stock': True
        }
    )
    
    print("Added 3 items to the 'Test' table")

def read_items_from_table(table):
    """Read and display all items from the test table"""
    response = table.scan()
    items = response['Items']
    
    print("\nItems in the 'Test' table:")
    for item in items:
        print(item)

if __name__ == "__main__":
    try:
        # Check if table already exists
        test_table = dynamodb.Table('Test')
        test_table.table_status  # This will throw an exception if table doesn't exist
        print("Table 'Test' already exists")
    except:
        # Create table if it doesn't exist
        test_table = create_test_table()
    
    # Add items to the table
    add_items_to_table(test_table)
    
    # Read and display items
    read_items_from_table(test_table)