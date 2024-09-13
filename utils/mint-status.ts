import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Function to fetch the TICK holders data from the API
async function fetchTickData(tick: string) {
    try {
        const response = await axios.get(`https://tn10api.kasplex.org/v1/krc20/token/${tick}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching TICK data:', error);
        throw error;
    }
}

// Function to read the addresses from a file
function readAddresses(filePath: string): string[] {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n').map(line => line.trim());
    return lines
        .filter(line => line.startsWith('Receive Address:'))
        .map(line => line.replace('Receive Address: ', '').trim());
}

// Function to filter the holders by the addresses and display the amount
function filterAndDisplayAmounts(holders: any[], addresses: string[]) {
    const filteredHolders = holders.filter(holder => addresses.includes(holder.address));

    filteredHolders.forEach(holder => {
        const amount = Number(holder.amount) / 1000000; // Divide the amount by 1,000,000
        console.log(`Address: ${holder.address}, Amount: ${amount}`);
    });
}

// Main function to execute the app
async function main() {
    // Get the tick from the command-line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Error: Please provide a tick symbol as a command-line argument.');
        process.exit(1);
    }

    const tick = args[0]; // The first argument is the tick value
    const filePath = path.join(__dirname, 'addresses.txt'); // Path to the file containing the addresses

    try {
        // Fetch TICK data from the API
        const data = await fetchTickData(tick);

        // Read the list of addresses from the file
        const addresses = readAddresses(filePath);

        // Every 10 seconds, filter and display the amounts
        setInterval(() => {
            console.log(`--- Checking ${tick} status ---`);
            filterAndDisplayAmounts(data.result[0].holder, addresses);
        }, 10000); // 10 seconds interval

    } catch (error) {
        console.error('Error in the main function:', error);
    }
}

main();
