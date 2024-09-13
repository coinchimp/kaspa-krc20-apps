#!/bin/bash

# Recursive function to run the sendKaspa command for each destination address in the file
send_kaspa_for_each_address() {
    local priv_key="$1"
    local key_file="$2"
    local amount="$3"

    while read -r line; do
        # Look for destination addresses in the file
        if [[ $line == Receive\ Address:* ]]; then
            # Extract everything after "Receive Address: " using a regex
            destination=$(echo "$line" | sed 's/Receive Address: //')
            echo "Found destination: $destination"

            # Run the sendKaspa.ts script using bun
            echo "Sending $amount Kaspa to $destination..."
            bun run ../src/sendKaspa.ts --privKey "$priv_key" --destination "$destination" --amount "$amount" --network testnet-10
            sleep 30
        fi
    done < "$key_file"
}

# Main script logic
if [[ $# -ne 3 ]]; then
    echo "Usage: $0 <privateKey> <keyFile> <amount>"
    exit 1
fi

private_key="$1"
key_file="$2"
amount="$3"

# Run the recursive sendKaspa function for the provided private key and each destination address
send_kaspa_for_each_address "$private_key" "$key_file" "$amount"
