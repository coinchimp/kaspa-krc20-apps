import * as bip39 from 'bip39';
import { randomBytes } from 'crypto';
import { BIP32Factory, BIP32Interface } from 'bip32';
import * as ecc from 'tiny-secp256k1'; // Secp256k1 library for elliptic curve operations
import { PrivateKey } from '../../wasm/kaspa';

// Initialize BIP32 with the secp256k1 library
const bip32 = BIP32Factory(ecc);

class WalletGenerator {
  private network: string;

  constructor(network: string = 'mainnet') {
    this.network = network;
  }

  // Generate a 24-word mnemonic phrase
  public async generateMnemonic(): Promise<string> {
    const entropy = randomBytes(32);
    const mnemonic = bip39.entropyToMnemonic(entropy.toString('hex'));
    return mnemonic;
  }

  // Generate a private key from a mnemonic
  public async generatePrivateKey(mnemonic: string): Promise<string> {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    const seed = await bip39.mnemonicToSeed(mnemonic);
    const rootNode: BIP32Interface = bip32.fromSeed(seed);
    const accountNode = rootNode.derivePath("m/44'/0'/0'/0/0"); 

    return accountNode.privateKey.toString('hex');
  }

  // Generate a wallet address from a private key
  public generateAddress(privateKey: string): string {
    const kaspaPrivateKey = new PrivateKey(privateKey);
    const publicKey = kaspaPrivateKey.toPublicKey();
    const address = publicKey.toAddress(this.network);
    return address.toString();
  }

  // Generate the mnemonic, private key, and address all at once
  public async generateWallet(): Promise<{ mnemonic: string; privateKey: string; address: string }> {
    const mnemonic = await this.generateMnemonic();
    const privateKey = await this.generatePrivateKey(mnemonic);
    const address = this.generateAddress(privateKey);
    return { mnemonic, privateKey, address };
  }
}

// Example usage:
(async () => {
  const walletGenerator = new WalletGenerator('mainnet');
  const wallet = await walletGenerator.generateWallet();
  console.log(`MNEMONIC="${wallet.mnemonic}"`);
  console.log(`PRIVATE_KEY="${wallet.privateKey}"`);
  console.log(`ADDRESS="${wallet.address}"`);
})();
