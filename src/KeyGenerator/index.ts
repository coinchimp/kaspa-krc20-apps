import * as bip39 from 'bip39';
import { randomBytes } from 'crypto';
import { BIP32Factory, BIP32Interface } from 'bip32';
import * as ecc from 'tiny-secp256k1'; // Secp256k1 library for elliptic curve operations
import { PrivateKey } from '../../wasm/kaspa';

// Initialize BIP32 with the secp256k1 library
const bip32 = BIP32Factory(ecc);

class KeyGenerator {
  private network: string;
  private debug: boolean;

  constructor(network: string = 'testnet-10', debug: boolean = false) {
    this.network = network;
    this.debug = debug;
  }

  private logDebug(message: string) {
    if (this.debug) {
      console.debug(`DEBUG: ${message}`);
    }
  }

  // Generate a 24-word mnemonic phrase
  public async generateMnemonic(): Promise<string> {
    this.logDebug('Generating entropy for mnemonic...');
    const entropy = randomBytes(32);
    const mnemonic = bip39.entropyToMnemonic(entropy.toString('hex'));
    this.logDebug(`Generated mnemonic: ${mnemonic}`);
    return mnemonic;
  }

  // Generate a private key from a mnemonic
  public async generatePrivateKey(mnemonic: string): Promise<string> {
    this.logDebug(`Validating mnemonic: ${mnemonic}`);
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    this.logDebug('Converting mnemonic to seed...');
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const rootNode: BIP32Interface = bip32.fromSeed(seed);
    const accountNode = rootNode.derivePath("m/44'/0'/0'/0/0");

    this.logDebug('Derived private key from mnemonic.');
    return accountNode.privateKey.toString('hex');
  }

  // Generate a wallet address from a private key
  public generateAddress(privateKey: string): string {
    this.logDebug('Converting private key to Kaspa public key...');
    const kaspaPrivateKey = new PrivateKey(privateKey);
    const publicKey = kaspaPrivateKey.toPublicKey();
    const address = publicKey.toAddress(this.network);
    this.logDebug(`Generated address: ${address}`);
    return address.toString();
  }

  // Generate the mnemonic, private key, and address all at once
  public async generateKeys(): Promise<{ mnemonic: string; privateKey: string; address: string }> {
    this.logDebug('Starting key generation process...');
    const mnemonic = await this.generateMnemonic();
    const privateKey = await this.generatePrivateKey(mnemonic);
    const address = this.generateAddress(privateKey);
    this.logDebug('Key generation process complete.');
    return { mnemonic, privateKey, address };
  }
}

export default KeyGenerator;
