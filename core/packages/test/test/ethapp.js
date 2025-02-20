const Web3 = require('web3');
const BigNumber = require('bignumber.js');

const { expect } = require("chai")
  .use(require("chai-as-promised"))
  .use(require("chai-bignumber")(BigNumber));

const { polkadotRecipientSS58, polkadotRecipient, bootstrap } = require('../src/fixtures');

const { ChannelId } = require("../src/helpers");

describe('Bridge', function () {

  let ethClient, subClient, testSubClient;

  before(async function () {
    const clients = await bootstrap();
    ethClient = clients.ethClient;
    subClient = clients.subClient;
    testSubClient = clients.testSubClient;
    this.testParaEthAssetId = 0;
  });

  describe('ETH App', function () {

    it('should transfer ETH from Substrate to Ethereum (incentivized channel)', async function () {
      // Wait for new substrate block before tests, as queries may go to old block
      await subClient.waitForNextBlock();

      // This fee will be deducted from the source account
      let fee = await subClient.queryIncentivizedOutboundChannelFee()

      const amount = BigNumber(Web3.utils.toWei('0.0001', "ether"));
      const ethAccount = ethClient.accounts[1];

      const beforeEthBalance = await ethClient.getEthBalance(ethAccount);
      const beforeSubBalance = await subClient.queryAssetsAccountBalance(0, polkadotRecipientSS58);

      await subClient.burnETH(subClient.alice, ethAccount, amount.toFixed(), ChannelId.INCENTIVIZED)
      await ethClient.waitForNextEventData({ appName: 'appETH', eventName: 'Unlocked' });

      const afterEthBalance = await ethClient.getEthBalance(ethAccount);
      const afterSubBalance = await subClient.queryAssetsAccountBalance(0, polkadotRecipientSS58);

      expect(afterEthBalance.minus(beforeEthBalance)).to.be.bignumber.equal(amount);
      expect(beforeSubBalance.minus(afterSubBalance)).to.be.bignumber.equal(amount.plus(fee));
      // conservation of value
      expect(beforeEthBalance.plus(beforeSubBalance))
        .to.be.bignumber
        .equal(afterEthBalance.plus(afterSubBalance).plus(fee));
    })
  });

  describe.skip('ETH App XCM', function () {
    it('should transfer ETH from Ethereum to Parachain 1001 (incentivized channel)', async function () {
      const amount = BigNumber(Web3.utils.toWei('0.0001', "ether"));
      const xcmFee = 4_000_000;
      const paraId = 1001;
      const ethAccount = ethClient.accounts[1];

      const testSubBalances = await testSubClient.subscribeAssetsAccountBalances(
        this.testParaEthAssetId, polkadotRecipientSS58, 2
      );

      const beforeEthBalance = await ethClient.getEthBalance(ethAccount);
      const beforeSubBalance = await testSubBalances[0];

      const { gasCost } = await ethClient.lockETH(ethAccount, amount, polkadotRecipient, ChannelId.INCENTIVIZED, paraId, xcmFee);

      const stopRecording = await subClient.recordEvents('xcmSupport', 'TransferSent');
      const afterEthBalance = await ethClient.getEthBalance(ethAccount);
      const afterSubBalance = await testSubBalances[1];

      expect(beforeEthBalance.minus(afterEthBalance)).to.be.bignumber.equal(amount.plus(gasCost));
      expect(afterSubBalance.minus(beforeSubBalance)).to.be.bignumber.equal(amount);
      // conservation of value
      expect(beforeEthBalance.plus(beforeSubBalance)).to.be.bignumber.equal(afterEthBalance.plus(afterSubBalance).plus(gasCost));

      const events = await stopRecording();
      expect(events.length).to.be.greaterThan(0);
      const firstEvent = events[0];
      expect(firstEvent.assetId.toString()).to.be.equal('0');
      expect(firstEvent.sender.toHex().toLowerCase()).to.be.equal(ethAccount.toString().toLowerCase());
      expect(firstEvent.recipient.toHex().toLowerCase()).to.be.equal(polkadotRecipient.toString().toLowerCase());
      expect(firstEvent.fee.toString()).to.be.equal(xcmFee.toString());
      expect(firstEvent.paraId.toString()).to.be.equal(paraId.toString());
      expect(firstEvent.amount.toString()).to.be.equal(amount.toString());
    });

    it('should not transfer ETH from Ethereum to Parachain 1001 without fee', async function () {
      const amount = BigNumber(Web3.utils.toWei('0.0001', "ether"));
      const xcmFee = 0;
      const paraId = 1001;
      const ethAccount = ethClient.accounts[1];

      const subBalances = await subClient.subscribeAssetsAccountBalances(
        this.testParaEthAssetId, polkadotRecipientSS58, 2
      );

      const beforeEthBalance = await ethClient.getEthBalance(ethAccount);
      const beforeSubBalance = await subBalances[0];

      const { gasCost } = await ethClient.lockETH(ethAccount, amount, polkadotRecipient, ChannelId.INCENTIVIZED, paraId, xcmFee);

      const stopRecording = await subClient.recordEvents('xcmSupport', 'TransferFailed');
      const afterEthBalance = await ethClient.getEthBalance(ethAccount);
      const afterSubBalance = await subBalances[1];

      expect(beforeEthBalance.minus(afterEthBalance)).to.be.bignumber.equal(amount.plus(gasCost));
      expect(afterSubBalance.minus(beforeSubBalance)).to.be.bignumber.equal(amount);
      // conservation of value
      expect(beforeEthBalance.plus(beforeSubBalance)).to.be.bignumber.equal(afterEthBalance.plus(afterSubBalance).plus(gasCost));

      const events = await stopRecording();
      expect(events.length).to.be.greaterThan(0);
      const firstEvent = events[0];
      expect(firstEvent.assetId.toString()).to.be.equal('0');
      expect(firstEvent.sender.toHex().toLowerCase()).to.be.equal(ethAccount.toString().toLowerCase());
      expect(firstEvent.recipient.toHex().toLowerCase()).to.be.equal(polkadotRecipient.toString().toLowerCase());
      expect(firstEvent.fee.toString()).to.be.equal(xcmFee.toString());
      expect(firstEvent.paraId.toString()).to.be.equal(paraId.toString());
      expect(firstEvent.amount.toString()).to.be.equal(amount.toString());
    });

    it('should not transfer ETH from Ethereum to non-existent Parachain 2001', async function () {
      const amount = BigNumber(Web3.utils.toWei('0.0001', "ether"));
      const xcmFee = 4_000_000;
      const paraId = 2001;
      const ethAccount = ethClient.accounts[1];

      const subBalances = await subClient.subscribeAssetsAccountBalances(
        this.testParaEthAssetId, polkadotRecipientSS58, 2
      );

      const beforeEthBalance = await ethClient.getEthBalance(ethAccount);
      const beforeSubBalance = await subBalances[0];

      const { gasCost } = await ethClient.lockETH(ethAccount, amount, polkadotRecipient, ChannelId.INCENTIVIZED, paraId, xcmFee);

      const stopRecording = await subClient.recordEvents('xcmSupport', 'TransferFailed');
      const afterEthBalance = await ethClient.getEthBalance(ethAccount);
      const afterSubBalance = await subBalances[1];

      expect(beforeEthBalance.minus(afterEthBalance)).to.be.bignumber.equal(amount.plus(gasCost));
      expect(afterSubBalance.minus(beforeSubBalance)).to.be.bignumber.equal(amount);
      // conservation of value
      expect(beforeEthBalance.plus(beforeSubBalance)).to.be.bignumber.equal(afterEthBalance.plus(afterSubBalance).plus(gasCost));

      const events = await stopRecording();
      expect(events.length).to.be.greaterThan(0);
      const firstEvent = events[0];
      expect(firstEvent.assetId.toString()).to.be.equal('0');
      expect(firstEvent.sender.toHex().toLowerCase()).to.be.equal(ethAccount.toString().toLowerCase());
      expect(firstEvent.recipient.toHex().toLowerCase()).to.be.equal(polkadotRecipient.toString().toLowerCase());
      expect(firstEvent.fee.toString()).to.be.equal(xcmFee.toString());
      expect(firstEvent.paraId.toString()).to.be.equal(paraId.toString());
      expect(firstEvent.amount.toString()).to.be.equal(amount.toString());
    });
  });
});
