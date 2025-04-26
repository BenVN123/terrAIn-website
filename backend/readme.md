# Dirt Mesh data processing pipeline
- currently on ec2 instance 
- it handles:
    - querying to dynamoDB on aws
    - generates euclidean plane for sensor mesh
    - handles influx of data from mqtt server

## Mqtt structure
FOR TESTING:
Should emulate sensors publishing into topics
meaning on the server side there should be 3 diff datastreams for each one
for actual sensors -> /prod/ topic will have them 

test topics for debugging 
    /test/sensor
    /test/distance
    /test/alerts

## Data stream
streaming process happens through data_stream/main.py
see data_stream/parse_mqtt.py for functions to parse mqtt topics
 

## future improvements
- [ ] add load balancer and support for high # of sensors + users
- [ ] rewrite in rust