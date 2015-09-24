'use strict';

var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var assert = require('assert');
var app = express();
var Q = require('q');
var stockObject = require('stockHistoricalData');
var parseCredentials = require('parseCredentials');

// Parse library
var Parse = require('parse/node').Parse;

// Use external file for credentials so they can be hidden from Git
Parse.initialize(parseCredentials.appId, parseCredentials.clientKey);

// Abstract finance parser class
function FinanceParser() {
    if (!(this instanceof FinanceParser)) {
        return new FinanceParser();
    }

    this.createUrl = function (symbol) {
        return undefined;
    };

    this.parse = function (html) {
        return undefined;
    };
}

FinanceParser.prototype.provider = undefined;

// Parsing helper class
var financeParserHelper = {
    createFinanceParser: function (provider) {
        var parser;

        if (!provider) {
            parser = new FinanceParser();
        } else if (provider === GoogleFinanceParser.prototype.provider) {
            parser = new GoogleFinanceParser();
        } else {
            parser = new FinanceParser();
        }

        return { createUrl: parser.createUrl, parse: parser.parse, provider: GoogleFinanceParser.prototype.provider };
    },
    createFinanceDataObject: function (symbol, name, rangeLow, rangeHigh, fiftytTwoWeekRangeLow, fiftyTwoWeekRangeHigh, marketCap, PE, dividends, dividendYield, EPS) {
        var data = Object.create(null);

        if (!arguments || !arguments.length || arguments.length === 0) {
            data.symbol = undefined;
            data.name = undefined;
            data.range = { low: undefined, high: undefined };
            data.fiftyTwoWeekRange = { low: undefined, high: undefined };
            data.marketCap = undefined;
            data.priceToEarningsRatio = undefined;
            data.dividends = undefined;
            data.dividendYield = undefined;
            data.earningsPerShare = undefined;
        } else {
            data.symbol = symbol.toUpperCase();
            data.name = name;
            data.range = { low: rangeLow, high: rangeHigh };
            data.fiftyTwoWeekRange = { low: fiftyTwoWeekRangeLow, high: fiftyTwoWeekRangeHigh };
            data.marketCap = marketCap >>> 0;
            data.priceToEarningsRatio = PE;
            data.dividends = dividends;
            data.dividendYield = dividendYield;
            data.earningsPerShare = EPS;
        }

        return data;
    }
};

