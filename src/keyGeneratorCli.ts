import KeyGenerator from './KeyGenerator/index';
import { program } from 'commander';

// Configure the CLI options
program
  .name('key-generator')
  .description('A CLI tool to generate mnemonic phrases, private keys, and addresses for a Kaspa wallet')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate a new mnemonic, private key, and address')
  .action(async () => {
    const opts = program.opts();
    const keyGenerator = new KeyGenerator('testnet-10', opts.debug);

    try {
      console.info('INFO: Generating new mnemonic, private key, and address...');
      const keys = await keyGenerator.generateKeys();
      console.log('Mnemonic:', keys.mnemonic);
      console.log('Private Key:', keys.privateKey);
      console.log('Address:', keys.address);
      console.log('Change Key:', keys.changeKey);
      console.log('Change Address:', keys.changeAddress);
    } catch (error) {
      console.error('ERROR:', error.message);
    }
  });

program
  .command('address')
  .description('Determining an address from a given private key')
  .argument('<privateKey>', 'The private key to generate the address from')
  .action((privateKey) => {
    const opts = program.opts();
    const keyGenerator = new KeyGenerator('testnet-10', opts.debug);

    try {
      console.info('INFO: Determining address from private key...');
      const address = keyGenerator.generateAddress(privateKey);
      console.log('Address:', address);
    } catch (error) {
      console.error('ERROR:', error.message);
    }
  });

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
