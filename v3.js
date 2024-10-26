const fs = require('fs');
const excludes = ["USDT", "USDC", "WBTC"]
const ERC20_ABI = JSON.parse(fs.readFileSync("./abi/erc20.json"), "utf8");
class RouterV3 {
    constructor(web3, cache, callback) {
        this.web3 = web3
        this.cache = cache;
        this.callback = callback;
    }

    doit(tx) {
        if (tx.to && tx.to.toLowerCase() == '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD'.toLowerCase()) {
            // let value = web3.utils.fromWei(tx.value, "ether")

            // web3.eth.getCode(tx.to).then((message) => {
            // let isContract = message
            // if (isContract != "0x") {
            console.log("-----------------------------------------------------")
            // console.log(`Incoming swap transaction: ${tx.hash}`);
            // console.log(`From: ${tx.from},From: ${tx.to} transaction: ${tx.hash}`);
            this.handleRouter(tx)
            // console.log("-----------------------------------------------------")
            // }
            // console.log(message);	// 성공(resolve)한 경우 실행
            // })

        }
    }
    async getTokenName(address) {
        let cached = this.cache.get(`name-${address}`);
        let tokenName;
        if (!cached) {
            const erc20 = new this.web3.eth.Contract(ERC20_ABI, address);
            tokenName = await erc20.methods.symbol().call()
            console.log(tokenName, address)
            this.cache.set(`name-${address}`, tokenName)
        }
        return this.cache.get(`name-${address}`)
    }
    async handleRouter(tx) {
        if (tx.input.length < 1500) return;
        let method = tx.input.substring(266, 274)
        let coin, value;
        // https://etherscan.io/tx/0x060c1d6b9d7a9502b72cbe9f3037f7b45765bd5b47f5f8020cd31f3fc4fcdf1c
        if (method == '0b000604') {
            coin = tx.input.substring(1336, 1376)
            value = this.web3.utils.fromWei(tx.value, "ether")
        }
        if (method == '0b080604') {
            coin = tx.input.substring(1378, 1418)
            value = this.web3.utils.fromWei(tx.value, "ether")
        }
        if (coin) {
            try {
                let address = `0x${coin}`
                const tokenName = await this.getTokenName(address)
                if (!excludes.includes(tokenName)) {
                    await this.callback(tx.hash, tx.from, address, tokenName, 0, value)
                }
            } catch (ex) {
                console.log(tx.hash)
                console.log(ex)
            }
        }
    }
}

module.exports = RouterV3