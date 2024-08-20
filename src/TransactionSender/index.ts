import { EventEmitter } from 'events'
import { kaspaToSompi, type IPaymentOutput, createTransactions, PrivateKey, UtxoProcessor, UtxoContext, type RpcClient } from "../../wasm/kaspa-dev";


export default class TransactionSender extends EventEmitter {
  private networkId: string;
  private privateKey: PrivateKey;
  private address: string;
  private processor: UtxoProcessor;
  private context: UtxoContext;
  private rpc: RpcClient;



  constructor(networkId: string, privKey: PrivateKey, rpc: RpcClient) {
    super()
    this.networkId = networkId;
    this.privateKey = privKey;
    this.address = this.privateKey.toAddress(networkId).toString();
    this.processor = new UtxoProcessor({ rpc, networkId });
    this.rpc = this.processor.rpc
    this.context = new UtxoContext({ processor: this.processor });
    this.registerProcessor()
  }

  async transferFunds(address, amount) {

    console.log(`TrxManager: Crearting Transaction`)
    let payments: IPaymentOutput[] = [{
      address: address,
      amount: kaspaToSompi(amount)!
    }];

    const transactionId = await this.send(payments);
    console.log(`TrxManager: Sent payments. Transaction ID: ${transactionId}`);

    return transactionId;

  }

  async send(outputs: IPaymentOutput[]) {
    console.log(outputs);
    console.log(`TrxManager: Context to be used: ${this.context}`);
    
    const { transactions, summary } = await createTransactions({
      entries: this.context,
      outputs,
      changeAddress: this.address,
      priorityFee: 0n
    });
    console.log(`TrxManager: Transaction Length: ${transactions.length}`)
    // Handle the first transaction immediately
    if (transactions.length > 0) {
      const firstTransaction = transactions[0];
      console.log(`TrxManager: Payment with transaction ID: ${firstTransaction.id} to be signed and submitted`);
      
      firstTransaction.sign([this.privateKey]);
      firstTransaction.submit(this.rpc);
      await new Promise<void>((resolve) => {
        this.once('maturity', () => {
          console.log(`TrxManager: Payment with transaction ID: ${firstTransaction.id} submitted`);
          resolve();
        });
      });
    }
  
    // Handle the remaining transactions, waiting for the `time-to-submit` event
    for (let i = 1; i < transactions.length; i++) {
      const transaction = transactions[i];
      console.log(`TrxManager: Payment with transaction ID: ${transaction.id} to be signed`);
      transaction.sign([this.privateKey]);
      transaction.submit(this.rpc);
      await new Promise<void>((resolve) => {
        this.once('maturity', () => {
          console.log(`TrxManager: Payment with transaction ID: ${transaction.id} submitted`);
          resolve();
        });
      });
    }
  
    return summary.finalTransactionId;
  }
  


  private registerProcessor () {
    this.processor.addEventListener("utxo-proc-start", async () => {
      console.log(`TrxManager: registerProcessor - this.context.clear()`);
      await this.context.clear()
      console.log(`TrxManager: registerProcessor - tracking pool address`);
      await this.context.trackAddresses([ this.address ])
    })

    this.processor.addEventListener('maturity', () => {
      //if (DEBUG) this.monitoring.debug(`TrxManager: maturity event`)
      this.emit('maturity') 
    })

    this.processor.start()
  }  

}