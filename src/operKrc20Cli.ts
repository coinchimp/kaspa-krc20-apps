import { RpcClient, Encoding, Resolver } from "../wasm/kaspa";
import minimist from 'minimist';
import { Krc20Operation, KRC20OperationData } from './Krc20Operation';

// Parse command-line arguments
const args = minimist(process.argv.slice(2));

const {
  privKey: privateKeyArg,
  network = 'testnet-10',
  ticker = 'TNACHO',
  priorityFee = '0.1',
  timeout = 20000,
  logLevel = 'INFO',
  operation = 'mint',
  destination,
  max,
  lim,
  pre,
  help
} = args;

// Display help message if --help flag is used
if (help) {
  console.log(`
Usage: bun run app.ts --privKey <priv-key> --operation <operation> [options]

Options:
  --privKey <priv-key>       Your private key (required)
  --operation <operation>    Operation to perform: mint, deploy, transfer (required)
  --network <network>        Network to use (default: 'testnet-10')
  --ticker <ticker>          Ticker symbol (default: 'TNACHO')
  --priorityFee <fee>        Priority fee in KAS (default: 0.1)
  --timeout <ms>             Timeout for operations in milliseconds (default: 20000)
  --logLevel <level>         Logging level: INFO, DEBUG (default: 'INFO')
  --destination <address>    Destination wallet address for transfer
  --max <max-supply>         Maximum supply for deploy
  --lim <limit-per-mint>   Limit per mint for deploy
  --pre <preallocation>      Preallocation amount for deploy
  --help                     Show this help message and exit
  `);
  process.exit(0);
}

// Logging utility function with support for INFO and DEBUG levels
function log(message: string, level: string = 'INFO') {
  const timestamp = new Date().toISOString();
  if (level === 'ERROR') {
    console.error(`[${timestamp}] [${level}] ${message}`);
  } else if (logLevel === 'DEBUG' || level === 'INFO') {
    console.log(`[${timestamp}] [${level}] ${message}`);
  }
}

// Validate essential arguments and provide detailed feedback
if (!privateKeyArg) {
  log("Error: Private key is required. Use --privKey <priv-key>.", 'ERROR');
  console.log("Example: --privKey your_private_key_here");
  process.exit(1);
}

if (!operation) {
  log("Error: Operation is required. Use --operation <mint|deploy|transfer>.", 'ERROR');
  console.log("Example: --operation mint");
  process.exit(1);
}

if (operation === 'transfer' && !destination) {
  log("Error: Destination wallet address is required for transfer operation. Use --destination <wallet-address>.", 'ERROR');
  console.log("Example: --destination your_wallet_address_here");
  process.exit(1);
}

if (operation === 'deploy' && (!max || !lim)) {
  log("Error: Max supply and limit per mint are required for deploy operation. Use --max <max-supply> and --limit <limit-per-mint>.", 'ERROR');
  console.log("Example: --max 1000000 --lim 1000");
  process.exit(1);
}

// Construct the data object based on the operation type
const data: KRC20OperationData = {
  p: "krc-20",
  op: operation as 'mint' | 'deploy' | 'transfer',
  tick: ticker,
  to: destination,
  max: operation === 'deploy' ? max : undefined,
  lim: operation === 'deploy' ? lim : undefined,
  pre: operation === 'deploy' ? pre : undefined,
};

// Main async function to handle the RPC connection and KRC20 operations
(async () => {
  try {
    // Initialize the RPC client
    const RPC = new RpcClient({
      resolver: new Resolver(),
      encoding: Encoding.Borsh,
      networkId: network
    });

    log("Connecting to the RPC server...", 'INFO');
    await RPC.connect();
    log("RPC connection established.", 'INFO');

    // Check server status to ensure it is synced and has UTXO index
    const serverInfo = await RPC.getServerInfo();
    if (!serverInfo.isSynced || !serverInfo.hasUtxoIndex) {
      log('Error: Provided node is either not synchronized or lacks the UTXO index.', 'ERROR');
      await RPC.disconnect();
      process.exit(1);
    }

    // Instantiate the Krc20Operation class with the provided arguments
    const krc20Operation = new Krc20Operation(privateKeyArg, network, ticker, priorityFee, timeout, logLevel, data);

    // Define a callback to handle completion and disconnection
    const handleCompletion = async () => {
      await RPC.disconnect();
      log('RPC client disconnected.', 'INFO');
      process.exit(0);  // Ensure the process exits cleanly
    };

    // Perform the selected operation
    switch (operation) {
      case 'mint':
        log("Starting mint operation...", 'INFO');
        await krc20Operation.mint(RPC, handleCompletion);
        break;
      case 'deploy':
        log("Starting deploy operation...", 'INFO');
        await krc20Operation.deploy(RPC, handleCompletion);
        break;
      case 'transfer':
        log("Starting transfer operation...", 'INFO');
        await krc20Operation.transfer(RPC, handleCompletion);
        break;
      default:
        log("Error: Invalid operation specified. Use --operation mint, deploy, or transfer.", 'ERROR');
        await RPC.disconnect();
        process.exit(1);
    }
  } catch (error) {
    // Handle unexpected errors and ensure clean disconnection
    log(`Error: ${error.message}`, 'ERROR');
    process.exit(1);
  }
})();
