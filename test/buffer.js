require('dotenv').config()
const axios = require('axios')
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const Moneypipe = require("../index")
const assert = require('assert');
const web3 = createAlchemyWeb3(process.env.RINKEBY)
const buffer = new Moneypipe.buffer({
  key: process.env.RINKEBY_PRIVATE_KEY,
  network: "rinkeby",
  web3: web3,
  ipfs: async (json) => {
    let cid = await axios.post("https://microipfs.com/add", {
      object: json
    }, {
      headers: { "Content-Type": "application/json" },
    }).then((r) => {
      return r.data.success
    })
    console.log("cid", cid)
    return cid
  }
})
describe('buffer', function() {
  it('get', async () => {
    //let members = await buffer.members("0xAa9a65422978806Fe6a866123b1Ddd7AF946f649")
    let members = await buffer.members("0x66360Caf43A1ee1F1D0A2dc8D0246a86d9522539")
    console.log("members = ", members)
  })
  it('merkleproof', async () => {
    // get merkleproof for an account
    const wallet = web3.eth.accounts.privateKeyToAccount("0x" + buffer.key)
    let tree = await buffer.merkleproof(
      "0x66360Caf43A1ee1F1D0A2dc8D0246a86d9522539", // contract address
      wallet.address 
    )
    console.log("tree", tree)
  })
  it('withdraw', async () => {
    const BUFFER_ADDRESS = "0x66360Caf43A1ee1F1D0A2dc8D0246a86d9522539"
    let wallet = web3.eth.accounts.privateKeyToAccount("0x" + buffer.key)
    // Send 0.1 ETH
    const callObject = {
      from: wallet.address,
      to: BUFFER_ADDRESS,
      value: "" + Math.pow(10, 17)
    }
    const estimate = await web3.eth.estimateGas(callObject)
    callObject.gas = estimate
    console.log("callObject", callObject)
//    const signedTx = await web3.eth.accounts.signTransaction(callObject, buffer.key)

    const signedTx = await wallet.signTransaction(callObject)
    console.log('signedTx', signedTx)

    let balanceBefore = await web3.eth.getBalance(BUFFER_ADDRESS)
    console.log("balanceBefore", balanceBefore)

    let tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log("sent", tx)

    let balanceAfter = await web3.eth.getBalance(BUFFER_ADDRESS)
    console.log("balanceAfter", balanceAfter)

    let balanceWalletBeforeWithdraw = await web3.eth.getBalance(wallet.address)
    console.log("balanceWalletBeforeWithdraw", balanceWalletBeforeWithdraw)

    let res = await buffer.withdraw(BUFFER_ADDRESS)
    console.log(res)

    let balanceFinal = await web3.eth.getBalance(BUFFER_ADDRESS)
    console.log("balanceFinal", balanceFinal)

    let balanceWalletAfterWithdraw = await web3.eth.getBalance(wallet.address)

    console.log("balanceWalletAfterWithdraw", balanceWalletAfterWithdraw)

    assert.equal(balanceAfter * 0.6, balanceFinal)

  })
  it('status for current user', async () => {
    const BUFFER_ADDRESS = "0x66360Caf43A1ee1F1D0A2dc8D0246a86d9522539"
    let status = await buffer.status(BUFFER_ADDRESS)
    for(let key in status) {
      console.log(key, status[key].toString())
    }
  })
  it('status for a specific address', async () => {
    const BUFFER_ADDRESS = "0x66360Caf43A1ee1F1D0A2dc8D0246a86d9522539"
    let status = await buffer.status(
      BUFFER_ADDRESS,
      "0xFb7b2717F7a2a30B42e21CEf03Dd0fC76Ef761E9",
    )
    for(let key in status) {
      console.log(key, status[key].toString())
    }
  })
  it.skip('create', async () => {
    try {
      let res = await buffer.create({
        title: "hello buffer 5",
        members: [{
          account: "0xFb7b2717F7a2a30B42e21CEf03Dd0fC76Ef761E9",
          value: 5 
        }, {
          account: "0x73316d4224263496201c3420b36Cdda9c0249574",
          value: 2 
        }]
      })
      console.log("res", res)
    } catch (e) {
      console.log("ERRROR", e)
    }
  })
});
