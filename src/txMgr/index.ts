import { EventEmitter } from 'events'
import { sompiToKaspaStringWithSuffix, type IPaymentOutput, createTransactions, PrivateKey, UtxoProcessor, UtxoContext, type RpcClient } from "../../wasm/kaspa";

export default class trxManager extends EventEmitter {
  private network: string;
  private address: string;
  private processor: UtxoProcessor;
  context: UtxoContext;


  constructor(networkId: string, address: string, rpc: RpcClient) {
    super()
    this.network = networkId,
    this.address = address;
    this.processor = new UtxoProcessor({ rpc, networkId });
    this.context = new UtxoContext({ processor: this.processor });
    this.registerProcessor()
  }

  private registerProcessor () {
    this.processor.addEventListener("utxo-proc-start", async () => {
      await this.context.clear()
      await this.context.trackAddresses([ this.address ])
    })

    this.processor.addEventListener('balance', () => {
      console.log("balance: ",sompiToKaspaStringWithSuffix(BigInt(this.context.balance?.mature?.toString() || "0"), this.network))
    })
    this.processor.start()
  } 
}  