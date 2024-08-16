import { RpcClient, PrivateKey, createTransactions, PendingTransaction , kaspaToSompi, UtxoProcessor, UtxoContext, sompiToKaspaStringWithSuffix } from "../../wasm/kaspa";
import { EventEmitter } from 'events';

class TransactionSender extends EventEmitter {
  private rpcClient: RpcClient;
  private privateKey: PrivateKey;
  private amount: string;
  private destination: string;
  private network: string;
  private processor: UtxoProcessor;
  private context: UtxoContext;  

  constructor(rpcClient: RpcClient, privateKey: PrivateKey, amount: string, destination: string, network: string = 'testnet-11') {
    super();
    this.privateKey = privateKey;
    this.amount = amount;
    this.destination = destination;
    this.network = network;
    this.processor = new UtxoProcessor({ rpc: rpcClient, networkId: network });
    this.rpcClient = this.processor.rpc;
    this.context = new UtxoContext({ processor: this.processor });
    this.registerProcessor(privateKey);
  }

  // Method to create and send the transaction
  public async sendTransaction(): Promise<string> {
    try {
      // Get the address associated with the private key
      const address = this.privateKey.toPublicKey().toAddress(this.network).toString();
      
      // Fetch current balance
      const initialBalanceSompi = BigInt(this.context.balance?.mature?.toString() || "0");
      console.log(`Initial balance for address ${address}: ${sompiToKaspaStringWithSuffix(initialBalanceSompi, this.network)}`);

      // Get UTXOs for the address
      const { entries } = await this.rpcClient.getUtxosByAddresses({ addresses: [address] });
      console.log(`UTXOs fetched for address ${address}:`, entries);

      // Create the transaction
      const { transactions } = await createTransactions({
        priorityEntries: [],
        entries,
        outputs: [{
          address: this.destination,
          amount: kaspaToSompi(this.amount)!
        }],
        changeAddress: address,
        priorityFee: kaspaToSompi('0')!,
        networkId: this.network
      });

      // Sign and submit the transaction
      let finalTransactionId: string = '';
      for (const transaction of transactions) {
        transaction.sign([this.privateKey], false);
        console.log(`Transaction signed with ID: ${transaction.id}`);
        await transaction.submit(this.rpcClient);
        console.log(`Transaction submitted with ID: ${transaction.id}`);
        finalTransactionId = transaction.id;
      }

      // Start balance tracking until it reaches the expected balance
      this.trackBalanceChange(initialBalanceSompi,transactions[0]);

      return finalTransactionId;
    } catch (error) {
      console.error(`Transaction error: ${error}`);
      throw error;
    }
  }

  private registerProcessor(privateKey: PrivateKey) {
    const publicKey = privateKey.toPublicKey();

    this.processor.addEventListener("utxo-proc-start", async () => {
      await this.context.clear();
      await this.context.trackAddresses([publicKey.toAddress(this.network).toString()]);
    });

    this.processor.addEventListener('balance', () => {
      const currentBalance = BigInt(this.context.balance?.mature?.toString() || "0");
      console.log("Balance event in processor:", sompiToKaspaStringWithSuffix(currentBalance, this.network));
      this.emit('balance', currentBalance);
    });

    this.processor.start();
  }

  private trackBalanceChange(initialBalance: bigint, transaction: PendingTransaction) {
    const estimatedBalance = initialBalance - kaspaToSompi(this.amount)! - transaction.feeAmount;
  
    this.on('balance', (currentBalance: bigint) => {
      const lowerBound = estimatedBalance - (estimatedBalance / BigInt(100)); // 1% lower bound
      const upperBound = estimatedBalance + (estimatedBalance / BigInt(100)); // 1% upper bound
  
      if (currentBalance >= lowerBound && currentBalance <= upperBound) {
        console.log(`Balance updated to expected amount after transaction. Final balance: ${sompiToKaspaStringWithSuffix(currentBalance, this.network)}`);
        this.removeAllListeners('balance'); // Stop tracking once the expected balance is reached
      }
    });
  }
}

/*
// Example usage
(async () => {


  const privateKey = new PrivateKey('your_private_key_here');
  const amount = '13.333';
  const destination = 'destination_address_here';

  const transactionSender = new TransactionSender(rpcClient, privateKey, amount, destination);
  const transactionId = await transactionSender.sendTransaction();
  console.log(`Final Transaction ID: ${transactionId}`);
})();
*/
