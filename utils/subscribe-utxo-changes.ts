import { RpcClient, Resolver, Encoding } from '../wasm/kaspa';
import minimist from 'minimist';

// Parse command-line arguments
const args = minimist(process.argv.slice(2));

const targetAddress = args.address;
const network = args.network || 'testnet-10';

if (!targetAddress) {
    console.error("Error: Please provide an address using the --address flag.");
    process.exit(1);
}

function log(message: any, level: string = 'INFO') {
    const timestamp = new Date().toISOString();
    let logMessage;

    if (typeof message === 'object') {
        logMessage = JSON.stringify(message, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value // Convert BigInt to string
        );
    } else {
        logMessage = message;
    }

    console.log(`[${timestamp}] [${level}] ${logMessage}`);
}

(async () => {
    const rpc = new RpcClient({
        resolver: new Resolver(),
        encoding: Encoding.Borsh,
        networkId: network,
    });

    log(`Connecting to network: ${network}`, 'INFO');
    await rpc.connect();
    log(`Connected to ${rpc.url}`, 'INFO');

    log(`Subscribing to UTXO changes for address: ${targetAddress}`, 'INFO');
    await rpc.subscribeUtxosChanged([targetAddress]);

    rpc.addEventListener('utxos-changed', async (event: any) => {
        log(`UTXO changes detected for address: ${targetAddress}`, 'INFO');

        log(`Event data: ${JSON.stringify(event, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value, 2)}`, 'DEBUG');
    });

    process.on('SIGINT', async () => {
        log('Received SIGINT signal, disconnecting...', 'INFO');
        await rpc.disconnect();
        log('Disconnected.', 'INFO');
        process.exit(0);
    });
})();
