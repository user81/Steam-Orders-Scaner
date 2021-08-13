let errorPauseSET = 5; //pause time during error
let scanIntervalSET = 6000; //time between requests
coefficient = 0.35; //price coefficient
startScan();

async function startScan() {

    var arrMyPriceLink = [];
    let myListings = JSON.parse(await failRetryHttpGet("https://steamcommunity.com/market/mylistings/?norender=1"));
    var orderListJson = myListings.buy_orders;
    let marketItems = document.getElementsByClassName("market_listing_row market_recent_listing_row");
    let orderList = [];
    for (let marketItem of marketItems) {
        if (marketItem.id.includes("mybuyorder_") && window.getComputedStyle(marketItem).display === "block") {
            orderList.push(marketItem);
        }
    }
    if (orderList.length > 0) {
        for (let index = 0; index < orderList.length; index++) {
            let orderlink = orderList[index].getElementsByClassName('market_listing_item_name_link')[0].href;
            let orderprice = +orderList[index].getElementsByClassName('market_listing_price')[0].innerText.match(/([0-9]*\.[0-9]+|[0-9]+)/g);
            arrMyPriceLink.push([orderprice, orderlink]);
        }
    } else {
        return false;
    }

    if (orderListJson.length > 0 && orderListJson.length === arrMyPriceLink.length) {
        for (let orderKey = 0; orderKey < orderListJson.length; orderKey++) {
            var appId = orderListJson[orderKey].appid;
            var buyOrderId = orderListJson[orderKey].buy_orderid;
            var hashName = orderListJson[orderKey].hash_name;
            /* var orderHref = `https://steamcommunity.com/market/listings/${appId}/${hashName}`; */
            var orderHref = arrMyPriceLink[orderKey][1];
            var orderPrice = arrMyPriceLink[orderKey][0];
            let sourceCode = await failRetryHttpGet(orderHref);
            let item_id = sourceCode.match(/Market_LoadOrderSpread\(\s*(\d+)\s*\);/)["1"];
            let priceJSON = JSON.parse(await httpGet('https://steamcommunity.com/market/itemordershistogram?country=RU&language=russian&currency=1&item_nameid=' + item_id + '&two_factor=0'));
            InterVal(priceJSON.sell_order_graph, priceJSON.buy_order_graph, +buyOrderId, orderPrice); 
            await new Promise(done => timer = setTimeout(() => done(), scanIntervalSET));
        }
    }
}

async function failRetryHttpGet(url, attempts = 5) {
    return await httpGet(url).catch(async function () {
        if (attempts == 5) {
            await wait(5000);
            return failRetryHttpGet(url, attempts - 1);
        } else if (attempts <= 0) {
            await wait(errorPauseSET * 60000);
            return failRetryHttpGet(url, attempts = 5);
        }
        await wait(10000);
        return failRetryHttpGet(url, attempts - 1);
    });
}

async function wait(ms) {
    return new Promise(resolve => {
        banTimer = setTimeout(resolve, ms);
    });
}

function httpGet(url) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onload = function () {
            if (this.status == 200) {
                resolve(this.response);
            } else {
                var error = new Error(this.statusText);
                error.code = this.status;
                reject(error);
            }
        };
        xhr.onerror = function () {
            reject(new Error("Network Error"));
        };
        xhr.send();
    });
}


