import { RpcClient, Resolver, PrivateKey, UtxoProcessor, UtxoContext, Encoding } from '../wasm/kaspa';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2));

const sourceAddress = args.address;
const network = args.network || 'testnet-10';

if (!sourceAddress) {
    console.error("Error: Please provide an address using the --address flag.");
    process.exit(1);
}
function log(message: any, level: string = 'INFO') {
    const timestamp = new Date().toISOString();
    let logMessage;

    if (typeof message === 'object') {
        logMessage = JSON.stringify(message, (key, value) =>
            typeof value === 'bigint' ? value.toString() + 'n' : value // Convert BigInt to string
        );
    } else {
        logMessage = message;
    }

    console.log(`[${timestamp}] [${level}] ${logMessage}`);
}

(async () => {
    log(`Source address: ${sourceAddress}`, 'INFO');

    const address = sourceAddress;
    log(`Tracking address: ${address}`, 'INFO');

    const rpc = new RpcClient({
        resolver: new Resolver(),
        encoding: Encoding.Borsh,
        networkId: network
    });

    const processor = new UtxoProcessor({ rpc, networkId: network });
    await processor.start();

    const context = new UtxoContext({ processor });

    processor.addEventListener('maturity', (event: any) => {
        log(`Event: ${JSON.stringify(event, (key, value) =>
            typeof value === 'bigint' ? value.toString() + 'n' : value // Handle BigInt serialization
        )}`, 'DEBUG');
    });

    log('Connecting to RPC...', 'INFO');
    await rpc.connect();
    log(`Connected to ${rpc.url}`, 'INFO');

    const { isSynced } = await rpc.getServerInfo();
    if (!isSynced) {
        log('Please wait for the node to sync', 'ERROR');
        await rpc.disconnect();
        return;
    }

    processor.addEventListener('utxo-proc-start', async (event: any) => {
        await context.trackAddresses([address]);
    });

    process.on('SIGINT', async () => {
        log('Received SIGINT signal, disconnecting...', 'INFO');
        await rpc.disconnect();
        log('Disconnected.', 'INFO');
        process.exit(0);
    });
})();
