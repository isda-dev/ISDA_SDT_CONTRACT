"use strict"

var SdtCoin = artifacts.require("./SdtCoin.sol");
const theBN = require("bn.js")

/**
 * Sdt contract tests 2
 */
contract('SdtCoin2', function(accounts) {
  const BIG = (v) => new theBN.BN(v)

  const owner = accounts[0];
  const admin = accounts[1];
  const vault = accounts[2];
  const minter = accounts[0];

  const user1 = accounts[4];
  const user2 = accounts[5];
  const user3 = accounts[6];
  const user4 = accounts[7];
  const user5 = accounts[8];

  let coin, OneSdtInWei, NoOfTokens, NoOfTokensInWei;

  const bnBalanceOf = async addr => await coin.balanceOf(addr);
  const bnReserveOf = async addr => await coin.reserveOf(addr);
  const bnAllowanceOf = async (owner, spender) => await coin.allowance(owner, spender);

  const balanceOf = async addr => (await coin.balanceOf(addr)).toString();
  const reserveOf = async addr => (await coin.reserveOf(addr)).toString();
  const allowanceOf = async (owner, spender) => (await coin.allowance(owner,spender)).toString();


  before(async () => {
    coin = await SdtCoin.deployed();
    NoOfTokensInWei = await coin.totalSupply();
    OneSdtInWei = await coin.getOneSdt();
    NoOfTokens = NoOfTokensInWei.div(OneSdtInWei)
  });

  const clearUser = async user => {
    await coin.setReserve(user, 0, {from: admin});
    await coin.transfer(vault, await bnBalanceOf(user), {from: user});
  };

  beforeEach(async () => {
    await clearUser(user1);
    await clearUser(user2);
    await clearUser(user3);
    await clearUser(user4);
    await clearUser(user5);
  });

  it("only admin can recall", async () => {
      assert.equal(await balanceOf(user1), "0");
      await coin.transfer(user1, OneSdtInWei, {from: vault});
      await coin.setReserve(user1, OneSdtInWei, {from: admin});
      assert.equal(await balanceOf(user1), OneSdtInWei.toString());
      assert.equal(await reserveOf(user1), OneSdtInWei.toString());

      try {
          await coin.recall(user1, OneSdtInWei, {from: user1});
          assert.fail();
      } catch (exception) {
          assert.isTrue(exception.message.includes("revert"));
      }

      try {
          await coin.recall(user1, OneSdtInWei, {from: owner});
          assert.fail();
      } catch (exception) {
          assert.isTrue(exception.message.includes("revert"));
      }

      try {
          await coin.recall(user1, OneSdtInWei, {from: vault});
          assert.fail();
      } catch (exception) {
          assert.isTrue(exception.message.includes("revert"));
      }

      try
      {
          await coin.recall(user1, OneSdtInWei, {from: admin});
          assert.equal(await balanceOf(user1), "0");
          assert.equal(await reserveOf(user1), "0");
      } catch (exception) { assert.fail() }
  });

  it("recall fails", async () => {
    assert.equal(await bnBalanceOf(user2), 0);
    coin.transfer(user2, OneSdtInWei, {from: vault});
    assert.equal(await balanceOf(user2), OneSdtInWei.toString());
    assert.equal(await reserveOf(user2), "0");

    try {
      // require(currentReserve >= _amount);
      await coin.recall(user2, OneSdtInWei, {from: admin});
      assert.fail();
    }
    catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }

    coin.setReserve(user2, OneSdtInWei.mul(BIG(3)), {from: admin});
    try {
      // require(currentBalance >= _amount);
      await coin.recall(user2, OneSdtInWei.mul(BIG(2)), {from: admin});
      assert.fail()
    }
    catch(exception) {
      assert.equal(await balanceOf(user2), OneSdtInWei.toString());
      assert.equal(await reserveOf(user2), OneSdtInWei.mul(BIG(3)));
      assert.isTrue(exception.message.includes("revert"));
    }
  });

  it("after recall all coin", async () => {
    assert.equal(await bnBalanceOf(user3), 0);
    coin.transfer(user3, OneSdtInWei, {from: vault});
    coin.setReserve(user3, OneSdtInWei, {from: admin});
    assert.equal(await balanceOf(user3), OneSdtInWei.toString());
    assert.equal(await reserveOf(user3), OneSdtInWei.toString());

    const vaultBal = await bnBalanceOf(vault);

    coin.recall(user3, OneSdtInWei, {from: admin});

    assert.equal(await balanceOf(user3), "0");
    assert.equal(await reserveOf(user3), "0");

    assert.equal(await balanceOf(vault), vaultBal.add(OneSdtInWei).toString());
  });

  it("after recall half", async () => {
    assert.equal(await balanceOf(user4), "0");
    coin.transfer(user4, OneSdtInWei, {from: vault});
    coin.setReserve(user4, OneSdtInWei, {from: admin});
    assert.equal(await balanceOf(user4), OneSdtInWei.toString());
    assert.equal(await reserveOf(user4), OneSdtInWei.toString());

    const vaultBal = await bnBalanceOf(vault);
    const halfPlayXInWei = OneSdtInWei.div(BIG(2));

    coin.recall(user4, halfPlayXInWei, {from: admin});

    assert.equal(await balanceOf(user4), halfPlayXInWei.toString());
    assert.equal(await reserveOf(user4), halfPlayXInWei.toString());

    assert.equal(await balanceOf(vault), vaultBal.add(halfPlayXInWei).toString());
  });

  it("reserve and then approve", async() => {
    assert.equal(await balanceOf(user4), "0");

    const OnePlayXTimesTwoInWei = OneSdtInWei.mul(BIG(2))
    const OnePlayXTimesTwoInWeiStr = OnePlayXTimesTwoInWei.toString()

    const OnePlayXTimesOneInWei = OneSdtInWei.mul(BIG(1))
    const OnePlayXTimesOneInWeiStr = OnePlayXTimesOneInWei.toString()

    // send 2 SDT to user4 and set 1 SDT reserve
    coin.transfer(user4, OnePlayXTimesTwoInWei, {from: vault});
    coin.setReserve(user4, OneSdtInWei, {from: admin});
    assert.equal(await balanceOf(user4), OnePlayXTimesTwoInWeiStr);
    assert.equal(await reserveOf(user4), OneSdtInWei.toString());

    // approve 2 SDT to user5
    await coin.approve(user5, OnePlayXTimesTwoInWei, {from:user4});
    assert.equal(await allowanceOf(user4, user5), OnePlayXTimesTwoInWeiStr);

    // transfer 2 SDT from user4 to user5 SHOULD NOT BE POSSIBLE
    try {
      await coin.transferFrom(user4, user5, OnePlayXTimesTwoInWei, {from: user5});
      assert.fail();
    } catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }

    // transfer 1 SDT from user4 to user5 SHOULD BE POSSIBLE
    await coin.transferFrom(user4, user5, OnePlayXTimesOneInWei, {from: user5});
    assert.equal(await balanceOf(user4), OnePlayXTimesOneInWeiStr);
    assert.equal(await reserveOf(user4), OnePlayXTimesOneInWeiStr); // reserve will not change
    assert.equal(await allowanceOf(user4, user5), OnePlayXTimesOneInWeiStr); // allowance will be reduced
    assert.equal(await balanceOf(user5), OnePlayXTimesOneInWeiStr);
    assert.equal(await reserveOf(user5), "0");

    // transfer .5 SDT from user4 to user5 SHOULD NOT BE POSSIBLE if balance <= reserve
    const halfPlayXInWei = OneSdtInWei.div(BIG(2));
    try {
      await coin.transferFrom(user4, user5, halfPlayXInWei, {from: user5});
      assert.fail();
    } catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }
  })
});
