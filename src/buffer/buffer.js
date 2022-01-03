const factory_abi = require('./abi/factory.js')
const stream_abi = require('./abi/stream.js')
const ipfsh = require('ipfsh')
const axios = require('axios')
const constants = require("./constants")
const Merklescript = require('merklescript')
const factory_address = constants.factory.rinkeby
class Stream {
  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //  const stream = new Stream({
  //   web3: new Web3(window.ethereum),
  //   key: privateKey
  //  })
  //
  constructor(o) {
    this.microipfs: o.microipfs;
    this.web3 = o.web3;
    this.key = o.key;
    this.factory = new this.web3.eth.Contract(factory_abi, factory_address);
  }
  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //    await stream.create("testing", [{
  //      account: addr1,
  //      value: 1
  //    }, {
  //      account: addr2,
  //      value: 3
  //    }, {
  //      account: addr3,
  //      value: 6
  //    }]
  //
  async create(o) {
    let { name, members } = o
    let total = 0;
    for(let member of members) {
      total += member.value
    }
    let values = members.map((member) => {
      return [
        member.account,
        Math.floor((member.value / total) * Math.pow(10, 12))
      ]
    })

    // convert to merkle tree
    const s = {
      types: ["address", "uint256"],
      values: values
    }
    const script = new Merklescript(s)
    const root = script.root()

    // store merkle tree on IPFS
    let cid = await fetch("https://microipfs.com/add", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object: { merklescript: s }
      })
    }).then((r) => {
      return r.json()
    }).then((r) => {
      return r.success
    })
    let cidDigest = ipfsh.ctod(cid)

    let account
    if (this.key) {
      let wallet = this.web3.eth.accounts.privateKeyToAccount("0x" + this.key)
      account = this.wallet.address
    } else {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      let _res = await this.web3.eth.getAccounts()
      account = _res[0];
    }

    let tx = await factory.methods.genesis(name, root, cidDigest).send({
      from: account
    })
    let address = tx.events.ContractDeployed.returnValues.group
    return { tx, address }
  }
  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let members = await stream.get("0x05A9c70d7827c936c96896Da36676E81C878BFF0")
  //
  async get(address) {
    let contract = new this.web3.eth.Contract(stream_abi, address);
    let members = await contract.methods.members().call()
    return members
  }
}
module.exports = Stream
