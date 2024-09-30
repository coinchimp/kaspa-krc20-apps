import { RpcClient, Encoding, Resolver, ScriptBuilder, Opcodes, PrivateKey, addressFromScriptPublicKey, createTransactions, kaspaToSompi, UtxoProcessor, UtxoContext } from "./wasm/kaspa";
import minimist from 'minimist';

// Parse command-line arguments
const args = minimist(process.argv.slice(2));
const privateKeyArg = args.privKey;
const network = args.network || 'testnet-10';
const ticker = args.ticker || 'TCHIMP';
const priorityFeeValue = args.priorityFee || '0';
const timeout = args.timeout || 300000; // 5 minutes timeout
const logLevel = args.logLevel || 'INFO';
const loops = args.loops || 1; 

let addedEventTrxId : any;
let SubmittedtrxId: any;


if (!privateKeyArg) {
  console.error("Please provide a private key using the --privKey flag.");
  process.exit(1);
}

log("Main: starting rpc connection", 'DEBUG');
const RPC = new RpcClient({
  url: 'ws://127.0.0.1:17210',
  //resolver: new Resolver(),
  //encoding: Encoding.Borsh,
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




const gasFee = 1
const data = { "p": "krc-20", "op": "mint", "tick": ticker };
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

for (let i = 0; i < loops; i++) {
    log(`Starting loop iteration ${i + 1} of ${loops}`, 'INFO');
  
    try {
      const { entries } = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
      const { transactions } = await createTransactions({
        priorityEntries: [],
        entries,
        outputs: [{
          address: P2SHAddress.toString(),
          amount: kaspaToSompi("0.2")!
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
  
      // Wait for the maturity event
      const commitTimeout = setTimeout(() => {
        if (!eventReceived) {
          log('Timeout: Commit transaction did not mature within 2 minutes', 'ERROR');
          process.exit(1);
        }
      }, timeout);
  
      while (!eventReceived) {
        await new Promise(resolve => setTimeout(resolve, 500)); // wait and check every 500ms
      }
  
      clearTimeout(commitTimeout);
  
      // Continue with reveal transaction after maturity event
      eventReceived = false;
      log(`Main: creating UTXO entries from ${address.toString()}`, 'DEBUG');
      const { entries: newEntries } = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
      log(`Main: creating revealUTXOs from P2SHAddress`, 'DEBUG');
      const revealUTXOs = await RPC.getUtxosByAddresses({ addresses: [P2SHAddress.toString()] });
  
      log(`Main: Creating Transaction with revealUTX0s entries: ${revealUTXOs.entries[0]}`, 'DEBUG');
  
      const { transactions: revealTransactions } = await createTransactions({
        priorityEntries: [revealUTXOs.entries[0]],
        entries: newEntries,
        outputs: [],
        changeAddress: address.toString(),
        priorityFee: kaspaToSompi(gasFee.toString())!,
        networkId: network
      });
      let revealHash: any;
  
      for (const transaction of revealTransactions) {
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
  
      while (!eventReceived) {
        await new Promise(resolve => setTimeout(resolve, 500)); // wait and check every 500ms
      }
  
      clearTimeout(revealTimeout);
      eventReceived = false;
  
      // Check if the reveal transaction has been accepted
      const updatedUTXOs = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
      const revealAccepted = updatedUTXOs.entries.some(entry => {
        const transactionId = entry.entry.outpoint ? entry.entry.outpoint.transactionId : undefined;
        return transactionId === revealHash;
      });
  
      if (revealAccepted) {
        log(`Reveal transaction has been accepted: ${revealHash}`, 'INFO');
        // Only disconnect after completing all loops
        if (i === loops - 1) {
          await RPC.disconnect();
          log('RPC client disconnected.', 'INFO');
        }
      } else if (!eventReceived) {
        log('Reveal transaction has not been accepted yet.', 'INFO');
      }
  
    } catch (initialError) {
      log(`Initial transaction error: ${initialError}`, 'ERROR');
    }
  }