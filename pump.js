let { WebSocket } = require("ws")
const moment = require('moment-timezone');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./pump.db');
// 初始化数据库
db.run(`
    CREATE TABLE IF NOT EXISTS pumptoken (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT,
        token TEXT UNIQUE,
        tokenName TEXT,
        followers TEXT,
        tokenSymbol TEXT,
        cnt TEXT,
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
    const currentTime = moment.tz(timeZone).format('YYYY-MM-DD HH:mm:ss');
    db.run(`INSERT INTO pumptoken (sender,token,tokenName,tokenSymbol, cnt,timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
        [creator, tokenaddr, tokenName, tokenSymbol, -1, currentTime],
        function (err) { });
});
function apiFunctionWrapper() {
    let unread = [];
    return new Promise((resolve, reject) => {
        db.each("select * from pumptoken where cnt=-1 or cnt is null limit 1", [], (err, row) => {
            if (err) { reject(err) };
            unread.push(row.sender)
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
        let url = `https://frontend-api.pump.fun/coins/user-created-coins/${sender}?offset=0&limit=10&includeNsfw=false`
        let response = await fetch(url)
        result = await response.json();
        let lens = result.length;

        url = `https://frontend-api.pump.fun/following/followers/${sender}`
        response = await fetch(url)
        result = await response.json();
        let followers = result.length;

        db.run(`UPDATE pumptoken set cnt=?,followers=? where sender=?`,
            [lens, followers, sender],
            function (err) { });
    } catch (ex) { }
}

(async function () {
    while (true) {
        await getfromedb()
    }
})()