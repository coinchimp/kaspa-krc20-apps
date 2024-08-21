import { RpcClient, Encoding , Resolver, PrivateKey } from "../wasm/kaspa-dev";
import minimist from 'minimist';
import TransactionSender from './TransactionSender';

// Parse command-line arguments
const args = minimist(process.argv.slice(2));

const privateKeyArg = args.privKey;
const destination = args.destination;
const amount = String(args.amount);
const network = args.network || 'testnet-11';
const logLevel = args.logLevel || 'INFO';

if (!privateKeyArg) {
  console.error("Please provide a private key using the --privKey flag.");
  process.exit(1);
}

if (!destination) {
  console.error("Please provide a destination address using the --destination flag.");
  process.exit(1);
}

if (!amount) {
  console.error("Please provide an amount to send using the --amount flag.");
  process.exit(1);
}



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
  const transactionId = transactionSender.transferFunds(privateKey.toPublicKey().toAddress(network).toString(), amount);

  console.log(`Final Transaction ID: `, transactionId);
} catch (error) {
  console.error(`Error in main function: ${error.message}`);
}

await new Promise(resolve => setTimeout(resolve, 5000));
await RPC.disconnect(); 
log("Main: RPC connection closed", 'DEBUG');

