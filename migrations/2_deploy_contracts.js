var SdtCoin = artifacts.require("./contracts/SdtCoin.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(SdtCoin, 'SDT', 'ISDA Sports Data Token', accounts[0], accounts[1], accounts[2]).then(() => {
    console.log(`SdtCoin deployed: address = ${SdtCoin.address}`);
  })
};
