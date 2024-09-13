import KeyGenerator from './KeyGenerator/index';
import { program } from 'commander';

// Configure the CLI options
program
  .name('key-generator')
  .description('A CLI tool to generate mnemonic phrases, private keys, and addresses for a Kaspa wallet')
  .version('1.0.0');

// Command to generate a new mnemonic, private key, and addresses
program
  .command('generate')
  .description('Generate a new mnemonic, private key (XPrv), receive address, and change address')
  .action(async () => {
    const opts = program.opts();
    const keyGenerator = new KeyGenerator('testnet-10', opts.debug);

    try {
      console.info('INFO: Generating new mnemonic, private key, receive address, and change address...');
      const keys = await keyGenerator.generateKeys();
      console.log('Mnemonic:', keys.mnemonic);
      console.log('Private Key:', keys.receivePrivateKey);
      console.log('Change Key:', keys.changePrivateKey);
      console.log('Receive Address:', keys.receive);
      console.log('Change Address:', keys.change);
    } catch (error) {
      console.error('ERROR:', error.message);
    }
  });

// Command to determine the address from a given private key
program
  .command('address')
  .description('Determine a receive address from a given private key (XPrv)')
  .argument('<privateKey>', 'The private key (XPrv) to generate the address from')
  .action((privateKey) => {
    const opts = program.opts();
    const keyGenerator = new KeyGenerator('testnet-10', opts.debug);

    try {
      console.info('INFO: Determining address from private key...');
      const address = keyGenerator.generateAddressFromXPrv(privateKey);
      console.log('Receive Address:', address);
    } catch (error) {
      console.error('ERROR:', error.message);
    }
  });

// Debug option for extra logging
program
  .option('-d, --debug', 'Output extra debugging')
  .hook('preAction', (thisCommand, actionCommand) => {
    const opts = thisCommand.opts();
    if (opts.debug) {
      console.debug('DEBUG: Debugging is enabled');
    }
  });

program.parse(process.argv);

if (program.opts().debug) {
  console.debug('DEBUG: Finished parsing command-line arguments');
}
