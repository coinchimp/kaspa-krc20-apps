import { RpcClient, ScriptBuilder, Opcodes, PrivateKey, addressFromScriptPublicKey, createTransactions, kaspaToSompi } from "../../wasm/kaspa"; 

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

export class Krc20Operation {
  private privateKey: PrivateKey;
  private publicKey: any;
  private address: any;
  private network: string;
  private ticker: string;
  private priorityFeeValue: string;
  private timeout: number;
  private logLevel: string;

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

  private log(message: string, level: string = 'INFO') {
    const timestamp = new Date().toISOString();
    if (level === 'ERROR') {
      console.error(`[${timestamp}] [${level}] ${message}`);
    } else if (this.logLevel === 'DEBUG' || level === 'INFO') {
      console.log(`[${timestamp}] [${level}] ${message}`);
    }
  }

  private async createTransaction(RPC: RpcClient, scriptData: string, callback: () => void) {
    try {
      const script = new ScriptBuilder()
        .addData(this.publicKey.toXOnlyPublicKey().toString())
        .addOp(Opcodes.OpCheckSig)
        .addOp(Opcodes.OpFalse)
        .addOp(Opcodes.OpIf)
        .addData(Buffer.from("kasplex"))
        .addI64(0n)
        .addData(Buffer.from(scriptData))
        .addOp(Opcodes.OpEndIf);

      const P2SHAddress = addressFromScriptPublicKey(script.createPayToScriptHashScript(), this.network)!;

      if (this.logLevel === 'DEBUG') {
        this.log(`Constructed Script: ${script.toString()}`, 'DEBUG');
        this.log(`P2SH Address: ${P2SHAddress.toString()}`, 'DEBUG');
      }

      const amount = this.getAmountBasedOnOperation();

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

      for (const transaction of transactions) {
        transaction.sign([this.privateKey]);
        this.log(`Transaction signed with ID: ${transaction.id}`, 'DEBUG');
        const hash = await transaction.submit(RPC);
        this.log(`Submitted P2SH commit sequence transaction on: ${hash}`, 'INFO');

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
              this.log(`Reveal transaction signed with ID: ${transaction.id}`, 'DEBUG');
              const ourOutput = transaction.transaction.inputs.findIndex((input) => input.signatureScript === '');

              if (ourOutput !== -1) {
                const signature = await transaction.createInputSignature(ourOutput, this.privateKey);
                transaction.fillInput(ourOutput, script.encodePayToScriptHashSignatureScript(signature));
              }

              const revealHash = await transaction.submit(RPC);
              this.log(`Submitted reveal tx sequence transaction: ${revealHash}`, 'INFO');

              setTimeout(async () => {
                try {
                  const updatedUTXOs = await RPC.getUtxosByAddresses({ addresses: [this.address.toString()] });

                  const revealAccepted = updatedUTXOs.entries.some(entry => {
                    const transactionId = entry.entry.outpoint ? entry.entry.outpoint.transactionId : undefined;
                    return transactionId === revealHash;
                  });

                  if (revealAccepted) {
                    this.log(`Reveal transaction has been accepted: ${revealHash}`, 'INFO');
                    callback();  // Notify that the operation is complete
                  } else {
                    this.log('Reveal transaction has not been accepted yet.', 'INFO');
                    callback();  // Proceed anyway, depending on the requirement
                  }
                } catch (error) {
                  this.log(`Error checking reveal transaction status: ${error}`, 'ERROR');
                  callback();  // Notify that an error occurred
                }
              }, this.timeout + 10000);
            }
          } catch (revealError) {
            this.log(`Reveal transaction error: ${revealError}`, 'ERROR');
            callback();  // Notify that an error occurred
          }
        }, this.timeout);
      }
    } catch (initialError) {
      this.log(`Initial transaction error: ${initialError}`, 'ERROR');
      callback();  // Notify that an error occurred
    }
  }

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

  public async mint(RPC: RpcClient, callback: () => void) {
    this.log("Starting minting process", 'DEBUG');
    await this.createTransaction(RPC, JSON.stringify({ "p": "krc-20", "op": "mint", "tick": this.ticker }), callback);
  }

  public async deploy(RPC: RpcClient, callback: () => void) {
    this.log("Starting deploy process", 'DEBUG');
    const deployData = {
      p: "krc-20",
      op: "deploy",
      tick: this.ticker,
      max: this.data.max,
      limit: this.data.limit,
      pre: this.data.pre
    };
    await this.createTransaction(RPC, JSON.stringify(deployData), callback);
  }

  public async transfer(RPC: RpcClient, callback: () => void) {
    this.log("Starting transfer process", 'DEBUG');
    const transferData = {
      p: "krc-20",
      op: "transfer",
      tick: this.ticker,
      to: this.data.to
    };
    await this.createTransaction(RPC, JSON.stringify(transferData), callback);
  }
}
