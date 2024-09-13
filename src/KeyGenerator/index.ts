const { Mnemonic, XPrv, PublicKeyGenerator } = require('../../wasm/kaspa');

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

  // Consolidated method to generate mnemonic, private key, and addresses
  public async generateKeys(): Promise<{ mnemonic: string; receivePrivateKey: string; changePrivateKey: string; receive: string; change: string }> {
    this.logDebug('Starting key generation process...');

    const mnemonic = Mnemonic.random();
    this.logDebug(`Generated mnemonic: ${mnemonic.phrase}`);


    const seed = mnemonic.toSeed();
    const xprv = new XPrv(seed);


   //const accountRoot = xprv.derivePath("m/44'/111111'/0'/0").toXPub();
    //const receiveXPub = accountRoot.deriveChild(0);
    //const changeXPub = accountRoot.deriveChild(1);

    const receivePrivateKey = xprv.derivePath("m/44'/111111'/0'/0/0").toPrivateKey(); // Derive the private key for the receive address
    const changePrivateKey = xprv.derivePath("m/44'/111111'/0'/1/0").toPrivateKey(); // Derive the private key for the change address
    
    // Derive the corresponding public keys from the private keys
    const receivePublicKey = receivePrivateKey.toPublicKey();
    const changePublicKey = changePrivateKey.toPublicKey();
    
    // Generate the addresses from the public keys
    const receiveAddress = receivePublicKey.toAddress(this.network).toString();
    const changeAddress = changePublicKey.toAddress(this.network).toString();
    
    // Convert private keys to strings for output
    const receivePrivateKeyString = receivePrivateKey.toString();
    const changePrivateKeyString = changePrivateKey.toString();
    

    this.logDebug(`Generated receive address: ${receiveAddress}`);
    this.logDebug(`Generated change address: ${changeAddress}`);

    return {
      mnemonic: mnemonic.phrase,
      receivePrivateKey: receivePrivateKeyString,
      changePrivateKey: changePrivateKeyString,
      receive: receiveAddress,
      change: changeAddress,
    };
  }

  // New method to generate an address from a private key (XPrv)
  public generateAddressFromXPrv(xprv: string): string {
    this.logDebug('Generating address from private key (XPrv)...');

    const privateKey = XPrv.fromString(xprv);  // Convert string to XPrv
    const keygen = PublicKeyGenerator.fromMasterXPrv(privateKey.toString(), false, 0n, 0);

    // Derive the first receive public key and convert to address
    const publicKey = keygen.receivePubkeys(0, 1)[0]; // Get first receive public key
    const address = publicKey.toAddress(this.network).toString(); // Convert to address

    this.logDebug(`Generated address: ${address}`);
    return address;
  }
}

export default KeyGenerator;
