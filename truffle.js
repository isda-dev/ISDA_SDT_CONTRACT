module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  networks: {
    development: {
      host: '127.0.0.1',
      port: 9545,
      network_id: '*' // ,
      // gas: 500000,
      // gasPrice: 220000000
    }
  }
};
