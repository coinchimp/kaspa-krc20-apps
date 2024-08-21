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
  limit,
  pre,
} = args;

function log(message: string, level: string = 'INFO') {
  const timestamp = new Date().toISOString();
  if (level === 'ERROR') {
    console.error(`[${timestamp}] [${level}] ${message}`);
  } else if (logLevel === 'DEBUG' || level === 'INFO') {
    console.log(`[${timestamp}] [${level}] ${message}`);
  }
}

// Validate essential arguments
if (!privateKeyArg) {
  log("Please provide a private key using the --privKey flag.", 'ERROR');
  process.exit(1);
}

// Define operation-specific requirements
const operationRequirements = {
  'transfer': !destination,
  'deploy': !max || !limit,
};

if (operationRequirements[operation]) {
  log(`KRC20 ${operation} operation requires ${operation === 'transfer' ? 'destination wallet' : 'max and limit values'}.`, 'ERROR');
  process.exit(1);
}

// Construct the data object based on operation type
const data: KRC20OperationData = {
  p: "krc-20",
  op: operation as 'mint' | 'deploy' | 'transfer',
  tick: ticker,
  to: destination,
  max: operation === 'deploy' ? max : undefined,
  limit: operation === 'deploy' ? limit : undefined,
  pre: operation === 'deploy' ? pre : undefined,
};

// Start the main process
log("Main: Starting RPC connection", 'DEBUG');
const RPC = new RpcClient({
  resolver: new Resolver(),
  encoding: Encoding.Borsh,
  networkId: network
});

(async () => {
  await RPC.disconnect();
  await RPC.connect();
  log("Main: RPC connection established", 'DEBUG');

  // Check server status
  const serverInfo = await RPC.getServerInfo();
  if (!serverInfo.isSynced || !serverInfo.hasUtxoIndex) {
    log('Provided node is either not synchronized or lacks the UTXO index.', 'ERROR');
    process.exit(1);
  }

  // Create an instance of the Krc20Operation class
  const krc20Operation = new Krc20Operation(privateKeyArg, network, ticker, priorityFee, timeout, logLevel, data);

  const handleCompletion = () => {
    RPC.disconnect().then(() => {
      log('Main: RPC client disconnected.', 'INFO');
      process.exit(0);  // Ensure the process exits once disconnected
    });
  };

  try {
    // Perform the selected operation
    switch (operation) {
      case 'mint':
        await krc20Operation.mint(RPC, handleCompletion);
        break;
      case 'deploy':
        await krc20Operation.deploy(RPC, handleCompletion);
        break;
      case 'transfer':
        await krc20Operation.transfer(RPC, handleCompletion);
        break;
      default:
        log("Invalid operation specified.", 'ERROR');
        process.exit(1);
    }
  } catch (error) {
    log(`Error during KRC20 operation: ${error.message}`, 'ERROR');
    handleCompletion();
  }
})();


