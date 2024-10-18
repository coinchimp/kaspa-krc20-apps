import axios from 'axios';
import * as fs from 'fs';

// Function to fetch token data for a given address
async function fetchTokenData(address: string) {
    try {
        const response = await axios.get(`https://api.kasplex.org/v1/krc20/address/${address}/tokenlist`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching data for address: ${address}`, error);
        throw error;
    }
}

// Function to fetch marketplace floor prices
async function fetchMarketplaceData() {
    try {
        const response = await axios.get('https://storage.googleapis.com/kspr-api-v1/marketplace/marketplace.json');
        return response.data;
    } catch (error) {
        console.error('Error fetching marketplace data:', error);
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
    const factor = Math.pow(10, decimals);
    const formattedValue = num / factor;
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(formattedValue);
}

// Function to sum token amounts by TICK and display the total
function updateTotals(totals: Map<string, number>, tick: string, amount: number) {
    if (totals.has(tick)) {
        totals.set(tick, totals.get(tick)! + amount);
    } else {
        totals.set(tick, amount);
    }
}

// Function to fetch token balances and display them in a simple table format
async function displayTokenDataForAddresses(addresses: string[]) {
    const rows: string[][] = [];
    const totals = new Map<string, number>(); // To track total amounts for each TICK
    const kasTotals = new Map<string, number>(); // To track KAS equivalents for each TICK

    // Fetch marketplace data
    const marketplaceData = await fetchMarketplaceData();

    for (const address of addresses) {
        try {
            const data = await fetchTokenData(address);
            const rowData: string[] = [address]; // Row data starts with the address

            // Collect token balances and update totals
            data.result.forEach((token: any) => {
                const balance = Number(token.balance);
                const formattedBalance = formatNumber(balance, Number(token.dec));
                rowData.push(`${token.tick}: ${formattedBalance}`);
                updateTotals(totals, token.tick, balance);

                // Convert to Kaspa equivalent using floor price
                const floorPrice = marketplaceData[token.tick]?.floor_price || 0;
                const kasEquivalent = balance * floorPrice;
                updateTotals(kasTotals, token.tick, kasEquivalent);
            });

            rows.push(rowData);

        } catch (error) {
            console.error(`Error processing address: ${address}`, error);
        }
    }

    // Print the table
    console.log("Address".padEnd(50) + "Tokens");
    console.log("-".repeat(80));

    rows.forEach(row => {
        console.log(row[0].padEnd(50) + row.slice(1).join(" | "));
    });

    // Print totals at the bottom with Kas equivalent
    console.log("\nTotals:");
    let totalKas = 0; // Total KAS accumulator
    totals.forEach((total, tick) => {
        const kasEquivalent = (kasTotals.get(tick) || 0) / 1000000; // Divide kasTotals by 1,000,000
        totalKas += kasEquivalent; // Add to total Kaspa
        console.log(`${tick}: ${formatNumber(total, 8)} / ${formatNumber(kasEquivalent, 2)} KAS`);
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

        // Display token data in a simple table format
        await displayTokenDataForAddresses(addresses);

    } catch (error) {
        console.error('Error in the main function:', error);
    }
}

main();
