import { RpcClient, ScriptBuilder, Opcodes, PrivateKey, addressFromScriptPublicKey, createTransactions, kaspaToSompi } from "../../wasm/kaspa"; 

// Interface defining the structure of the KRC20 operation data
export interface KRC20OperationData {
  p: "krc-20";
  op: 'mint' | 'deploy' | 'transfer';
  tick: string;
  to?: string;
  amt?: string;
  max?: string;
  limit?: string;
  dec?: "8";
  pre?: string;
}

// Class to handle KRC20 operations such as minting, deploying, and transferring
export class Krc20Operation {
  private privateKey: PrivateKey;
  private publicKey: any;
  private address: any;
  private network: string;
  private ticker: string;
  private priorityFeeValue: string;
  private timeout: number;
  private logLevel: string;

  // Constructor to initialize the class with required parameters
  constructor(privateKey: string, network: string, ticker: string, priorityFeeValue: string, timeout: number, logLevel: string = 'INFO', private data: KRC20OperationData) {
    this.privateKey = new PrivateKey(privateKey);
    this.network = network;
    this.publicKey = this.privateKey.toPublicKey();
    this.address = this.publicKey.toAddress(network);
    this.ticker = ticker;
    this.priorityFeeValue = priorityFeeValue;
    this.timeout = timeout;
    this.logLevel = logLevel;
  }

  // Helper function to log messages with different levels (INFO, DEBUG, ERROR)
  private log(message: string, level: string = 'INFO') {
    const timestamp = new Date().toISOString();
    if (level === 'ERROR') {
      console.error(`[${timestamp}] [${level}] ${message}`);
    } else if (this.logLevel === 'DEBUG' || level === 'INFO') {
      console.log(`[${timestamp}] [${level}] ${message}`);
    }
  }

