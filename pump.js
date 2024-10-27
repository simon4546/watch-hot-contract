let { WebSocket } = require("ws")
const moment = require('moment-timezone');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const TOKEN = process.env.TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

const db = new sqlite3.Database('./pump.db');
// 初始化数据库
db.run(`
    CREATE TABLE IF NOT EXISTS pumptoken (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT,
        token TEXT UNIQUE,
        tokenName TEXT,
        followers INTEGER,
        tokenSymbol TEXT,
        cnt INTEGER,
        scnt INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);
const timeZone = 'Asia/Shanghai';
const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', function open() {
    let payload = {
        method: "subscribeNewToken",
    }
    ws.send(JSON.stringify(payload));
});

ws.on('message', function message(data) {
    data = JSON.parse(data);
    if (!data.mint) return
    let tokenaddr = data.mint;
    let tokenName = data.name;
    let tokenSymbol = data.symbol;
    let creator = data.traderPublicKey;
    console.log("SOL", data.vSolInBondingCurve, data.marketCapSol)
    const currentTime = moment.tz(timeZone).format('YYYY-MM-DD HH:mm:ss');
    db.run(`INSERT INTO pumptoken (sender,token,tokenName,tokenSymbol, cnt,timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
        [creator, tokenaddr, tokenName, tokenSymbol, -1, currentTime],
        function (err) { });
});
function apiFunctionWrapper() {
    let unread = [];
    return new Promise((resolve, reject) => {
        db.each("select * from pumptoken where cnt=-1 or cnt is null order by id desc limit 1", [], (err, row) => {
            if (err) { reject(err) };
            unread.push([row.sender, row.token])
        }, function (err, result) {
            if (err) { reject(err) };
            resolve(unread);
        });
    });
}
async function getfromedb() {
    let unread = [];
    unread = await apiFunctionWrapper()
    for (let index = 0; index < unread.length; index++) {
        const element = unread[index];
        await getProfile(element)
        await sleep(1000)
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function getProfile(sender) {
    try {
        let url = `https://frontend-api.pump.fun/coins/user-created-coins/${sender[0]}?offset=0&limit=20&includeNsfw=false`
        let response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        result = await response.json();
        let lens = result.length;
        let success_count = result.filter((item, idx) => item.complete == true).length
        url = `https://frontend-api.pump.fun/following/followers/${sender[0]}`
        response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        result = await response.json();
        let followers = result.length;
        if (followers > 80 && success_count > 0) {
            bot.sendMessage('@chaisiye111', `发币次数${lens}\n成功次数:${success_count}\n粉丝数${followers}\n合约地址:${sender[1]}`);
        }
        db.run(`UPDATE pumptoken set cnt=?,followers=?,scnt=? where sender=? and ( cnt=-1 or cnt is null )`,
            [lens, followers, success_count, sender[0]],
            function (err) { });
    } catch (ex) {
        console.log(ex)
    }
}

(async function () {
    while (true) {
        await getfromedb()
    }
})()