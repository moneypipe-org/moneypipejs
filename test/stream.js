require('dotenv').config()
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const Moneypipe = require("../index")
const assert = require('assert');
const web3 = createAlchemyWeb3(process.env.RINKEBY)
const stream = new Moneypipe.stream({
  key: process.env.RINKEBY_PRIVATE_KEY,
  web3: web3
})
describe('stream', function() {
  it('get', async () => {
    let members = await stream.members("0x05A9c70d7827c936c96896Da36676E81C878BFF0")
    console.log("members = ", members)
  })
  it('create', async () => {
    try {
      let res = await stream.create({
        title: "hello world",
        members: [{
          account: "0xFb7b2717F7a2a30B42e21CEf03Dd0fC76Ef761E9",
          value: 1
        }, {
          account: "0x73316d4224263496201c3420b36Cdda9c0249574",
          value: 1
        }]
      })
      console.log("res", res)
    } catch (e) {
      console.log("ERRROR", e)
    }
  })
});
