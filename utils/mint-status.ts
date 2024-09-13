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

// Function to format the number with a thousand separator
function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(num);
}

// Function to filter the holders by the addresses and display the amount and the difference
function filterAndDisplayAmounts(holders: any[], addresses: string[], previousAmounts: Map<string, number>) {
    const currentAmounts = new Map<string, number>();

    holders
        .filter(holder => addresses.includes(holder.address))
        .forEach(holder => {
            const currentAmount = Number(holder.amount) / 1000000; // Divide the amount by 1,000,000
            const previousAmount = previousAmounts.get(holder.address) || 0;

            const formattedAmount = formatNumber(currentAmount);
            const difference = currentAmount - previousAmount;

            console.log(
                `Address: ${holder.address}, Amount: ${formattedAmount}, Difference: ${difference >= 0 ? "+" : ""}${formatNumber(difference)}`
            );

            // Store the current amount for this address
            currentAmounts.set(holder.address, currentAmount);
        });

    // Return the updated amounts to track in the next interval
    return currentAmounts;
}

// Main function to execute the app
async function main() {
    // Get the tick and file path from the command-line arguments
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Error: Please provide a tick symbol and a file path as command-line arguments.');
        process.exit(1);
    }

    const tick = args[0]; // The first argument is the tick value
    const filePath = args[1]; // The second argument is the file path for addresses

    // Ensure the file exists
    if (!fs.existsSync(filePath)) {
        console.error('Error: The specified addresses file does not exist.');
        process.exit(1);
    }

    let previousAmounts = new Map<string, number>(); // To track previous amounts

    try {
        // Function to refresh the status every 10 seconds
        const refreshStatus = async () => {
            // Fetch TICK data from the API
            const data = await fetchTickData(tick);

            // Read the list of addresses from the file
            const addresses = readAddresses(filePath);

            // Clear the console to give a "refresh" effect like the `watch` command
            console.clear();
            console.log(`--- Checking ${tick} status ---`);

            // Display the filtered results and store current amounts
            previousAmounts = filterAndDisplayAmounts(data.result[0].holder, addresses, previousAmounts);
        };

        // Refresh the status every 10 seconds
        await refreshStatus(); // First run
        setInterval(refreshStatus, 30000); // Re-run every 10 seconds

    } catch (error) {
        console.error('Error in the main function:', error);
    }
}

main();
