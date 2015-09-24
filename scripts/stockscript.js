function updateGraphData(headers, data) {
    var innerWidth = $("#graphPlaceholder").width();
    var margin = { top: 30, right: $("#graphPlaceholder").width() * 0.1, bottom: 30, left: $("#graphPlaceholder").width() * 0.1 };
    var width = innerWidth - margin.left - margin.right;
    var height = (innerWidth * 2 / 5) - margin.top - margin.bottom;

    var parseDate = d3.time.format("%d-%b-%y").parse;
    var bisectDate = d3.bisector(function (d) { return d.date; }).left;
    var formatCurrency = function (d) { return "$" + d3.format(",.2f")(d); };

    var x = d3.time.scale()
        .range([0, width]);

    var y = d3.scale.linear()
        .range([height, 0]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    var line = d3.svg.line()
        .x(function (d) { return x(d.date); })
        .y(function (d) { return y(d.adjClose); });

    var lineFifty = d3.svg.line()
        .x(function (d) { return x(d.date); })
        .y(function (d) { return y(d.fifty); });

    var lineTwoHundred = d3.svg.line()
        .x(function (d) { return x(d.date); })
        .y(function (d) { return y(d.twoHundred); });

    var area = d3.svg.area()
        .x(function (d) { return x(d.date); })
        .y0(height)
        .y1(function (d) { return y(d.adjClose); });

    var svg = d3.select("#graphPlaceholder").append("svg")
        .attr("id", "stockGraph")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Change range so that the graph is padded in the chart
    var closeRangeObj = d3.extent(data, function (d) { return d.adjClose; });
    var closeRange = Math.abs(closeRangeObj[0] - closeRangeObj[1]);
    closeRangeObj[0] = closeRangeObj[0] * 0.9;
    closeRangeObj[1] = closeRangeObj[1] * 1.1;

    x.domain([data[0].date, data[data.length - 1].date]);
    y.domain(closeRangeObj);

    svg.append("path")
        .datum(data)
        .attr("class", "area")
        .attr("d", area);

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Price ($)");

    svg.append("path")
        .datum(data)
        .attr("class", "line")
        .attr("d", line);

    svg.append("path")
        .datum(data)
        .attr("class", "fiftyMovingAverage")
        .attr("d", lineFifty);

    svg.append("path")
        .datum(data)
        .attr("class", "twoHundredMovingAverage")
        .attr("d", lineTwoHundred);

    var focusClose = svg.append("g")
        .attr("class", "focusClose")
        .style("display", "none");

    var focusFifty = svg.append("g")
        .attr("class", "focusFifty")
        .style("display", "none");

    var focusTwoHundred = svg.append("g")
        .attr("class", "focusTwoHundred")
        .style("display", "none");

    var closeTextG = svg.append("g")
        .attr("class", "focusClose");

    closeTextG.append("rect")
        .attr("width", 60)
        .attr("height", 30)
        .attr("x", 40)
        .attr("y", 0);

    closeTextG.append("text")
        .attr("x", 70)
        .attr("y", 15)
        .attr("dy", ".35em")
        .style("text-anchor", "middle");

    var fiftyTextG = svg.append("g")
        .attr("class", "focusFifty");

    fiftyTextG.append("rect")
        .attr("width", 60)
        .attr("height", 30)
        .attr("x", 120)
        .attr("y", 0);

    fiftyTextG.append("text")
        .attr("x", 150)
        .attr("y", 15)
        .attr("dy", ".35em")
        .style("text-anchor", "middle");

    var twoHundredTextG = svg.append("g")
        .attr("class", "focusTwoHundred");

    twoHundredTextG.append("rect")
        .attr("width", 60)
        .attr("height", 30)
        .attr("x", 200)
        .attr("y", 0);

    twoHundredTextG.append("text")
        .attr("x", 230)
        .attr("y", 15)
        .attr("dy", ".35em")
        .style("text-anchor", "middle");

    focusClose.append("circle")
        .attr("r", 5);

    focusFifty.append("circle")
        .attr("r", 5);

    focusTwoHundred.append("circle")
        .attr("r", 5);

    svg.append("rect")
        .attr("class", "overlay")
        .attr("width", width)
        .attr("height", height)
        .on("mouseover", function () { focusClose.style("display", null); focusFifty.style("display", null); focusTwoHundred.style("display", null); })
        .on("mouseout", function () {
            focusClose.style("display", "none");
            focusFifty.style("display", "none");
            focusTwoHundred.style("display", "none");
            closeTextG.select("text").text(null);
            fiftyTextG.select("text").text(null);
            twoHundredTextG.select("text").text(null);
        })
        .on("mousemove", mousemove);

    function mousemove() {
        var x0 = x.invert(d3.mouse(this)[0]),
            i = bisectDate(data, x0, 1),
            d0 = data[i - 2],
            d1 = data[i - 1];

        if (!!d0) {
            var d = x0 - d0.date > d1.date - x0 ? d1 : d0;
            focusClose.attr("transform", "translate(" + x(d.date) + "," + y(d.adjClose) + ")");
            focusFifty.attr("transform", "translate(" + x(d.date) + "," + y(d.fifty) + ")");
            focusTwoHundred.attr("transform", "translate(" + x(d.date) + "," + y(d.twoHundred) + ")");

            closeTextG.select("text").text(formatCurrency(d.adjClose));
            fiftyTextG.select("text").text(formatCurrency(d.fifty));
            twoHundredTextG.select("text").text(formatCurrency(d.twoHundred));
        }
    }
}

function updateFinanceData(data) {
    var $financeDiv = $('.inner', $('#financePlaceholder'));

    var $table = $('<table></table>');

    var $thead = $('<thead><tr><td colspan="4"><h1>' + data.name + '</h1></td></tr></thead>');
    $table.append($thead);

    var $tbody = $('<tbody></tbody>');

    $tbody.append($('<tr><td>Range</td><td>' + '$' + data.range.low.toFixed(2) + ' - ' + '$' + data.range.high.toFixed(2) + '</td>' +
        '<td>PE ratio</td><td>' + (!data.priceToEarningsRatio ? '-' : data.priceToEarningsRatio.toFixed(2)) + '</td></tr>'));
    $tbody.append($('<tr><td>52 week range</td><td>' + '$' + data.fiftyTwoWeekRange.low.toFixed(2) + ' - ' + '$' + data.fiftyTwoWeekRange.high.toFixed(2) + '</td>' +
        '<td>Dividends</td><td>' + (!data.dividends ? '-' : '$' + data.dividends.toFixed(2)) + '</td></tr>'));
    $tbody.append($('<tr><td>Market cap</td><td>' + (!data.marketCap ? '-' : data.marketCap) + '</td>' +
        '<td>Dividend Yield</td><td>' + (!data.dividendYield ? '-' : data.dividendYield.toFixed(2) + '%') + '</td></tr>'));
    $tbody.append($('<tr><td>EPS</td><td>' + (!data.earningsPerShare ? '-' : '$' + data.earningsPerShare.toFixed(2)) + '</td></tr>'));

    $table.append($tbody);

    $financeDiv.append($table);
}

function updateLoadingIcon($icon, loaded) {
    if (loaded.graph && loaded.financeData) {
        $icon.hide();
    }
}

function submitForm() {
    var loaded = { graph: false, financeData: false };
    var $graphContent = $("#graphPlaceholder");
    var $financeDiv = $('.inner', $('#financePlaceholder'));

    // Show loading icon
    var $loadingIcon = $("#loadingIconContainer");
    $loadingIcon.css({
        display: 'inline-block'
    });

    var symbol = $("#stockSymbol").val();

    // Remove existing elements
    var $graph = $("#stockGraph");

    if ($graph) {
        $graph.remove();
    }

    $graphContent.empty();
    $financeDiv.empty();

    $.ajax({
        type: 'GET',
        contentType: 'application/json',
        url: '/stock?s=' + symbol,
        success: function (data) {
            if (data && data.headers && data.data && data.data.length) {
                setTimeout(updateGraphData, 0, data.headers, data.data);
            } else {
                $graphContent.text("The data received was invalid. Please try again.");
            }

            loaded.graph = true;

            updateLoadingIcon($loadingIcon, loaded);
        }
    })
    .fail(function (jqXHR, textStatus) {
        if (textStatus === "timeout") {
            $graphContent.text("Your request timed out, please try again.");
        } else {
            $graphContent.text("Could not retreive data, please check your stock symbol and try again.");
        }

        loaded.graph = true;

        updateLoadingIcon($loadingIcon, loaded);
    });

    $.ajax({
        type: 'GET',
        contentType: 'application/json',
        url: '/scrape?s=' + symbol,
        success: function (data) {
            if (data && data.symbol && data.name) {
                setTimeout(updateFinanceData, 0, data);
            } else {
                $financeDiv.text("The data received was invalid. Please try again.");
            }

            loaded.financeData = true;

            updateLoadingIcon($loadingIcon, loaded);
        }
    })
    .fail(function (jqXHR, textStatus) {
        if (textStatus === "timeout") {
            $financeDiv.text("Your request timed out, please try again.");
        } else {
            $financeDiv.text("Could not retreive data, please check your stock symbol and try again.");
        }

        loaded.financeData = true;

        updateLoadingIcon($loadingIcon, loaded);
    });
}

var $stockform = $("#stocksymbol");

$stockform.submit(function (event) {
    event.preventDefault();
    submitForm();
});