import { RpcClient, IGetBalanceByAddressRequest } from "../../wasm/kaspa";

class BalanceChecker {
  private address: string;
  private rpcClient: RpcClient;
  private network: string;

  constructor(address: string, rpcClient: RpcClient, network: string = 'testnet-11') {
    this.address = address;
    this.rpcClient = rpcClient;
    this.network = network;
  }

  // Method to get the balance of the address
  public async getBalance(): Promise<string> {
    const balanceRequest: IGetBalanceByAddressRequest = {
      address: this.address,
    };

    try {
      const balance = await this.rpcClient.getBalanceByAddress(balanceRequest);
      return String(balance);
    } catch (error) {
      console.error(`Error fetching balance: ${error.message}`);
      throw error;
    }
  }
}


