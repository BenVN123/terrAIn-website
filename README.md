j Dirt Mesh LA

A sensor network system that collects data from multiple sensors and stores it in AWS DynamoDB, with a visualization dashboard and real-time data streaming.

## Project Structure

- **Backend**: 
  - Data streamer for AWS IoT Core
  - DynamoDB data storage
  - Flask API for retrieving data
  - WebSocket support for real-time data streaming
  - MQTT client for subscribing to sensor topics

- **Frontend**: 
  - React with TypeScript 
  - Modern UI with Shadcn UI components
  - Data visualization using Recharts
  - Real-time data streaming with Socket.IO
  - Responsive dashboard with historical and live data

## Features

- **Historical Data Dashboard**: View and analyze past sensor readings
- **Real-time Data Streaming**: Watch sensor data as it arrives via WebSockets
- **API Explorer**: Interactive documentation for exploring the backend API
- **Multi-node Support**: Select and compare data from multiple sensors
- **Temperature and Humidity Charts**: Visualize sensor data with interactive charts
- **Raw Data Tables**: View the underlying data in tabular format
- **MQTT Integration**: Direct connection to AWS IoT Core for real-time updates

## Getting Started

### Quick Start

We've included scripts to easily start both the backend and frontend with proper error logging:

1. Set up AWS credentials in your environment:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

2. Start the backend:

```bash
./start_backend.sh
```

The API will be available at http://localhost:5001

3. Start the frontend (in a new terminal):

```bash
./start_frontend.sh
```

The frontend will be available at http://localhost:3002

### Manual Setup

#### Backend Setup

1. Set up AWS credentials in your environment:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

2. Create and activate a virtual environment:

```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
```

3. Install backend dependencies:

```bash
cd backend/retrieve_data
pip install -r requirements.txt
```

4. Run the Flask API:

```bash
cd backend/retrieve_data
python app.py
```

The API will be available at http://localhost:5000

#### Frontend Setup

1. Install frontend dependencies:

```bash
cd frontend
npm install
```

2. Set up the environment variables:

```bash
# Create a .env file in the frontend directory
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
```

3. Run the development server:

```bash
cd frontend
npm start
```

The frontend will be available at http://localhost:3000

## Mock Data Generation

For easier development and testing, the system can generate simulated sensor data without requiring a connection to AWS IoT Core. This is enabled by default and can be configured through the `.env` file.

### Mock Data Settings

```
# Set to "true" to use mock data, "false" to use real MQTT
MOCK_DATA=true

# Number of simulated nodes
MOCK_NODES=3

# Update interval in seconds
MOCK_UPDATE_INTERVAL=5
```

When mock data is enabled, the system will generate:
- Temperature readings (varying around 20-35°C)
- Humidity readings (varying around 40-60%)
- Distance measurements between nodes
- All data is streamed via WebSockets just like real data

To use real data instead, set `MOCK_DATA=false` and configure the AWS IoT Core connection parameters in the `.env` file.

## API Endpoints

- `GET /api/nodes` - Get all nodes
- `GET /api/nodes/{node_id}` - Get a specific node
- `GET /api/readings?n={count}&nodes={node_ids}` - Get the last n readings for specific nodes
- `GET /api/health` - Health check

## WebSocket Events

- `mqtt_message` - All MQTT messages
- `sensors_temperature` - Temperature sensor readings
- `sensors_distance` - Distance sensor readings

## Features

- Real-time sensor data visualization
- Historical data analysis
- Multi-node support
- Temperature and humidity tracking
