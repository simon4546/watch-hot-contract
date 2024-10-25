const fs = require('fs');
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const UNISWAP_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const SWAP_EXACT_ETH_FOR_TOKENS_SIGNATURE = "0x7ff36ab5";
const SWAP_EXACT_ETH_OR_TOKENS_SUPPORTING_FEE_ON_TRANSFER_TOKENS_SIGNATURE = "0xb6f9de95";
const SWAP_EXACT_TOKENS_FOR_TOKENS_SUPPORTING_FEE_ON_TRANSFER_TOKENS_SIGNATURE = "0x5c11d795";


const UNISWAP_ROUTER_ABI = JSON.parse(fs.readFileSync("./abi/router.json"), "utf8");
const ERC20_ABI = JSON.parse(fs.readFileSync("./abi/erc20.json"), "utf8");



class RouterV2 {
    constructor(web3, callback) {
        this.contract = new web3.eth.Contract(UNISWAP_ROUTER_ABI, UNISWAP_ROUTER_ADDRESS);
        this.web3 = web3
        this.callback = callback;
    }

    doit(tx) {
        if (tx.to && tx.to.toLowerCase() === UNISWAP_ROUTER_ADDRESS.toLowerCase() && (
            tx.input.startsWith(SWAP_EXACT_ETH_FOR_TOKENS_SIGNATURE) ||
            tx.input.startsWith(SWAP_EXACT_ETH_OR_TOKENS_SUPPORTING_FEE_ON_TRANSFER_TOKENS_SIGNATURE) ||
            tx.input.startsWith(SWAP_EXACT_TOKENS_FOR_TOKENS_SUPPORTING_FEE_ON_TRANSFER_TOKENS_SIGNATURE)
        )) {
            console.log("-----------------------------------------------------")
            console.log(`Incoming swap transaction: ${tx.hash}`);
            console.log(`From: ${tx.from}`);

            this.handleRouter(tx)
            console.log("-----------------------------------------------------")
        }
    }

    async handleRouter(tx) {
        const decoded = this.contract.decodeMethodData(tx.input);
        const tokenAddress = decoded.path.at(-1)
        const token0Address = decoded.path.at(0)
        const method = decoded.__method__
        let value = this.web3.utils.fromWei(tx.value, "ether")
        const erc20 = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
        const tokenName = await erc20.methods.symbol().call()
        if (method.startsWith('swapExactETHForTokens') || method.startsWith('swapExactETHForTokensSupportingFeeOnTransferTokens')) {
            console.log(method, value, tokenAddress, tokenName);
            await this.callback(tx.hash, tx.from, tokenAddress, tokenName, 0, value)
        }
        if (method.startsWith('swapExactTokensForTokensSupportingFeeOnTransferTokens') && tokenName != "WETH") {
            value = web3.utils.fromWei(decoded.amountIn, "ether")
            console.log(method, tokenAddress, tokenName);
            await this.callback(tx.hash, tx.from, tokenAddress, tokenName, 0, value)
        }
    }
}

module.exports = RouterV2