// Google finance parser object
function GoogleFinanceParser() {
    if (!(this instanceof GoogleFinanceParser)) {
        return new GoogleFinanceParser();
    }

    this.createUrl = function (symbol) {
        return 'https://www.google.com/finance?q=' + symbol;
    };

    this.parse = function (html) {
        // Check to see that HTML results are not empty
        if (html === undefined || html === null) {
            throw new Error("Could not collect HTML data.");
        }
        //assert(html !== undefined && html !== null, "HTML results were empty.");

        var $ = cheerio.load(html);

        // Check to see that parsed HTML is not empty
        if ($ === undefined || $ === null) {
            throw new Error("Could not load HTML data.");
        }
        //assert($ !== undefined && $ !== null, "Could not extract the company name header.");

        // Delcare values to be collected
        var values = financeParserHelper.createFinanceDataObject();

        // Get company name
        $('#companyheader').filter(function () {
            var header = $('h3', $(this));

            // Check to see that company market data table can be found
            if (header === undefined) {
                console.log("header: epx");
                throw new Error("Could not extract the company name header.");
            }
            //assert(header != undefined, "Could not extract the company name header.");

            values.name = header.text().trim();

            // Check to see that company name was found
            if (values.name === undefined || !values.name.length || values.name.length === 0) {
                throw new Error("Could not extract company name.");
            }
            //assert(values.name != undefined && values.name.length && values.name.length > 0, "Could not extract company name.");
        });

        // Get market data
        $('#market-data-div').filter(function () {
            var table = $('.snap-data', $(this));

            // Check to see that company market data table can be found
            if (table === undefined) {
                throw new Error("Could not extract the market data table.");
            }
            //assert(table != undefined, "Could not extract the market data table.");

            var rows = $('tr', table);

            // Check to see that company market data table rows can be found
            if (rows === undefined || !rows.length || rows.length === 0) {
                throw new Error("Could not extract market data table rows.");
            }
            //assert(rows != undefined && rows.length && rows.length > 0, "Could not extract market data table rows.");

            var rowCount = rows.length;
            var cells;
            var cellValue;

            // Parse market data values
            for (var i = 0; i < rowCount; i++) {
                cells = $('td', rows[i]);

                // Check for available table rows
                if (cells === undefined || !cells.length || cells.length === 0) {
                    throw new Error("Could not extract finance data entries.");
                }

                // Extract cell value
                cellValue = $(cells[1]).text().trim();

                // Check for unavailable value
                if (cellValue === undefined || cellValue === null || cellValue === '' || cellValue === '-') {
                    continue;
                }

                switch ($(cells[0]).text().trim()) {
                    case "Range":
                        cellValue = cellValue.replace(',', '');

                        if (!/^(\d+.\d+) - (\d+.\d+)$/.test(cellValue)) {
                            throw new Error("Range value is not the right format.");
                        }
                        //assert(/^(\d+.\d+) - (\d+.\d+)$/.test(cellValue), "Range value is not the right format.");

                        var match = cellValue.match(/^(\d+.\d+) - (\d+.\d+)$/);
                        values.range.low = parseFloat(match[1]);
                        values.range.high = parseFloat(match[2]);

                        break;
                    case "52 week":
                        cellValue = cellValue.replace(',', '');

                        if (!/^(\d+.\d+) - (\d+.\d+)$/.test(cellValue)) {
                            throw new Error("The 52 week value is not the right format.");
                        }
                        //assert(/^(\d+.\d+) - (\d+.\d+)$/.test(cellValue), "52 week value is not the right format.");

                        var match = cellValue.match(/^(\d+.\d+) - (\d+.\d+)$/);
                        values.fiftyTwoWeekRange.low = parseFloat(match[1]);
                        values.fiftyTwoWeekRange.high = parseFloat(match[2]);

                        break;
                    case "Mkt cap":
                        cellValue = cellValue.replace(',', '');

                        if (!/^(\d*.\d*)([TMB]?)$/.test(cellValue)) {
                            throw new Error("Market cap value is not the right format.");
                        }
                        //assert(/^(\d*.\d*)([TMB]?)$/.test(cellValue), "Market cap value is not the right format.");

                        var match = cellValue.match(/^(\d*.\d*)([TMB]?)$/);
                        var multiplier = 1;

                        if (match[2] === 'B') {
                            multiplier = 1000000000;
                        } else if (match[2] === 'M') {
                            multiplier = 1000000;
                        } else if (match[2] === 'T') {
                            multiplier = 1000;
                        }

                        values.marketCap = (parseFloat(match[1]) * multiplier) >>> 0;

                        break;
                    case "P/E":
                        cellValue = cellValue.replace(',', '');

                        if (!/^-?\d+.\d+$/.test(cellValue)) {
                            throw new Error("The PE value is not the right format.");
                        }
                        //assert(/^-?\d+.\d+$/.test(cellValue), "Market cap value is not the right format.");

                        values.priceToEarningsRatio = parseFloat(cellValue);

                        break;
                    case "Div/yield":
                        cellValue = cellValue.replace(',', '');

                        if (!/^(\d+.\d+)\/(\d+.\d+)$/.test(cellValue)) {
                            throw new Error("Dividend and yield values are not the right format.");
                        }
                        //assert(/^(\d+.\d+)\/(\d+.\d+)$/.test(cellValue), "Dividend and yield values are not the right format.");

                        var match = cellValue.match(/^(\d+.\d+)\/(\d+.\d+)$/);
                        values.dividends = parseFloat(parseFloat(match[1]));
                        values.dividendYield = parseFloat(parseFloat(match[2]));

                        break;
                    case "EPS":
                        cellValue = cellValue.replace(',', '');

                        if (!/^-?\d+.\d+$/.test(cellValue)) {
                            throw new Error("The EPS value is not the right format.");
                        }
                        //assert(/^-?\d+.\d+$/.test(cellValue), "EPS value is not the right format.");

                        values.earningsPerShare = parseFloat(cellValue);

                        break;
                    default:
                        break;
                }
            }
        });

        return values;
    };
}

// Inherit from abstract class
GoogleFinanceParser.prototype = new FinanceParser();
GoogleFinanceParser.prototype.provider = "Google";

// Parse backend manager
var parseFinanceData = {
    StockFinanceData: Parse.Object.extend("stockfinancedata"),
    addEntry: function (values, response) {
        var stockFinanceData = new parseFinanceData.StockFinanceData();

        stockFinanceData.set("symbol", values.symbol.toUpperCase());
        stockFinanceData.set("rangelow", values.range.low);
        stockFinanceData.set("rangehigh", values.range.high);
        stockFinanceData.set("fiftytworangelow", values.fiftyTwoWeekRange.low);
        stockFinanceData.set("fiftytworangehigh", values.fiftyTwoWeekRange.high);
        stockFinanceData.set("marketcap", values.marketCap);
        stockFinanceData.set("priceperearningsratio", values.priceToEarningsRatio);
        stockFinanceData.set("dividend", values.dividends);
        stockFinanceData.set("dividendyield", values.dividendYield);
        stockFinanceData.set("earningspershare", values.earningsPerShare);

        stockFinanceData.save(null, {
            success: function (stockFinanceData) {
                // Execute any logic that should take place after the object is saved.
                console.log("New object created with objectId: " + stockFinanceData.id);

                response();
            },
            error: function (stockFinanceData, error) {
                // Execute any logic that should take place if the save fails.
                // error is a Parse.Error with an error code and message.
                throw new Error("Failed to create new object, with error code: " + error.message);
            }
        });
    },
    removeEntry: function (id) {
        var stockFinanceData = new parseFinanceData.StockFinanceData();
        stockFinanceData.id = id;

        stockFinanceData.destroy({
            success: function () {
                console.log('Deleted object created with objectId: ' + stockFinanceData.id);
            },
            error: function (error) {
                console.log('Failed to delete object created with error: ' + error);
            }
        });

    },
    hasEntry: function (values, response) {
        var query = new Parse.Query(parseFinanceData.StockFinanceData);

        query.equalTo("symbol", values.symbol.toUpperCase());
        query.equalTo("rangelow", values.range.low);
        query.equalTo("rangehigh", values.range.high);
        query.equalTo("fiftytworangelow", values.fiftyTwoWeekRange.low);
        query.equalTo("fiftytworangehigh", values.fiftyTwoWeekRange.high);
        query.equalTo("marketcap", values.marketCap);
        query.equalTo("priceperearningsratio", values.priceToEarningsRatio);
        query.equalTo("dividend", values.dividends);
        query.equalTo("dividendyield", values.dividendYield);
        query.equalTo("earningspershare", values.earningsPerShare);

        query.count({
            success: function (count) {
                // Call the callback function after query has returned results
                response(count);
            },
            error: function (error) {
                // Execute any logic that should take place if the save fails.
                // error is a Parse.Error with an error code and message.
                throw new Error("Failed to create new object, with error code: " + error.message);
            }
        });
    }
};

