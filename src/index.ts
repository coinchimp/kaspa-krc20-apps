import { RpcClient, Resolver, ScriptBuilder, Opcodes, PrivateKey, addressFromScriptPublicKey, createTransactions, kaspaToSompi } from "../wasm/kaspa"
import minimist from 'minimist';
import context from './txMgr'
import trxManager from "./txMgr";

// Parse command-line arguments
const args = minimist(process.argv.slice(2));

const privateKeyArg = args.privKey;
const network = args.network || 'testnet-10';
const logLevel = args.logLevel || 'INFO';

if (!privateKeyArg) {
  console.error("Please provide a private key using the --privKey flag.");
  process.exit(1);
}

log("Main: starting rpc connenction",'DEBUG')
const RPC = new RpcClient({
  resolver: new Resolver(),
  networkId: network
});

await RPC.connect()
log("Main: RPC connection stablished",'DEBUG')

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

log(`Main: Submitting private key`, 'DEBUG')
const privateKey = new PrivateKey(privateKeyArg)
log(`Main: Determining public key`, 'DEBUG')
const publicKey = privateKey.toPublicKey()
log(`Main: Determining wallet address`, 'DEBUG')
const address = publicKey.toAddress(network)
log(`Address: ${address.toString()}`, 'INFO')

const myTxMgr = new trxManager(network, address.toString(), RPC );

try {
  const { entries } = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
  const { transactions } = await createTransactions({
    priorityEntries: [],
    entries,
    outputs: [{
      address: "kaspatest:qz6d5cjcdxmtp86e52kwulzuw2qkye2z5y5rjh2n2unjjqa4jnz3j0vmfsrp6",
      amount: kaspaToSompi("13.333")!
    }],
    changeAddress: address.toString(),
    priorityFee: kaspaToSompi('0')!,
    networkId: network
  });
  for (const transaction of transactions) {
    transaction.sign([privateKey], false);
    log(`Main: Transaction signed with ID: ${transaction.id}`,'DEBUG');
    await transaction.submit(RPC);
    log(`Main: Transaction submitted with ID: ${transaction.id}`,'DEBUG');
    console.log(transaction)
  }
} catch (initialError) {
  log(`Initial transaction error: ${initialError}`, 'ERROR');
}  



//log("Main: RPC to be disconneted",'DEBUG')
//await RPC.disconnect();