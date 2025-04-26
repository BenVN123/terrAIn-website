#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
LOG_FILE="${SCRIPT_DIR}/backend_errors.log"
ENV_FILE="${SCRIPT_DIR}/backend/retrieve_data/.env"

echo "Starting backend server..." | tee -a "${LOG_FILE}"
echo "$(date)" | tee -a "${LOG_FILE}"

# Create virtual environment if it doesn't exist
if [ ! -d "${SCRIPT_DIR}/backend/venv" ]; then
    echo "Creating virtual environment..." | tee -a "${LOG_FILE}"
    python3 -m venv "${SCRIPT_DIR}/backend/venv"
fi

# Create .env file if it doesn't exist
if [ ! -f "${ENV_FILE}" ]; then
    echo "Creating .env file..." | tee -a "${LOG_FILE}"
    cat > "${ENV_FILE}" << EOF
# AWS DynamoDB Configuration
AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your_access_key
# AWS_SECRET_ACCESS_KEY=your_secret_key

# AWS IoT Core MQTT Configuration
# To use real MQTT data, uncomment and configure these settings
# If these are commented out, mock data will be generated for testing

# AWS_IOT_ENDPOINT=your-iot-endpoint.iot.us-east-1.amazonaws.com
# AWS_IOT_PORT=8883
# AWS_IOT_ROOT_CA=${SCRIPT_DIR}/backend/keys/AmazonRootCA1.pem
# AWS_IOT_CERT=${SCRIPT_DIR}/backend/keys/your-certificate.pem.crt
# AWS_IOT_PRIVATE_KEY=${SCRIPT_DIR}/backend/keys/your-private.pem.key

# Mock Data Settings
# Set to "true" to use mock data even if AWS IoT credentials are provided
MOCK_DATA=true
# Number of simulated nodes
MOCK_NODES=3
# Update interval in seconds
MOCK_UPDATE_INTERVAL=5
EOF
    echo "Created .env file. Please update it with your credentials." | tee -a "${LOG_FILE}"
else
    # Ensure MOCK_DATA=true is set in the .env file if not already present
    if ! grep -q "MOCK_DATA=" "${ENV_FILE}"; then
        echo "" >> "${ENV_FILE}"
        echo "# Mock Data Settings" >> "${ENV_FILE}"
        echo "MOCK_DATA=true" >> "${ENV_FILE}"
        echo "MOCK_NODES=3" >> "${ENV_FILE}"
        echo "MOCK_UPDATE_INTERVAL=5" >> "${ENV_FILE}"
        echo "Added mock data settings to .env file" | tee -a "${LOG_FILE}"
    fi
fi

# Activate virtual environment and install dependencies
echo "Activating virtual environment..." | tee -a "${LOG_FILE}"
source "${SCRIPT_DIR}/backend/venv/bin/activate"

# Install dependencies
echo "Installing dependencies..." | tee -a "${LOG_FILE}"
pip install -r "${SCRIPT_DIR}/backend/retrieve_data/requirements.txt" 2>&1 | tee -a "${LOG_FILE}"

# Try to kill any existing backend processes
echo "Checking for existing backend processes..." | tee -a "${LOG_FILE}" 
pkill -f "python.*app.py" 2>/dev/null || echo "No existing backend process found"

export FLASK_PORT=5000

# Run the Flask app
echo "Starting Flask application on port ${FLASK_PORT}..." | tee -a "${LOG_FILE}"
cd "${SCRIPT_DIR}/backend/retrieve_data" && python app.py 2>&1 | tee -a "${LOG_FILE}"