  // Method to create and submit a transaction based on the provided script data
  private async createTransaction(RPC: RpcClient, scriptData: string, callback: () => void) {
    try {
      // Build the script for the transaction
      const script = new ScriptBuilder()
        .addData(this.publicKey.toXOnlyPublicKey().toString())
        .addOp(Opcodes.OpCheckSig)
        .addOp(Opcodes.OpFalse)
        .addOp(Opcodes.OpIf)
        .addData(Buffer.from("kasplex"))
        .addI64(0n)
        .addData(Buffer.from(scriptData))
        .addOp(Opcodes.OpEndIf);

      // Generate the P2SH address from the script
      const P2SHAddress = addressFromScriptPublicKey(script.createPayToScriptHashScript(), this.network)!;

      // Log the script and P2SH address if in DEBUG mode
      if (this.logLevel === 'DEBUG') {
        this.log(`DEBUG: Constructed Script: ${script.toString()}`, 'DEBUG');
        this.log(`DEBUG: P2SH Address: ${P2SHAddress.toString()}`, 'DEBUG');
      }

      // Determine the amount of KASPA based on the operation type
      const amount = this.getAmountBasedOnOperation();
      this.log(`DEBUG: Amount for operation (${this.data.op}): ${amount} KASPA`, 'DEBUG');

      // Fetch UTXOs and create transactions
      const { entries } = await RPC.getUtxosByAddresses({ addresses: [this.address.toString()] });
      const { transactions } = await createTransactions({
        priorityEntries: [],
        entries,
        outputs: [{
          address: P2SHAddress.toString(),
          amount: kaspaToSompi(amount)! // Dynamically set amount
        }],
        changeAddress: this.address.toString(),
        priorityFee: kaspaToSompi(this.priorityFeeValue)!,
        networkId: this.network
      });

      // Sign and submit each transaction
      for (const transaction of transactions) {
        transaction.sign([this.privateKey]);
        this.log(`DEBUG: Transaction signed with ID: ${transaction.id}`, 'DEBUG');
        const hash = await transaction.submit(RPC);
        this.log(`INFO: Submitted P2SH commit sequence transaction on: ${hash}`, 'INFO');

        // Handle the reveal transaction after a timeout
        setTimeout(async () => {
          try {
            const revealUTXOs = await RPC.getUtxosByAddresses({ addresses: [P2SHAddress.toString()] });

            const revealTransaction = await createTransactions({
              priorityEntries: [revealUTXOs.entries[0]],
              entries,
              outputs: [],
              changeAddress: this.address.toString(),
              priorityFee: kaspaToSompi("0.1")!,
              networkId: this.network
            });

            for (const transaction of revealTransaction.transactions) {
              transaction.sign([this.privateKey], false);
              this.log(`DEBUG: Reveal transaction signed with ID: ${transaction.id}`, 'DEBUG');
              const ourOutput = transaction.transaction.inputs.findIndex((input) => input.signatureScript === '');

              if (ourOutput !== -1) {
                const signature = await transaction.createInputSignature(ourOutput, this.privateKey);
                transaction.fillInput(ourOutput, script.encodePayToScriptHashSignatureScript(signature));
              }

              const revealHash = await transaction.submit(RPC);
              this.log(`INFO: Submitted reveal tx sequence transaction: ${revealHash}`, 'INFO');

              setTimeout(async () => {
                try {
                  const updatedUTXOs = await RPC.getUtxosByAddresses({ addresses: [this.address.toString()] });

                  const revealAccepted = updatedUTXOs.entries.some(entry => {
                    const transactionId = entry.entry.outpoint ? entry.entry.outpoint.transactionId : undefined;
                    return transactionId === revealHash;
                  });

                  if (revealAccepted) {
                    this.log(`INFO: Reveal transaction has been accepted: ${revealHash}`, 'INFO');
                    callback();  // Notify that the operation is complete
                  } else {
                    this.log('INFO: Reveal transaction has not been accepted yet.', 'INFO');
                    callback();  // Proceed anyway, depending on the requirement
                  }
                } catch (error) {
                  this.log(`ERROR: Error checking reveal transaction status: ${error}`, 'ERROR');
                  callback();  // Notify that an error occurred
                }
              }, this.timeout + 10000); // Increased timeout to ensure process completion
            }
          } catch (revealError) {
            this.log(`ERROR: Reveal transaction error: ${revealError}`, 'ERROR');
            callback();  // Notify that an error occurred
          }
        }, this.timeout);
      }
    } catch (initialError) {
      this.log(`ERROR: Initial transaction error: ${initialError}`, 'ERROR');
      callback();  // Notify that an error occurred
    }
  }

  // Helper function to determine the KASPA amount based on the operation type
  private getAmountBasedOnOperation(): string {
    switch (this.data.op) {
      case 'deploy':
        return "1000";
      case 'mint':
        return "1";
      case 'transfer':
        return "0";
      default:
        return "1";  // Default to "1" if the operation is unknown
    }
  }

  // Public method to handle minting operations
  public async mint(RPC: RpcClient, callback: () => void) {
    this.log("DEBUG: Starting minting process", 'DEBUG');
    await this.createTransaction(RPC, JSON.stringify({ "p": "krc-20", "op": "mint", "tick": this.ticker }), callback);
  }

  // Public method to handle deployment operations
  public async deploy(RPC: RpcClient, callback: () => void) {
    this.log("DEBUG: Starting deploy process", 'DEBUG');
    const deployData = {
      p: "krc-20",
      op: "deploy",
      tick: this.ticker,
      max: this.data.max,
      limit: this.data.limit,
      pre: this.data.pre
    };
    this.log(`DEBUG: Deploy data: ${JSON.stringify(deployData)}`, 'DEBUG');
    await this.createTransaction(RPC, JSON.stringify(deployData), callback);
  }

  // Public method to handle transfer operations
  public async transfer(RPC: RpcClient, callback: () => void) {
    this.log("DEBUG: Starting transfer process", 'DEBUG');
    const transferData = {
      p: "krc-20",
      op: "transfer",
      tick: this.ticker,
      to: this.data.to
    };
    this.log(`DEBUG: Transfer data: ${JSON.stringify(transferData)}`, 'DEBUG');
    await this.createTransaction(RPC, JSON.stringify(transferData), callback);
  }
}
