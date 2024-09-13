#!/bin/bash

# Path to the file where private keys are stored
key_file=$1
# Path to the docker-compose file to be generated
docker_compose_file="docker-compose.yml"

# Clear or create the docker-compose file
> $docker_compose_file

# Write the version and services header
cat <<EOL >> $docker_compose_file


services:
EOL

# Initialize a counter for private key extraction
counter=1

# Extract private keys and write them to docker-compose file
while read -r line; do
  # Check if the line contains a private key
  if [[ $line == Private\ Key:* ]]; then
    # Extract the private key value
    privKey=$(echo $line | awk '{print $3}')
    
    # Write the service block for each minting app
    cat <<EOL >> $docker_compose_file
  minting-app-$counter:
    image: krc20-mint:0.1a
    command: ["--privKey", "$privKey", "--logLevel", "DEBUG", "--network", "testnet-10", "--priorityFee", "0", "--ticker", "CHIMPC", "--loops", "100"]

EOL

    # Increment the counter
    ((counter++))

    # Stop after 10 private keys
    if [[ $counter -gt 10 ]]; then
      break
    fi
  fi
done < "$key_file"

# Inform the user
echo "Docker Compose file generated: $docker_compose_file"
