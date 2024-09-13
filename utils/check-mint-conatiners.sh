#!/bin/bash

# Function to extract the latest loop iteration and reveal transaction info
check_container_logs() {
  container_name="$1"
  
  # Get the latest loop iteration and reveal transaction from the logs
  logs=$(sudo docker logs "$container_name" 2>&1 | tail -100)
  
  # Extract loop iteration
  loop_iteration=$(echo "$logs" | grep -oP '\[INFO\] Starting loop iteration \K[0-9]+' | tail -1)

  # Extract last reveal transaction ID and check if accepted
  reveal_transaction=$(echo "$logs" | grep -oP '\[INFO\] Reveal transaction has been accepted: \K[0-9a-f]+')

  # Display the results if loop iteration and reveal transaction are found
  if [[ -n "$loop_iteration" && -n "$reveal_transaction" ]]; then
    echo "Container: $container_name"
    echo "  Last loop iteration: $loop_iteration"
    echo "  Last reveal transaction accepted: $reveal_transaction"
  fi
}

# Main loop that runs every minute#!/bin/bash

# Function to extract the latest loop iteration and reveal transaction info
check_container_logs() {
  container_name="$1"
  
  # Get the latest loop iteration and reveal transaction from the logs
  logs=$(sudo docker logs "$container_name" 2>&1 | tail -100)
  
  # Extract loop iteration
  loop_iteration=$(echo "$logs" | grep -oP '\[INFO\] Starting loop iteration \K[0-9]+' | tail -1)

  # Extract last reveal transaction ID and check if accepted
  reveal_transaction=$(echo "$logs" | grep -oP '\[INFO\] Reveal transaction has been accepted: \K[0-9a-f]+')

  # Display the results if loop iteration and reveal transaction are found
  if [[ -n "$loop_iteration" && -n "$reveal_transaction" ]]; then
    echo "Container: $container_name"
    echo "  Last loop iteration: $loop_iteration"
    echo "  Last reveal transaction accepted: $reveal_transaction"
  fi
}

# Main loop that runs every minute
while true; do
  clear
  echo "Checking containers..."

  # Loop over all containers with the name pattern 'utils-minting-app-[1-10]-1'
  for i in {1..10}; do
    container_name="utils-minting-app-${i}-1"
    
    # Check if the container exists and is running
    if sudo docker ps --format "{{.Names}}" | grep -q "$container_name"; then
      check_container_logs "$container_name"
    else
      echo "Container $container_name is not running."
    fi
  done
  
  # Sleep for 60 seconds before refreshing
  sleep 60
done

while true; do
  clear
  echo "Checking containers..."

  # Loop over all containers with the name pattern 'utils-minting-app-[1-10]-1'
  for i in {1..10}; do
    container_name="utils-minting-app-${i}-1"
    
    # Check if the container exists and is running
    if sudo docker ps --format "{{.Names}}" | grep -q "$container_name"; then
      check_container_logs "$container_name"
    else
      echo "Container $container_name is not running."
    fi
  done
  
  # Sleep for 60 seconds before refreshing
  sleep 60
done
