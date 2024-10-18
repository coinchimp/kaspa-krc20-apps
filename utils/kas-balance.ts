import axios from 'axios';
import * as fs from 'fs';

// Function to fetch Kaspa balance for a given address
async function fetchKaspaBalance(address: string) {
    try {
        const response = await axios.get(`https://api.kaspa.org/addresses/${address}/balance`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching balance for address: ${address}`, error);
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

// Function to format the number with a thousand separator and two decimals
function formatNumber(num: number, decimals: number): string {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
}

// Function to sum and display the total Kaspa balance
async function displayKaspaBalancesForAddresses(addresses: string[]) {
    const rows: string[][] = [];
    let totalKas = 0; // Total Kaspa accumulator

    for (const address of addresses) {
        try {
            const data = await fetchKaspaBalance(address);
            const balance = data.balance / 100000000; // Convert to KAS
            totalKas += balance;
            const formattedBalance = formatNumber(balance, 2);
            rows.push([address, ` ${formattedBalance} KAS`]);
        } catch (error) {
            console.error(`Error processing address: ${address}`, error);
        }
    }

    // Print the table
    console.log("Address".padEnd(50) + "Balance (KAS)");
    console.log("-".repeat(80));

    rows.forEach(row => {
        console.log(row[0].padEnd(50) + row[1]);
    });

    // Print total KAS
    console.log(`\nTOTAL KAS: ${formatNumber(totalKas, 2)} KAS`);
}

// Main function to execute the app
async function main() {
    // Get the file path from the command-line arguments
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Error: Please provide a file path as a command-line argument.');
        process.exit(1);
    }

    const filePath = args[0]; // The argument is the file path for addresses

    // Ensure the file exists
    if (!fs.existsSync(filePath)) {
        console.error('Error: The specified addresses file does not exist.');
        process.exit(1);
    }

    try {
        // Read the list of addresses from the file
        const addresses = readAddresses(filePath);

        // Display Kaspa balances in a simple table format
        await displayKaspaBalancesForAddresses(addresses);

    } catch (error) {
        console.error('Error in the main function:', error);
    }
}

main();
