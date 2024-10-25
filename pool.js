const { Contract, Web3 } = require('web3');
const moment = require('moment-timezone');
const Routerv2 = require('./v2');
const Routerv3 = require('./v3');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

const web3 = new Web3('wss://mainnet.infura.io/ws/v3/6e6a3c3e676b4ab1ad7a7126b70169e9');

let v2 = new Routerv2(web3, processSwapEvent)
let v3 = new Routerv3(web3, processSwapEvent)

const timeZone = 'Asia/Shanghai';
// SQLite database
const db = new sqlite3.Database('./uniswap_trades1.db');

// 初始化数据库
db.run(`CREATE TABLE IF NOT EXISTS freq_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    token1 TEXT,
    token1Name TEXT,
    amount0 TEXT,
    amount1 TEXT,
    tx TEXT UNIQUE,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);


async function subscribeToNewBlocks() {
    const subscription = await web3.eth.subscribe('newBlockHeaders');
    subscription.on('data', handleNewBlock);
}
async function handleNewBlock(blockHeader) {
    // console.log(`Got new block: ${blockHeader.number}`);
    const block = await web3.eth.getBlock(blockHeader.number, true);
    block.transactions.forEach((tx) => {
        v2.doit(tx);
        v3.doit(tx)
    })
}

async function processSwapEvent(tx, sender, token1, token1Name, amount0, amount1) {
    if (amount1 < '0.3') return
    const currentTime = moment.tz(timeZone).format('YYYY-MM-DD HH:mm:ss');
    db.run(`INSERT INTO freq_trades (tx,sender,token1,token1Name, amount0, amount1,timestamp) VALUES (?,?, ?, ?, ?, ?,?)`,
        [tx, sender, token1, token1Name, amount0, amount1, currentTime],
        function (err) {
            if (err) {
                console.error("Database insert error:", err);
            }
        });
}

async function findNew() {
    setInterval(function () {
        _findNew()
    }, 20000)
}

function _findNew() {
    const currentTime = moment.tz(timeZone).subtract(5, 'minutes').format('YYYY-MM-DD HH:mm:ss');
    db.each("select token1,token1Name,count(token1) as cnt from freq_trades where timestamp > ? group by token1 HAVING cnt > 5 ORDER BY cnt desc", [currentTime], (err, row) => {
        console.log(row.cnt, row.token1, row.token1Name);
        bot.sendMessage('@chaisiye111', `${row.token1Name}\n${row.token1}\n${row.cnt}次`);
    });
}

subscribeToNewBlocks();
findNew();