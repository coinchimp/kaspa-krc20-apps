import { RpcClient, Resolver, ScriptBuilder, Opcodes, PrivateKey, addressFromScriptPublicKey, createTransactions, kaspaToSompi } from "./wasm/kaspa"
import minimist from 'minimist';

// Parse command-line arguments
const args = minimist(process.argv.slice(2));

const privateKeyArg = args.privKey;
const ticker = args.ticker || "TNACHO";
const priorityFeeValue = args.priorityFee || "0.1";
const timeout = args.timeout || 20000;
const logLevel = args.logLevel || 'INFO';

if (!privateKeyArg) {
  console.error("Please provide a private key using the --privKey flag.");
  process.exit(1);
}

const RPC = new RpcClient({
  resolver: new Resolver(),
  networkId: 'testnet-11'
});

await RPC.connect()

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

const privateKey = new PrivateKey(privateKeyArg)
const publicKey = privateKey.toPublicKey()
const address = publicKey.toAddress('testnet-11')
log(`Address: ${address.toString()}`, 'INFO');

const data = { "p": "krc-20", "op": "mint", "tick": ticker }

const script = new ScriptBuilder()
  .addData(publicKey.toXOnlyPublicKey().toString())
  .addOp(Opcodes.OpCheckSig)
  .addOp(Opcodes.OpFalse)
  .addOp(Opcodes.OpIf)
  .addData(Buffer.from("kasplex"))
  .addI64(0n)
  .addData(Buffer.from(JSON.stringify(data, null, 0)))
  .addOp(Opcodes.OpEndIf)

const P2SHAddress = addressFromScriptPublicKey(script.createPayToScriptHashScript(), 'testnet-11')!

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
      amount: kaspaToSompi("1")!
    }],
    changeAddress: address.toString(),
    priorityFee: kaspaToSompi(priorityFeeValue)!,
    networkId: 'testnet-11'
  });

  for (const transaction of transactions) {
    transaction.sign([privateKey]);
    const hash = await transaction.submit(RPC);
    log(`submitted P2SH commit sequence transaction on: ${hash}`, 'INFO');

    setTimeout(async () => {
      try {
        const { entries } = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
        const revealUTXOs = await RPC.getUtxosByAddresses({ addresses: [P2SHAddress.toString()] });
    
        const { transactions } = await createTransactions({
          priorityEntries: [revealUTXOs.entries[0]],
          entries,
          outputs: [],
          changeAddress: address.toString(),
          priorityFee: kaspaToSompi("0.1")!,
          networkId: 'testnet-11'
        });
    
        for (const transaction of transactions) {
          transaction.sign([privateKey], false);
    
          const ourOutput = transaction.transaction.inputs.findIndex((input) => input.signatureScript === '');
    
          if (ourOutput !== -1) {
            const signature = transaction.signInput(ourOutput, privateKey);
            transaction.fillInput(ourOutput, script.encodePayToScriptHashSignatureScript(signature));
          }
    
          const revealHash = await transaction.submit(RPC);
          log(`submitted reveal tx sequence transaction: ${revealHash}`, 'INFO');
    
          setTimeout(async () => {
            try {
              const updatedUTXOs = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
    
              // Check if revealHash exists in any transaction in the updated UTXOs
              const revealAccepted = updatedUTXOs.entries.some(entry => {
                const transactionId = entry.entry.outpoint ? entry.entry.outpoint.transactionId : undefined;
    
                return transactionId === revealHash;
              });
    
              if (revealAccepted) {
                log(`Reveal transaction has been accepted: ${revealHash}`, 'INFO');
    
                // Disconnect the RPC client
                await RPC.disconnect();
                log('RPC client disconnected.', 'INFO');
              } else {
                log('Reveal transaction has not been accepted yet.', 'INFO');
              }
            } catch (error) {
              log(`Error checking reveal transaction status: ${error}`, 'ERROR');
            }
          }, timeout); // Check after specified timeout
        }
      } catch (revealError) {
        log(`Reveal transaction error: ${revealError}`, 'ERROR');
      }
    }, timeout); // Wait for specified timeout before attempting to reveal
    
  }
} catch (initialError) {
  log(`Initial transaction error: ${initialError}`, 'ERROR');
}
