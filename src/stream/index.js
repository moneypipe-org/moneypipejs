const factory_abi = require('./abi/factory.js')
const stream_abi = require('./abi/stream.js')
const ipfsh = require('ipfsh')
const axios = require('axios')
const constants = require("./constants")
const Merklescript = require('merklescript')
class stream {
  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //  # In the browser
  //  const stream = new Stream({
  //    web3: new Web3(window.ethereum),
  //    network: "rinkeby",
  //  })
  // 
  //  # Node.js
  //  const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
  //  const stream = new Stream({
  //    key: privateKey,
  //    web3: createAlchemyWeb3(API_URL)
  //  })
  //
  ////////////////////////////////////////////////////////////////////////////////////////
  constructor(o) {
    this.web3 = o.web3;
    this.key = o.key;
    this.network = (o.network ? o.network : "main");
    this.abi = {
      factory: factory_abi,
      stream: stream_abi
    }
    this.factory = new this.web3.eth.Contract(factory_abi, constants.factory[this.network])
    this.constants = constants
  }
  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let groups = await stream.groups(owner_address)
  //
  ////////////////////////////////////////////////////////////////////////////////////////
  async groups(account) {
    await this.checkNetwork()
    if (!account) account = await this.current_account()
    const factory = new this.web3.eth.Contract(factory_abi, constants.factory[this.network])
    let logs = await factory.getPastEvents("ContractDeployed", {
      filter: { owner: account },
      fromBlock: 0,
      toBlock  : "latest",
    })
    return logs.map((log) => {
      return {
        owner: log.returnValues.owner,
        group: log.returnValues.group,
        title: log.returnValues.title
      }
    })
  }
  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let group = await stream.get(stream_address)
  //
  ////////////////////////////////////////////////////////////////////////////////////////
  async get(stream_address) {
    await this.checkNetwork()
    const factory = new this.web3.eth.Contract(factory_abi, constants.factory[this.network])
    let logs = await factory.getPastEvents("ContractDeployed", {
      filter: { group: stream_address },
      fromBlock: 0,
      toBlock  : "latest",
    })
    if (logs.length > 0) {
      return {
        owner: logs[0].returnValues.owner,
        group: logs[0].returnValues.group,
        title: logs[0].returnValues.title
      }
    } else {
      throw new Error("stream does not exist at " + stream_address)
    }
  }
  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //    await stream.create({
  //      title: "testing",
  //      members: [{
  //        account: addr1,
  //        value: 1
  //      }, {
  //        account: addr2,
  //        value: 3
  //      }, {
  //        account: addr3,
  //        value: 6
  //      }]
  //    })
  //
  ////////////////////////////////////////////////////////////////////////////////////////
  async create(o) {
    await this.checkNetwork()
    let { title, members } = o
    // update total
    let total = 0;
    for(let member of members) {
      total += member.value
    }
    for(let i=0; i<members.length; i++) {
      members[i].total = total 
    }
    const factory = new this.web3.eth.Contract(factory_abi, constants.factory[this.network])
    if (this.key) {
      let wallet = this.web3.eth.accounts.privateKeyToAccount("0x" + this.key)
      let action = factory.methods.genesis(title, members)
      let data = action.encodeABI()
      let o = {
        from: wallet.address,
        to: factory.address,
        data: data,
      }
      let estimate = await action.estimateGas(o)
      o.gas = estimate
      const signedTx = await wallet.signTransaction(o)
      let tx = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      let address = this.web3.eth.abi.decodeParameter('address', tx.logs[0].topics[2])
      return { tx, address }
    } else {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      let accounts = await this.web3.eth.getAccounts()
      let tx = await factory.methods.genesis(title, members).send({ from: accounts[0] })
      let address = tx.events.ContractDeployed.returnValues.group
      return { tx, address }
    }
  }
  ////////////////////////////////////////////////////////////////////////////////////////
  //
  //    let members = await stream.members("0x05A9c70d7827c936c96896Da36676E81C878BFF0")
  //
  ////////////////////////////////////////////////////////////////////////////////////////
  async members(address) {
    await this.checkNetwork()
    let contract = new this.web3.eth.Contract(stream_abi, address);
    let members = await contract.methods.members().call()
    return members.map((member) => {
      return {
        account: member.account,
        value: parseInt(member.value),
        total: parseInt(member.total)
      }
    })
  }
  async checkNetwork() {
    let net = await this.web3.eth.net.getNetworkType()
    if (net !== this.network) {
      throw new Error(`Please sign into ${this.network} network`)
    }
  }
  async current_account() {
    if (this.key) {
      const wallet = this.web3.eth.accounts.privateKeyToAccount("0x" + this.key)
      return wallet.address;
    } else {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const accounts = await this.web3.eth.getAccounts()
      return accounts[0]
    }
  }
}
module.exports = stream
