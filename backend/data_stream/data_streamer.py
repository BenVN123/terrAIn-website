import paho.mqtt.client as mqtt
import ssl
import time
import json
import uuid
import os
import configparser
import threading
import queue

class TopicReader:
    """
    A multithreaded, modular MQTT client for AWS IoT Core that can be configured through a config file.
    """

    def __init__(self, config_path, parse_function=None, verbose=True):
        """
        Initialize the MQTT client with configuration from a file.

        Args:
            config_path (str): Path to the configuration file
            parse_function (callable, optional): Function to parse received messages
            verbose (bool): Whether to print messages to console
        """
        self.config = self._load_config(config_path)
        self.verbose = verbose
        self.parse_function = parse_function
        self.running = False
        self.thread = None
        self.message_queue = queue.Queue()

        client_id = self.config.get('client_id', None)
        if not client_id:
            client_id = f"soilmesh-subscriber-{uuid.uuid4().hex[:8]}"

        # Initialize MQTT client
        self.client = mqtt.Client(client_id=client_id)
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message

        # Configure TLS
        self._configure_tls()

    def _load_config(self, config_path):
        """
        Load configuration from file.

        Args:
            config_path (str): Path to the configuration file

        Returns:
            dict: Configuration values
        """
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Config file not found: {config_path}")

        config = configparser.ConfigParser()
        config.read(config_path)

        return {
            'endpoint': config['AWS_IOT']['endpoint'],
            'topic': config['AWS_IOT']['topic'],
            'cert_path': config['AWS_IOT']['cert_path'],
            'private_key_path': config['AWS_IOT']['private_key_path'],
            'ca_path': config['AWS_IOT']['ca_path'],
            'client_id': config['AWS_IOT'].get('client_id', None)
        }

    def _configure_tls(self):
        """Configure TLS for secure connection to AWS IoT Core."""
        self.client.tls_set(
            self.config['ca_path'],
            certfile=self.config['cert_path'],
            keyfile=self.config['private_key_path'],
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2
        )
        if self.verbose:
            print("TLS configuration successful")

    def _on_connect(self, client, userdata, flags, rc):
        """
        Callback for when connection is established.

        Args:
            client: MQTT client instance
            userdata: User data
            flags: Connection flags
            rc: Result code
        """
        if self.verbose:
            print(f"Connected with result code {rc}")
            print(f"Subscribed to {self.config['topic']}")
            print("Waiting for messages...")
            print("-" * 50)
        client.subscribe(self.config['topic'], qos=1)

    def _on_message(self, client, userdata, msg):
        """
        Callback for when a message is received.

        Args:
            client: MQTT client instance
            userdata: User data
            msg: Received message
        """
        try:
            # Try to parse as JSON
            payload = json.loads(msg.payload.decode())
            formatted_payload = json.dumps(payload, indent=2)

            # Process with custom parser if provided
            if self.parse_function:
                processed_payload = self.parse_function(msg.topic, payload)
            else:
                processed_payload = payload

            if self.verbose:
                print("\nNew message received:")
                print(f"Topic: {msg.topic}")
                print("Message:")
                print(formatted_payload)
                print("-" * 50)

            # Add processed message to queue for thread-safe access
            self.message_queue.put((msg.topic, processed_payload))

            return processed_payload

        except json.JSONDecodeError:
            # If not JSON, print as plain text
            if self.verbose:
                print("\nNew message received:")
                print(f"Topic: {msg.topic}")
                print(f"Message: {msg.payload.decode()}")
                print("-" * 50)

            # Process with custom parser if provided
            if self.parse_function:
                processed_payload = self.parse_function(msg.topic, msg.payload.decode())
            else:
                processed_payload = msg.payload.decode()
                
            # Add processed message to queue
            self.message_queue.put((msg.topic, processed_payload))
            
            return processed_payload

    def connect(self):
        """Connect to AWS IoT Core."""
        if self.verbose:
            print(f"Connecting to AWS IoT Core...")
        self.client.connect(self.config['endpoint'], 8883, 60)

    def _run_loop(self):
        """Run the MQTT client loop in a separate thread."""
        try:
            self.client.loop_forever()
        except Exception as e:
            if self.verbose:
                print(f"Error in MQTT loop: {e}")
            self.running = False

    def start(self, blocking=False):
        """
        Start the client loop to process messages in a separate thread.

        Args:
            blocking (bool): If True, wait for the thread to complete (not recommended)
        """
        if self.running:
            if self.verbose:
                print("Client is already running")
            return
            
        self.connect()
        self.running = True
        
        # Create and start a new thread for the MQTT client loop
        self.thread = threading.Thread(target=self._run_loop)
        self.thread.daemon = True  # Thread will exit when main program exits
        self.thread.start()
        
        if self.verbose:
            print("MQTT client started in background thread")
            
        if blocking:
            self.thread.join()
            
        return self.client

    def get_message(self, block=True, timeout=None):
        """
        Get the next message from the queue.

        Args:
            block (bool): If True, block until a message is available
            timeout (float): Timeout in seconds (None = wait forever)

        Returns:
            tuple: (topic, payload) or None if timeout
        """
        try:
            return self.message_queue.get(block=block, timeout=timeout)
        except queue.Empty:
            return None

    def is_running(self):
        """Check if the client is running."""
        return self.running and (self.thread is not None and self.thread.is_alive())

    def disconnect(self):
        """Disconnect from AWS IoT Core and stop the thread."""
        if self.verbose:
            print("\nDisconnecting...")
            
        self.running = False
        self.client.disconnect()
        
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
            
        if self.verbose:
            print("Disconnected!")


# Example usage with threading
if __name__ == "__main__":
    def custom_parser(topic, payload):
        return {
            "processed_topic": topic,
            "processed_data": payload
        }

    mqtt_client = TopicReader(
        config_path="topic_parsing/base.ini",
        parse_function=custom_parser,
        verbose=True
    )
    
    # Start the client in a non-blocking way
    mqtt_client.start(blocking=False)
    
    try:
        # Main application loop
        print("Main application running...")
        while True:
            # Check if we have new messages
            message = mqtt_client.get_message(block=False)
            if message:
                topic, payload = message
                print(f"Main thread processing: {topic}")
                # Do something with the message in the main thread
                
            # Other application logic can go here
            time.sleep(0.1)
            
    except KeyboardInterrupt:
        print("Stopping application...")
    finally:
        mqtt_client.disconnect()