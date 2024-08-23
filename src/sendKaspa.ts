import { RpcClient, Encoding , Resolver, PrivateKey } from "../wasm/kaspa-dev";
import minimist from 'minimist';
import TransactionSender from './TransactionSender';


// Display usage information
const displayHelp = () => {
  console.log(`
Usage: kaspa-transfer --privKey <privateKey> --destination <address> --amount <amount> [options]

Options:
  --privKey       Your private key to sign the transaction.
  --destination   The destination address to which funds will be sent.
  --amount        The amount to transfer.
  --network       The network to connect to (default: 'testnet-10').
  --logLevel      Log level ('DEBUG', 'INFO', default: 'INFO').
  --help          Display this help message.
`);
};

const args = minimist(process.argv.slice(2));

if (args.help) {
  displayHelp();
  process.exit(0);
}

// Extract and validate command-line arguments
const privateKeyArg = args.privKey;
const destination = args.destination;
const amount = String(args.amount);
const network = args.network || 'testnet-10';
const logLevel = args.logLevel || 'INFO';

if (!privateKeyArg) {
  console.error("ERROR: Please provide a private key using the --privKey flag.");
  displayHelp();
  process.exit(1);
}

if (!destination) {
  console.error("ERROR: Please provide a destination address using the --destination flag.");
  displayHelp();
  process.exit(1);
}

if (!amount) {
  console.error("ERROR: Please provide an amount to send using the --amount flag.");
  displayHelp();
  process.exit(1);
}

// Logger function for consistent logging with adjustable log level
const log = (message: string, level: string = 'INFO') => {
  if (logLevel === 'DEBUG' || level !== 'DEBUG') {
    console.log(`[${level}] ${message}`);
  }
};

log(`Main: amount is ${amount}`,'DEBUG')

log("Main: starting RPC connection", 'DEBUG');
const RPC = new RpcClient({
  resolver: new Resolver(),
  encoding: Encoding.Borsh,
  networkId: network
});

await RPC.connect();

const serverInfo = await RPC.getServerInfo();
if (!serverInfo.isSynced || !serverInfo.hasUtxoIndex) {
  throw Error('Provided node is either not synchronized or lacks the UTXO index.');
}

log("Main: RPC connection established", 'DEBUG');
const privateKey = new PrivateKey(privateKeyArg);
log("Main: Private Key defined into privateKey", 'DEBUG');


try {

  log("Main: Creating a new transactionSender", 'DEBUG');
  const transactionSender = new TransactionSender(network, privateKey, RPC);
  await new Promise(resolve => setTimeout(resolve, 1000));
  log("Main: Transfering Funds", 'DEBUG');
  const transactionId = transactionSender.transferFunds(destination, amount);

  console.log(`Final Transaction ID: `, transactionId);
} catch (error) {
  console.error(`Error in main function: ${error.message}`);
}

await new Promise(resolve => setTimeout(resolve, 5000));
await RPC.disconnect(); 
log("Main: RPC connection closed", 'DEBUG');

