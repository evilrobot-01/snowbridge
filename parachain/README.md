# Snowbridge Parachain <!-- omit in toc -->
![Check](https://github.com/Snowfork/snowbridge/workflows/Check/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/Snowfork/polkadot-ethereum/badge.svg)](https://coveralls.io/github/Snowfork/snowbridge)

A Polkadot parachain for bridging arbitrary data from and to Ethereum.

- [Development](#development)
  - [Requirements](#requirements)
  - [Build](#build)
  - [Run](#run)
- [Configuration](#configuration)

## Development

Follow these steps to prepare your local environment for Substrate development.

### Requirements

Refer to the instructions at the
[Substrate Developer Hub](https://docs.substrate.io/main-docs/install/).

To add context to the above instructions, the parachain is known to compile with the following versions of Rust:

- stable: 1.62.1
- nightly: 1.64.0-nightly

### Build

Once the development environment is set up, build the parachain. This command will build the
[Wasm](https://substrate.dev/docs/en/knowledgebase/advanced/executor#wasm-execution) and
[native](https://substrate.dev/docs/en/knowledgebase/advanced/executor#native-execution) code:

Several runtimes can be built:
* snowbase: Local development
* snowblink: Staging & Kusama parachain
* snowbridge: Polkadot parachain

To build with snowbase and snowblink runtimes (the default):

```bash
cargo build --release --features rococo-native
```

## Configuration

Note: This section is not necessary for local development, as there are scripts to auto-configure the parachain.

For a fully operational chain, further configuration of the initial chain spec is required. The specific configuration will depend heavily on your environment, so this guide will remain high-level.

Build an initial spec for the snowbase runtime:

```bash
target/release/snowbridge build-spec --chain snowbase --disable-default-bootnode > spec.json
```

Now edit the spec and configure the following:
1. Recently finalized ethereum header and difficulty for the ethereum light client
2. Contract addresses for the Ether, Erc20, and Dot apps.
3. Authorized principal for the basic channel
4. Fee and reward parameters for the incentivized channel

For an example configuration, consult the [setup script](https://github.com/Snowfork/snowbridge/blob/main/test/scripts/start-services.sh) for our local development stack. Specifically the `start_polkadot_launch` bash function.

## Tests

To run the parachain tests locally, use `cargo test --workspace`. For the full suite of tests, use `cargo test --workspace --features runtime-benchmarks`.

Optionally exclude the top-level and runtime crates:

```bash
cargo test --workspace \
        --features runtime-benchmarks \
        --exclude snowbridge \
        --exclude snowbridge-runtime \
        --exclude snowblink-runtime \
        --exclude snowbase-runtime
```

### Updating test data for inbound channel unit tests

To regenerate the test data, use a test with multiple `submit` calls in `ethereum/test/test_{basic,incentivized}_outbound_channel.js`, eg.
"should increment nonces correctly".

Add the following preamble:

```javascript
const rlp = require("rlp");
const contract = BasicOutboundChannel;
const signature = 'Message(address,address,uint64,uint64,bytes)';
```

For each encoded log you want to create, find a transaction object `tx` returned from a `submit` call and run this:

```javascript
const rawLog = tx.receipt.rawLogs[0];
const encodedLog = rlp.encode([rawLog.address, rawLog.topics, rawLog.data]).toString("hex");
console.log(`encodedLog: ${encodedLog}`);
const iface = new ethers.utils.Interface(contract.abi);
const decodedEventLog = iface.decodeEventLog(
  signature,
  rawLog.data,
  rawLog.topics,
);
console.log(`decoded rawLog.data: ${JSON.stringify(decodedEventLog)}`);
```

Place the `encodedLog` string in the `message.data` field in the test data. Use the `decoded rawLog.data` field to update the comments
with the decoded log data.

## Chain metadata

There is an internal tool `snowbridge-query-events` which is used to read specific events from the parachain. It is a used by our offchain message relayers.

This tool must be kept up to date with the latest chain metadata. This is the process for keeping that up to date:

Install subxt client:

```bash
cargo install subxt-cli
```

Update metadata by fetching it from parachain node (in this case a node in the E2E stack):
```bash
subxt metadata --url http://localhost:8081 -f bytes > tools/query-events/metadata.scale
```

If you want to update the tool for an already running E2E stack:

```bash
cargo build --release --manifest-path tools/query-events/Cargo.toml
cp target/release/snowbridge-query-events /tmp/snowbridge/bin/
```

## Generating pallet weights from benchmarks

Build the parachain with the runtime benchmark flags for the chosen runtime:

```bash
runtime=snowbase
cargo build \
    --release \
    --no-default-features \
    --features "$runtime-native,rococo-native,runtime-benchmarks,$runtime-runtime-benchmarks" \
    --bin snowbridge
```

List available pallets and their benchmarks:

```bash
./target/release/snowbridge benchmark pallet --chain $runtime --list
```

Run a benchmark for a pallet, generating weights:

```bash
target/release/snowbridge benchmark pallet \
  --chain=$runtime \
  --execution=wasm \
  --wasm-execution=compiled \
  --pallet=basic_channel_inbound \
  --extra \
  --extrinsic=* \
  --repeat=20 \
  --steps=50 \
  --output=pallets/basic-channel/src/inbound/weights.rs \
  --template=templates/module-weight-template.hbs
```