// Initialize finance provider
var parser = financeParserHelper.createFinanceParser(GoogleFinanceParser.prototype.provider);

// Add node modules to app
app.use('/scripts', express.static(__dirname + '/scripts'));
app.use('/styles', express.static(__dirname + '/styles'));
app.use('/fonts', express.static(__dirname + '/fonts'));

// Load initial page
app.get('/', function (req, res) {
    res.sendfile('default.html');
});

app.get('/stock', function (req, res) {
    // The stock symbol to lookup
    var symbol = req.query.s;

    // Error check for symbol
    if (!symbol || !symbol.length || symbol.length <= 0) {
        try {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');

            res.send({ error: "No stock symbol was provided." });
        } catch (exp) {
            console.log("No stock symbol was provided and error could not be sent to client: " + exp.message);
        }

        return;
    }

    stockObject.once('success', function (data) {
        this.removeAllListeners('error');

        // Parse stock data
        var stockData = this.parseStockData(data);

        try {
            if (stockData.data && stockData.headers) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');

                res.send(stockData);
            } else {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');

                res.send({ error: "Stock data could not be parsed." });
            }
        } catch (exp) {
            console.log("Stock data could not be parsed and error could not be sent to client: " + exp.message);
        }
    });

    stockObject.once('error', function (message) {
        this.removeAllListeners('success');

        try {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');

            res.send({ error: "Stock data could not be retrieved." });
        } catch (exp) {
            console.log("Stock data could not be retrieved and error could not be sent to client: " + exp.message);
        }
    });

    // Collect stock data
    var data = stockObject.getData(symbol, new Date(2008, 1, 1), new Date());
});

// Scrape data and return results
app.get('/scrape', function (req, res) {
    // The stock symbol to lookup
    var symbol = req.query.s;

    if (symbol) {
        // The url to scrape from
        var url = parser.createUrl(symbol);

        if (url === undefined) {
            res.send("Could not initialize finance data parser.");

            return;
        }

        request(url, function (error, response, html) {
            // First we'll check to make sure no errors occurred when making the request
            if (!error) {
                var values;

                // Promise to scrape data and enter it into parse database
                Q.when(null).then(function (values) {
                    try {
                        values = parser.parse(html);

                        if (values === undefined || values.name === undefined || values.range.low === undefined || values.range.high === undefined) {
                            throw new Error("Could not initialize finance data parser.");
                        }

                        values.symbol = symbol.toUpperCase();

                        return values;
                    } catch (exp) {
                        throw new Error("Could not collect financial data. Message: " + exp.message);
                    }
                }).then(function (values) {
                    try {
                        // Check to see if entry already exists
                        parseFinanceData.hasEntry(values, function (count) {
                            if (count < 1) {
                                // Add entry to backend
                                parseFinanceData.addEntry(values, function () {
                                    res.statusCode = 200;
                                    res.setHeader('Content-Type', 'application/json');

                                    res.send(values);
                                });
                            } else {
                                res.statusCode = 200;
                                res.setHeader('Content-Type', 'application/json');

                                res.send(values);
                            }
                        });
                    } catch (exp) {
                        throw new Error("Could not add entry to database backend. Error: " + exp.message);
                    }
                }).catch(function (error) {
                    // Error sent back
                    res.statusCode = 500;
                    res.send(error.message);

                    return;
                });
            } else {
                // Error sent back
                res.statusCode = 500;
                res.send("Error getting page request data.");

                return;
            }
        });
    } else {
        // Error sent back
        res.statusCode = 500;
        res.send("Symbol not found in url.");

        return;
    }
});

var server = app.listen(8081, function () {
    // Not an exact match for an IP address but suffices for this purpose
    var host = /^\d{1,3}(\.\d{1,3}){3}$/.test(server.address().address) ? server.address().address : "localhost";
    var port = server.address().port;

    console.log("App listening at http://%s:%s", host, port);
});