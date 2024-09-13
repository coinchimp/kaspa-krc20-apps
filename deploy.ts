import { RpcClient, Encoding, Resolver, ScriptBuilder, Opcodes, PrivateKey, addressFromScriptPublicKey, createTransactions, kaspaToSompi, UtxoProcessor, UtxoContext } from "./wasm/kaspa";
import minimist from 'minimist';

// Parse command-line arguments
const args = minimist(process.argv.slice(2));
const privateKeyArg = args.privKey;
const network = args.network || 'testnet-10';
const ticker = args.ticker || 'TCHIMP';
const priorityFeeValue = args.priorityFee || '1.5';
const timeout = args.timeout || 120000; // 2 minutes timeout
const logLevel = args.logLevel || 'INFO';
const max = args.max || '28700000000000000000';
const lim = args.max || '2870000000000';

let addedEventTrxId : any;
let SubmittedtrxId: any;


if (!privateKeyArg) {
  console.error("Please provide a private key using the --privKey flag.");
  process.exit(1);
}

log("Main: starting rpc connection", 'DEBUG');
const RPC = new RpcClient({
  resolver: new Resolver(),
  encoding: Encoding.Borsh,
  networkId: network
});

await RPC.disconnect();
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

// Display info about the used URLs if log level is DEBUG
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

// New UTXO subscription setup (ADD this):
log(`Subscribing to UTXO changes for address: ${address.toString()}`, 'DEBUG');
await RPC.subscribeUtxosChanged([address.toString()]);


RPC.addEventListener('utxos-changed', async (event: any) => {
    log(`UTXO changes detected for address: ${address.toString()}`, 'DEBUG');
    
    // Check for UTXOs removed for the specific address
    const removedEntry = event.data.removed.find((entry: any) => 
        entry.address.payload === address.toString().split(':')[1]
    );
    const addedEntry = event.data.added.find((entry: any) => 
        entry.address.payload === address.toString().split(':')[1]
    );    

    if (removedEntry) {
        // Use custom replacer function in JSON.stringify to handle BigInt
        log(`Added UTXO found for address: ${address.toString()} with UTXO: ${JSON.stringify(addedEntry, (key, value) =>
            typeof value === 'bigint' ? value.toString() + 'n' : value)}`, 'DEBUG');        
        log(`Removed UTXO found for address: ${address.toString()} with UTXO: ${JSON.stringify(removedEntry, (key, value) =>
            typeof value === 'bigint' ? value.toString() + 'n' : value)}`, 'DEBUG');
            addedEventTrxId = addedEntry.outpoint.transactionId;
        log(`Added UTXO TransactionId: ${addedEventTrxId}`,'DEBUG');
        if (addedEventTrxId == SubmittedtrxId){
            eventReceived = true;
        }
    } else {
        log(`No removed UTXO found for address: ${address.toString()} in this UTXO change event`, 'DEBUG');
    }
});




const gasFee = 1000
const data = {"p":"krc-20","op":"deploy","tick": ticker ,"max": max ,"lim": lim}
log(`Main: Data to use for ScriptBuilder: ${JSON.stringify(data)}`, 'DEBUG');

const script = new ScriptBuilder()
  .addData(publicKey.toXOnlyPublicKey().toString())
  .addOp(Opcodes.OpCheckSig)
  .addOp(Opcodes.OpFalse)
  .addOp(Opcodes.OpIf)
  .addData(Buffer.from("kasplex"))
  .addI64(0n)
  .addData(Buffer.from(JSON.stringify(data, null, 0)))
  .addOp(Opcodes.OpEndIf);

const P2SHAddress = addressFromScriptPublicKey(script.createPayToScriptHashScript(), network)!;
let eventReceived = false;

if (logLevel === 'DEBUG') {
  log(`Constructed Script: ${script.toString()}`, 'DEBUG');
  log(`P2SH Address: ${P2SHAddress.toString()}`, 'DEBUG');
}

