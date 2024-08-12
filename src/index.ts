import { RpcClient, Resolver, ICreateTransactions, Opcodes, PrivateKey, addressFromScriptPublicKey, createTransactions, kaspaToSompi, sompiToKaspaStringWithSuffix } from "../wasm/kaspa";
import minimist from 'minimist';
import context from './txMgr';
import trxManager from "./txMgr";
import readline from 'readline';

// Parse command-line arguments
const args = minimist(process.argv.slice(2));

const privateKeyArg = args.privKey;
const network = args.network || 'testnet-10';
const logLevel = args.logLevel || 'INFO';
//let transactions: Promise<ICreateTransactions>;

if (!privateKeyArg) {
  console.error("Please provide a private key using the --privKey flag.");
  process.exit(1);
}

log("Main: starting RPC connection", 'DEBUG');
const RPC = new RpcClient({
  resolver: new Resolver(),
  networkId: network
});

await RPC.connect();
log("Main: RPC connection established", 'DEBUG');

function log(message: string, level: string = 'INFO') {
  const timestamp = new Date().toISOString();
  if (level === 'ERROR') {
    console.error(`[${timestamp}] [${level}] ${message}`);
  } else if (logLevel === 'DEBUG' || level === 'INFO') {
    console.log(`[${timestamp}] [${level}] ${message}`);
  }
}

function printResolverUrls(rpcClient: RpcClient) {
  const resolver = rpcClient.resolver;
  if (resolver && resolver.urls) {
    log("Resolver URLs:", 'DEBUG');
    resolver.urls.forEach((url: string) => {
      log(url, 'DEBUG');
    });
  } else {
    log("No URLs found in the Resolver.", 'DEBUG');
  }
}

if (logLevel === 'DEBUG') {
  printResolverUrls(RPC);
}

log(`Main: Submitting private key`, 'DEBUG');
const privateKey = new PrivateKey(privateKeyArg);
log(`Main: Determining public key`, 'DEBUG');
const publicKey = privateKey.toPublicKey();
log(`Main: Determining wallet address`, 'DEBUG');
const address = publicKey.toAddress(network);
log(`Address: ${address.toString()}`, 'INFO');

const myTxMgr = new trxManager(network, address.toString(), RPC );

// Function to process transactions
async function processTransaction(amount: string, destination: string) {
  try {
    const { entries } = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
    const { transactions } = await createTransactions({
      priorityEntries: [],
      entries,
      outputs: [{
        address: destination,
        amount: kaspaToSompi(amount)!
      }],
      changeAddress: address.toString(),
      priorityFee: kaspaToSompi('0')!,
      networkId: network
    });
    for (const transaction of transactions) {
      transaction.sign([privateKey], false);
      log(`Main: Transaction signed with ID: ${transaction.id}`, 'DEBUG');
      await transaction.submit(RPC);
      log(`Main: Transaction submitted with ID: ${transaction.id}`, 'DEBUG');

    }
  } catch (error) {
    log(`Transaction error: ${error}`, 'ERROR');
  }
}

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for transaction details
function promptForTransaction() {
  rl.question('Enter the amount to transfer (e.g., "13.333"): ', (amount) => {
    rl.question('Enter the destination wallet address: ', (destination) => {
      processTransaction(amount, destination);
    });
  });
}

// Listen for balance updates and prompt for transactions
myTxMgr.on('balance', () => {
  log(`Updated balance: ${sompiToKaspaStringWithSuffix(BigInt(myTxMgr.context.balance?.mature?.toString() || "0"), network)}`, 'INFO');
  promptForTransaction();
});

// Start the balance tracking and prompt the user for the first transaction
promptForTransaction();
