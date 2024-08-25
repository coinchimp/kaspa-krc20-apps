# Kaspa KRC20 Apps for bot construction
This repository provides a comprehensive tool for generating a secure 24-word mnemonic phrase, deriving a private key from it, and using it to mint KRC20 tokens. The generated mnemonic and private key are displayed in a friendly format, making it easy to export them for use in bash scripts. The repository leverages BIP39 and BIP32 standards for key generation and includes a KRC20 minting application built with TypeScript. This utility ensures high security and convenience for managing cryptocurrency wallets and minting tokens. Ideal for developers and crypto enthusiasts, it offers a robust solution for secure key management and token creation. Simply run the script and get started with your secure keys and KRC20 minting in minutes

## Install required packages

This project was created using `bun init` in bun v1.0.31. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
```bash
  bun install
```  

## Download Kaspa WASM
You can download the latest form here: https://kaspa.aspectron.org/nightly/downloads/
move `nodejs` to the repo folder as `wasm`

## Basic krc20 min app
This app is showing the basics of the krc20 insert data mint operation
```
bun run mint.ts --privKey <your-priv-key> 
```

## KeyGenerator CLI

`keyGeneratorCli.ts` is a command-line application written in TypeScript using Bun. This tool allows you to generate a 24-word mnemonic phrase, derive a private key, and obtain a wallet address for the Kaspa network. You can also obtain a wallet address directly from a given private key.

### Features

- **Generate Mnemonic:** Creates a 24-word mnemonic phrase.
- **Generate Private Key:** Derives a private key from a mnemonic phrase.
- **Obtain Address:** Obtain a wallet address from a private key.
- **Debug Mode:** Output detailed debug information for troubleshooting.

### Generate a New Mnemonic, Private Key, and Address

To generate a new mnemonic, derive a private key from it, and then generate a corresponding address, use:

```bash
bun run src/keyGeneratorCli.ts generate
```

### Obtain an Address from an Existing Private Key

If you already have a private key and want to obtain the related address:

```bash
bun run src/keyGeneratorCli.ts address <privateKey>
```

Replace `<privateKey>` with your actual private key.

### Enable Debug Mode

To see detailed debug output, add the `--debug` flag to any command:

```bash
bun run src/keyGeneratorCli.ts generate --debug
```

### Display Help

For a list of available commands and options:

```bash
bun run src/keyGeneratorCli.ts --help
```

## Example

Here's an example of generating a new mnemonic, private key, and address with debugging enabled:

```bash
bun run src/keyGeneratorCli.ts generate --debug
```

## Kaspa Transfer CLI

The **Kaspa Transfer CLI** is a command-line application written in TypeScript that allows you to securely transfer KASPA tokens to any wallet using your private key. This tool is ideal for developers or users who need a quick and efficient way to manage KASPA transactions directly from the terminal.

### Features

- **Private Key Signing**: Sign transactions securely using your private key.
- **Custom Network Support**: Easily switch between networks (e.g., `testnet-10`) with a simple flag.
- **Detailed Logging**: Adjustable log levels (`INFO`, `DEBUG`) to help you monitor and troubleshoot the transaction process.
- **Error Handling**: Robust error handling ensures a smooth user experience and provides informative feedback.

### Usage

```bash
bun run src/sendKaspa.ts --privKey <privateKey> --destination <address> --amount <amount> [options]
```

### Options

- `--privKey`: Your private key to sign the transaction. **(Required)**
- `--destination`: The destination address to which funds will be sent. **(Required)**
- `--amount`: The amount of KASPA to transfer. **(Required)**
- `--network`: The network to connect to (default: `testnet-10`).
- `--logLevel`: Log level (`DEBUG`, `INFO`, default: `INFO`).
- `--help`: Display the help message with usage details.

### Example

```bash
bun run src/sendKaspa.ts --privKey yourPrivateKeyHere --destination kaspaAddressHere --amount 100 --network testnet-10 --logLevel DEBUG
```

This command will transfer 100 KASPA tokens from your wallet to the specified destination address on the `testnet-10` network, with detailed logging output at the `DEBUG` level.

## KRC20 Operation CLI (work in progress)
** These Classes are still in unfinished state **

### Overview

This application is a command-line interface (CLI) tool for performing operations on KRC20 tokens within the Kaspa blockchain network. It allows you to mint, deploy, and transfer KRC20 tokens securely and efficiently.

### Usage

```bash
bun run src/operKrc20Cli.ts --privKey <priv-key> --operation <operation> [options]
```

### Options

- `--privKey <priv-key>`: **Required**. Your private key used to sign transactions.
- `--operation <operation>`: **Required**. The operation to perform: `mint`, `deploy`, or `transfer`.
- `--network <network>`: The network to use (default: `testnet-10`).
- `--ticker <ticker>`: The ticker symbol for the token (default: `TNACHO`).
- `--priorityFee <fee>`: Priority fee in KAS for the transaction (default: `0.1`).
- `--timeout <ms>`: Timeout for operations in milliseconds (default: `20000`).
- `--logLevel <level>`: Logging level: `INFO` or `DEBUG` (default: `INFO`).
- `--destination <address>`: **Required for transfer**. The destination wallet address for the transfer.
- `--max <max-supply>`: **Required for deploy**. Maximum supply for the deployed token.
- `--limit <limit-per-mint>`: **Required for deploy**. Limit per mint for the deployed token.
- `--pre <preallocation>`: Preallocation amount for the deployed token.
- `--help`: Show this help message and exit.

### Examples

#### Minting KRC20 Tokens

```bash
bun run src/operKrc20Cli.ts --privKey your_private_key_here --operation mint --ticker MYTOKEN
```

#### Deploying a New KRC20 Token

```bash
bun run src/operKrc20Cli.ts --privKey your_private_key_here --operation deploy --max 1000000 --limit 1000 --ticker MYTOKEN
```

#### Transferring KRC20 Tokens

```bash
bun run src/operKrc20Cli.ts --privKey your_private_key_here --operation transfer --destination your_wallet_address_here --ticker MYTOKEN
```

### Logging and Debugging

Set the logging level using the `--logLevel` option:

```bash
bun run src/operKrc20Cli.ts --privKey your_private_key_here --operation mint --logLevel DEBUG
```

### Disclaimer

**1. No Responsibility:**
I, the developer, am not responsible for any direct or indirect consequences, including but not limited to financial loss, damages, or legal repercussions that may arise from the use or misuse of this project. This software is provided "as is," without any guarantees or warranties of any kind.

**2. No Recommendation or Endorsement:**
This project is not an endorsement, recommendation, or promotion of any cryptocurrency, blockchain technology, or financial product. Any references to specific technologies or products are for informational purposes only and do not constitute an endorsement.

**3. Not Financial Advice:**
The content and tools provided in this project are not intended as financial advice. I am not a financial advisor, and you should consult with a qualified professional before making any financial decisions.

**4. Use at Your Own Risk:**
By using this project, you acknowledge that you do so at your own risk. The user is solely responsible for ensuring compliance with all applicable laws and regulations.

**5. No Warranty or Liability:**
This project is provided without warranty of any kind, express or implied. In no event shall I, the developer, be held liable for any damages arising from the use of this project.

**6. Third-Party Content:**
Any third-party content, including but not limited to libraries, APIs, or other code incorporated into this project, is the responsibility of their respective authors. I do not assume any responsibility for the content or functionality of third-party materials.

**7. Legal Compliance:**
Users are responsible for ensuring that their use of this project complies with all applicable local, national, and international laws and regulations.