function InterVal(JSONsell_order_graph ,JSONbuy_order_graph, buyOrderId, MyBuyOrderPrice) {  
    let style= `
    <style>
    .list{
        border: 4px double #00dbff;
        display: inline-flex;
        padding: 2px;
    }
    </style>
    `;

    let sellPriceList = "<br> Sell Price<br>";
    let buyPriceList = "<br> Buy Price<br>";
    let currentOrder = document.querySelector(' [id ="mybuyorder_'+ buyOrderId + '"]');

    for (let sellPriceKey = 0; sellPriceKey < JSONsell_order_graph.length; sellPriceKey++ ) {
        sellPriceList +=  selectedMyOrder(JSONsell_order_graph[sellPriceKey]);  
    }
    for (let buyPriceKey = 0; buyPriceKey < JSONbuy_order_graph.length; buyPriceKey++) {
        buyPriceList += selectedMyOrder (JSONbuy_order_graph[buyPriceKey], MyBuyOrderPrice);  
    }
    console.log(JSONsell_order_graph);
    let actualProfit ='<br> Actual Profit: '+ (JSONsell_order_graph[0][0] - 0.01 - JSONbuy_order_graph[0][0] - ((JSONsell_order_graph[0][0] - 0.01) * 0.13)).toFixed(2);
    let myProfit ='<br> My Profit: '+ (JSONsell_order_graph[0][0] - 0.01 - MyBuyOrderPrice - ((JSONsell_order_graph[0][0] - 0.01) * 0.13)).toFixed(2);
    let coefPrice = (JSONbuy_order_graph[0][0] * coefficient).toFixed(2);
    let MycoefPrice = (MyBuyOrderPrice * coefficient).toFixed(2);
    let prices = style+ sellPriceList + buyPriceList + actualProfit + ' Actyal Coefficient Price: '+ coefPrice +  myProfit + ' My Coefficient Price: '+ MycoefPrice;
    var div = document.createElement("DIV");
    div.style.cssText = Color(JSONbuy_order_graph, MyBuyOrderPrice, actualProfit, myProfit, coefPrice, MycoefPrice);

    div.innerHTML = prices;
    currentOrder.appendChild(div);
}

function selectedMyOrder (JSON_order_graph, MyBuyOrderPrice ) { 
    if (JSON_order_graph.includes(MyBuyOrderPrice)) {
        return `
        <div class="list" style="color: red;"> 
        <b>$` + JSON_order_graph[0] + `</b> | ` + JSON_order_graph[1] + 
        `</div>`;    
    }
    return `
    <div class="list"> 
    <b>$` + JSON_order_graph[0] + `</b> | ` + JSON_order_graph[1] + 
    `</div>`;
    
}

function Color (JSONbuy_order_graph, MyBuyOrderPrice, actualProfit, myProfit, coefPrice, MycoefPrice) {
    if (JSONbuy_order_graph[0][0] == MyBuyOrderPrice  && actualProfit >= coefPrice ) {
        return  'white-space: initial; background-color: #136f00;'; //green
    }else if(JSONbuy_order_graph[0][0] != MyBuyOrderPrice  && actualProfit >= coefPrice){
        return 'white-space: initial; background-color: #9c9b00;'; //yelow
    }else if(JSONbuy_order_graph[0][0] != MyBuyOrderPrice  && myProfit >= MycoefPrice){
        return 'white-space: initial; background-color: #44007c;'; //violet
    }else{
        return 'white-space: initial; background-color: #6f0012;'; //red
    }
}



scanIntervalSET = 5000;
let sourceCode = await failRetryHttpGet('https://steamcommunity.com/market/listings/753/553210-Chaos%20Sorcerer%20%28Foil%29');
let item_id = sourceCode.match(/Market_LoadOrderSpread\(\s*(\d+)\s*\);/)["1"];
let priceJSON = JSON.parse(await httpGet('https://steamcommunity.com/market/itemordershistogram?country=RU&language=russian&currency=1&item_nameid=' + item_id + '&two_factor=0'));
await new Promise(done => timer = setTimeout(() => done(), scanIntervalSET));
async function failRetryHttpGet(url, attempts = 5) {
    return await httpGet(url).catch(async function () {
        if (attempts == 5) {
            await wait(5000);
            return failRetryHttpGet(url, attempts - 1);
        } else if (attempts <= 0) {
            await wait(8 * 60000);
            return failRetryHttpGet(url, attempts = 5);
        }
        await wait(10000);
        return failRetryHttpGet(url, attempts - 1);
    });
}

async function wait(ms) {
    return new Promise(resolve => {
        banTimer = setTimeout(resolve, ms);
    });
}

function httpGet(url) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onload = function () {
            if (this.status == 200) {
                resolve(this.response);
            } else {
                var error = new Error(this.statusText);
                error.code = this.status;
                reject(error);
            }
        };
        xhr.onerror = function () {
            reject(new Error("Network Error"));
        };
        xhr.send();
    });
}