try {
  const { entries } = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
  const { transactions } = await createTransactions({
    priorityEntries: [],
    entries,
    outputs: [{
      address: P2SHAddress.toString(),
      amount: kaspaToSompi("0.3")!
    }],
    changeAddress: address.toString(),
    priorityFee: kaspaToSompi(priorityFeeValue.toString())!,
    networkId: network
  });

  for (const transaction of transactions) {
    transaction.sign([privateKey]);
    log(`Main: Transaction signed with ID: ${transaction.id}`, 'DEBUG');
    const hash = await transaction.submit(RPC);
    log(`submitted P2SH commit sequence transaction on: ${hash}`, 'INFO');
    SubmittedtrxId = hash;
  }


    // Set a timeout to handle failure cases
    const commitTimeout = setTimeout(() => {
      if (!eventReceived) {
        log('Timeout: Commit transaction did not mature within 2 minutes', 'ERROR');
        process.exit(1);
      }
    }, timeout);

    // Wait until the maturity event has been received
    while (!eventReceived) {
      await new Promise(resolve => setTimeout(resolve, 500)); // wait and check every 500ms
    }

    clearTimeout(commitTimeout);  // Clear the reveal timeout if the event is received
     
} catch (initialError) {
      log(`Initial transaction error: ${initialError}`, 'ERROR');
}

if (eventReceived) {
  eventReceived = false;
  log(`Main: creating UTXO entries from ${address.toString()}`, 'DEBUG');
  const { entries } = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
  log(`Main: creating revealUTXOs from P2SHAddress`, 'DEBUG');
  const revealUTXOs = await RPC.getUtxosByAddresses({ addresses: [P2SHAddress.toString()] });

  log(`Main: Creating Transaction with revealUTX0s entries: ${revealUTXOs.entries[0]}`, 'DEBUG');

  const { transactions } = await createTransactions({
    priorityEntries: [revealUTXOs.entries[0]],
    entries: entries,
    outputs: [],
    changeAddress: address.toString(),
    priorityFee: kaspaToSompi(gasFee.toString())!,
    networkId: network
  });
  let revealHash: any;

  for (const transaction of transactions) {
    transaction.sign([privateKey], false);
    log(`Main: Transaction with revealUTX0s signed with ID: ${transaction.id}`, 'DEBUG');
    const ourOutput = transaction.transaction.inputs.findIndex((input) => input.signatureScript === '');

    if (ourOutput !== -1) {
      const signature = await transaction.createInputSignature(ourOutput, privateKey);
      transaction.fillInput(ourOutput, script.encodePayToScriptHashSignatureScript(signature));
    }
    revealHash = await transaction.submit(RPC);
    log(`submitted reveal tx sequence transaction: ${revealHash}`, 'INFO');
    SubmittedtrxId = revealHash;
  }
    const revealTimeout = setTimeout(() => {
      if (!eventReceived) {
        log('Timeout: Reveal transaction did not mature within 2 minutes', 'ERROR');
        process.exit(1);
      }
    }, timeout);

    // Wait until the maturity event has been received
    while (!eventReceived) {
      await new Promise(resolve => setTimeout(resolve, 500)); // wait and check every 500ms
    }

    clearTimeout(revealTimeout);  // Clear the reveal timeout if the event is received          

    try {
      // Fetch the updated UTXOs
      const updatedUTXOs = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
  
      // Check if the reveal transaction is accepted
      const revealAccepted = updatedUTXOs.entries.some(entry => {
        const transactionId = entry.entry.outpoint ? entry.entry.outpoint.transactionId : undefined;
        return transactionId === revealHash;
      });
  
      // If reveal transaction is accepted
      if (revealAccepted) {
        log(`Reveal transaction has been accepted: ${revealHash}`, 'INFO');
        await RPC.disconnect();
        log('RPC client disconnected.', 'INFO');
      } else if (!eventReceived) { // Check eventReceived here
        log('Reveal transaction has not been accepted yet.', 'INFO');
      }
    } catch (error) {
      log(`Error checking reveal transaction status: ${error}`, 'ERROR');
    }
      
} else {
  log('Error: No UTXOs available for reveal', 'ERROR');
}
    

  