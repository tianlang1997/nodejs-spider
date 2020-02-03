const cheerio = require('cheerio');
const request = require('request');
const async = require('async');
const SpiderCache = require('./lib/cache').SpiderCacheInstance;
const MutilProcess = require('./lib/mutilProcess').MutilProcess;
const fs = require('fs');
const puppeteer = require('puppeteer');
// import * as puppeteer from "puppeteer"


var options = {
    url: "https://www.smzdm.com/jingxuan/xuan/s0f1515t0b0d0r0p4/",
    method: 'GET',
    charset: "utf-8",
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.93 Safari/537.36"
    }
};

const userAgents = [
    'Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9.0.8) Gecko Fedora/1.9.0.8-1.fc10 Kazehakase/0.5.6',
    'Opera/9.80 (Macintosh; Intel Mac OS X 10.6.8; U; fr) Presto/2.9.168 Version/11.52',
    'Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9.0.8) Gecko Fedora/1.9.0.8-1.fc10 Kazehakase/0.5.6',
    'Mozilla/5.0 (X11; U; Linux; en-US) AppleWebKit/527+ (KHTML, like Gecko, Safari/419.3) Arora/0.6',
    'Opera/9.25 (Windows NT 5.1; U; en), Lynx/2.8.5rel.1 libwww-FM/2.14 SSL-MM/1.4.1 GNUTLS/1.2.9',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
    'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18363'
];

function ScrapeDataByRequest(url, IPPool, callback) {
    options.url = url
    let index_ua = Math.ceil(Math.random() * userAgents.length)
    options.headers['User-Agent'] = userAgents[index_ua];
    if (IPPool) {
        let index_ip = Math.ceil(Math.random() * IPPool.length)
        if (IPPool[index_ip]) {
            options.host = IPPool[index_ip][0]
            options.port = IPPool[index_ip][1]
        }
    }

    request(options, function (err, response, body) {
        if (err) {
            callback(err)
        } else {
            if (body.indexOf("浏览器版本过低") != -1) {
                console.log("浏览器版本过低:", userAgents[index_ua - 1])
            }
            const $ = cheerio.load(body);
            callback(null, $)
        }
    })
}

function GetIPPool(callback) {
    let cache = SpiderCache
    let key = "IPPool"
    cache.get(key, (err, ret) => {
        if (err || !ret) {
            ScrapeDataByRequest("https://www.xicidaili.com/", null, (err, ret) => {
                let $ = ret
                let data = []
                let liArr = $("tr.odd")
                liArr.each(function (i, elem) {
                    let ip = $(elem).find('td').eq(1).html()
                    if (ip && ip.split('.').length == 4) {
                        let port = $(elem).find('td').eq(2).html()
                        data.push([ip, port])
                    }
                })
                cache.set(key, data, () => {
                    callback(null, data)
                })
            })
        } else {
            callback(null, ret);
        }
    })
};

function ZhiDeMai(callback) {
    //接下来就是对数据的处理了，jquery怎样操作，你就怎么操作
    async.waterfall([(cb) => {
        GetIPPool(cb)
    }, (IPPool, cb) => {
        let baseUrl = 'https://www.smzdm.com/jingxuan/xuan/s0f1515t0b0d0r0p'
        let jobList = []
        for (let i = 1; i <= 80; ++i) {
            jobList.push({ msg: baseUrl + i + '/', handle: doJob })
        }
        lib.MutilProcess(jobList, { MemoryLimit: 100 * 1024 * 1024, CpuLimit: 1, ErrorInterrupt: true }, (err, ret) => {
            if (err) {
                cb(err)
            } else {
                let statistics = {}
                let date = ''
                for (let i = 0, len = ret.length; i < len; ++i) {
                    let p = ret[i]
                    for (let j = 0; j < p.length; ++j) {
                        let timeArr = p[j].split(' ')
                        if (timeArr.length == 1) {
                            date = 'toDay'
                        } else {
                            date = timeArr[0]
                        }
                        if (!statistics[date])
                            statistics[date] = 0
                        statistics[date]++
                    }
                }
                console.log(statistics)
                cb(null, statistics)
            }
        })

        function doJob(url, doJobbCallback) {
            ScrapeDataByRequest(url, IPPool, (err, ret) => {
                let $ = ret
                let data = []
                let liArr = $("span.feed-block-extras")
                liArr.each(function (i, elem) {
                    let time = $(elem).text().split('\n')[1].replace(/^\s+|\s+$/g, "")
                    data.push(time)
                })
                doJobbCallback(err, data);
            })
        }
    }], (err, ret) => {
        callback(err, ret);
    })
}

// 完全模拟浏览器，解决自动跳转问题，如果需要，可以加入自动输入验证码功能
function scrapeDataByPuppeteer(url, callback) {
    scrape(url).then((value) => {
        console.log(JSON.stringify(value))
        callback(null, value);
    });
}

// async function scrape(url) {
//     const browser = await puppeteer.launch({
//         headless: true,
//         args: [
//             '–disable-gpu',
//             '–disable-dev-shm-usage',
//             '–disable-setuid-sandbox',
//             '–no-first-run',
//             '–no-sandbox',
//             '–no-zygote',
//             '–single-process'
//         ]
//     });

//     var page = await browser.newPage();
//     let cookieFile = fs.readFileSync('./cookie').toString()
//     let cookieItemArr = cookieFile.split('\n')
//     let cookies = []
//     for (let i = 0; i < cookieItemArr.length; ++i) {
//         let line = cookieItemArr[i].split("\t")
//         let cookie = { "name": line[0], "value": line[1], "domain": line[2], "path": line[3] }
//         if (line[6]) {
//             cookie.httpOnly = true
//         }
//         if (line[7]) {
//             cookie.secure = true
//         }
//         cookies.push(cookie)
//     }
//     await page.setCookie(...cookies)
//     await page.goto(url); //https://www.smzdm.com/jingxuan/ https://www.smzdm.com/p/17886827 'https://www.smzdm.com/jingxuan/xuan/s0f1515t0b0d0r0p4/'
//     // await page.setViewport({
//     //     width: 1200,
//     //     height: 800
//     // });
//     await page.waitFor(7000)
//     await page.screenshot({ path: 'tb.png' });
//     const result = await page.evaluate(() => {
//         let src = ""
//         if (document.querySelectorAll("video")[0]) src = document.querySelectorAll("video")[0].currentSrc
//         return {
//             src: src,
//         }
//     })
//     browser.close();
//     return result;
// };
ZhiDeMai((err,ret)=>{
    console.log(err,ret)
})