//Vue.config.debug = true;
//Vue.config.devtools = true;

const IMAGE_URL = "https://evekatsu.github.io/data/";
const ZKILLBOARD_URL = "https://zkillboard.com/";

const CHARACTER = 0;
const CORPORATION = 1;
const ALLIANCE = 2;
const PLAYERS_KEYS_LENGTH = 3;
const PLAYERS = [
    {
        "name": "character",
        "ext": ".jpg"
    }, {
        "name": "corporation",
        "ext": ".png"
    }, {
        "name": "alliance",
        "ext": ".png"
    }
];
const PLAYERS_LIMIT = 99;

const SOLO = 0;
const SMALL_GANGS = 1;
const BRAWLERS = 2;
const BIG_FIGHTERS = 3;
const KILLMAIL_KEYS_LENGTH = 4;
const KILLMAIL_KEYS = [
    {
        "sort": function(a, b) {
            return b.pointsDestroyed - a.pointsDestroyed;
        }
    },
    {
        "sort": function(a, b) {
            return b.pointsDestroyed - a.pointsDestroyed;
        }
    },
    {
        "sort": function(a, b) {
            return b.shipsDestroyed - a.shipsDestroyed;
        }
    },
    {
        "sort": function(a, b) {
            return b.iskDestroyed - a.iskDestroyed;
        }
    }
]

const SHARELINK_TOKEN = ",";

const SHIPS_DESTROYED = 0;
const SHIPS_LOST = 1;
const POINTS_DESTROYED = 2;
const POINTS_LOST = 3;
const ISK_DESTROYED = 4;
const ISK_LOST = 5;

const SHIP_VALUES_NAMES = [
    "shipsDestroyed",
    "shipsLost",
    "pointsDestroyed",
    "pointsLost",
    "iskDestroyed",
    "iskLost"
];

var URL_PARAMS;
var DATE_URL;

function getParameters() {
    var params = {};

    hashes = document.location.search.slice(1).split("&");
    for (var i = 0; i < hashes.length; i++) {
        hash = hashes[i].split("=");
        params[decodeURIComponent(hash[0])] = decodeURIComponent(hash[1]);
    }

    return params
}

if (document.location.search) {
    URL_PARAMS = getParameters();
    var date = URL_PARAMS["date"].split("-");
    DATE_URL = "year/" + date[0] + "/month/" + date[1] + "/";

    document.getElementById("title").getElementsByTagName("a")[0].innerText += " for the " + URL_PARAMS["date"];
    document.title += " for the " + URL_PARAMS["date"];

    $.getJSON(date[0] + "/" + date[1] + "/players.min.json", function(players) {
        $.getJSON(date[0] + "/" + date[1] + "/players_information.json", function(playersInformation) {
            initialize(players, playersInformation);
        }).fail(function() {
            alert("Error: players_information.json");
        });
    }).fail(function() {
        alert("Error: players.min.json");
    });
} else {
    document.getElementById("app").remove();
    var parent = document.getElementsByClassName("container-fluid")[0];
    parent.style.fontSize = "140%";

    var appendList = function(year, until) {
        var h2 = document.createElement("h2");
        h2.innerText = year;
        parent.appendChild(h2);

        var ul = document.createElement("ul");
        for (var i = 1; i <= until; i++) {
            var date = year + "-" + i;
            var li = document.createElement("ul");
            li.innerHTML = '<a href="?date=' + date+ '">' + date + '</a>'
            ul.appendChild(li);
        }
        parent.appendChild(ul);
    }

    var nowDate = new Date();
    for (var year = 2017; year <= nowDate.getFullYear(); year++) {
        var month = 12;
        if (year == nowDate.getFullYear()) {
            month = nowDate.getMonth();
            if (nowDate.getDate() < 10) {
                month -= 1;
            }
        }

        appendList(year.toString(), month.toString());
    }
    
    parent.appendChild(document.createElement("hr"));
}

function initialize(players, playersInformation) {
    var getEfficiency = function(destroyed, lost) {
        var efficiency = destroyed / (destroyed + lost) * 100;
        return Math.floor(efficiency * 10) / 10;
    };

    var renderEfficiency = function(colname, entry) {
        var value = entry[colname];
        if (value == 100 || value == 0) {
            return value + "%";
        } else {
            return value.toFixed(1) + "%";
        }
    };

    var playerKey = CHARACTER;
    if (URL_PARAMS["p"] !== undefined) {
        var key = Number(URL_PARAMS["p"]);
        if (key >= 0 && key < PLAYERS_KEYS_LENGTH) {
            playerKey = key;
        }
    }
    var playerKeyName = PLAYERS[playerKey]["name"];

    var killmailKeys = [];
    if (URL_PARAMS["k"] === undefined) {
        for (var i = 0; i < KILLMAIL_KEYS_LENGTH; i++) {
            killmailKeys.push(String(i));
        }
    } else {
        killmailKeys = URL_PARAMS["k"].split(SHARELINK_TOKEN).filter(function(e) {
            return Number(e) >= 0 && Number(e) < KILLMAIL_KEYS_LENGTH;
        });
    }

    var loadValues = function(killmailKeys) {
        var items = {};

        killmailKeys.forEach(function(killmailKey) {
            players[playerKey][killmailKey].forEach(function(player) {
                var playerId = player[0];
                var ships = player[1];
                var shipValues = Array(SHIP_VALUES_NAMES.length).fill(0);
                
                for (var i = 0; i < ships.length; i++) {
                    var shipId = ships[i][0];
                    var values = ships[i][1];

                    for (var j = 0; j < values.length; j++) {
                        shipValues[j] += values[j];
                    }
                }

                if (!items[playerId]) {
                    items[playerId] = {};

                    for (var i = 0; i < SHIP_VALUES_NAMES.length; i++) {
                        items[playerId][SHIP_VALUES_NAMES[i]] = 0;
                    }
                }

                item = items[playerId];
                for (var i = 0; i < SHIP_VALUES_NAMES.length; i++) {
                    item[SHIP_VALUES_NAMES[i]] += shipValues[i];
                }
            });
        });

        var values = [];
        for (playerId in items) {
            var item = items[playerId];
            item["id"] = playerId;
            values.push(item);
        }

        if (killmailKeys.length == 1) {
            values.sort(KILLMAIL_KEYS[Number(killmailKeys[0])]["sort"]);
        } else {
            values.sort(function(a, b) { return b.shipsDestroyed - a.shipsDestroyed });            
        }

        resultValues = []
        for (var i = 0; i < values.length; i++) {
            if (i >= PLAYERS_LIMIT) {
                break;
            }
            value = values[i];
            value["rank"] = i + 1;

            value["shipsEfficiency"] = getEfficiency(value["shipsDestroyed"], value["shipsLost"]);
            value["lskEfficiency"] = getEfficiency(value["pointsDestroyed"], value["pointsLost"]);
            value["pointsEfficiency"] = getEfficiency(value["iskDestroyed"], value["iskLost"])

            info = playersInformation[playerKeyName][value["id"]];
            value["name"] = info["name"];
            if (info["corporation_id"] || playerKey == CORPORATION) {
                var corporationId = playerKey == CORPORATION ? value["id"] : info["corporation_id"];
                value["ctickerText"] = "[" + playersInformation["corporation"][corporationId]["ticker"] + "]";
            }

            if (info["alliance_id"] || playerKey == ALLIANCE) {
                var alliance_id = playerKey == ALLIANCE ? value["id"] : info["alliance_id"];
                value["atickerText"] = "<" + playersInformation["alliance"][alliance_id]["ticker"] + ">";
            }

            resultValues.push(value);
        }

        return resultValues;
    };

    var renderISK = function(colname, entry) {
        var value = entry[colname].toFixed(0);
        return String(value).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    };

    return new Vue({
        el: "#app",
        components: {
            VueBootstrapTable: VueBootstrapTable
        },
        data: {
            showFilter: true,
            showPicker: true,
            paginated: false,
            pageSize: 100,
            defaultOrderColumn: "rank",
            defaultOrderDirection: true,
            multiColumnSortable: true,
            killmailKeys: killmailKeys,
            values: loadValues(killmailKeys),
            columns: [
                {
                    title: "",
                    name: "rank",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Name",
                    name: "name",
                    cellstyle: "column_align_left",
                    renderfunction: function (colname, entry) {
                        var image_path = IMAGE_URL + playerKeyName + "/" + entry["id"] + "_32" + PLAYERS[playerKey]["ext"];
                        var img = '<img src="' + image_path + '">';
                        var url = ZKILLBOARD_URL + playerKeyName + "/" + entry["id"] + "/top/";
                        return img + ' <a href="' + url + DATE_URL + '">' + entry[colname] + "</a>";
                    },
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "ID",
                    name: "id",
                    visible: false,
                    editable: false,
                    sortable: false
                },
                {
                    title: "Ships(+)",
                    name: "shipsDestroyed",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Ships(-)",
                    name: "shipsLost",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Ships(%)",
                    name: "shipsEfficiency",
                    renderfunction: renderEfficiency,
                    visible: false,
                    editable: false,
                    sortable: true
                },
                {
                    title: "ISK(+)",
                    name: "iskDestroyed",
                    renderfunction: renderISK,
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "ISK(-)",
                    name: "iskLost",
                    renderfunction: renderISK,
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "ISK(%)",
                    name: "lskEfficiency",
                    renderfunction: renderEfficiency,
                    visible: false,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Points(+)",
                    name: "pointsDestroyed",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Points(-)",
                    name: "pointsLost",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Points(%)",
                    name: "pointsEfficiency",
                    renderfunction: renderEfficiency,
                    visible: false,
                    editable: false,
                    sortable: true
                },
                {
                    title: "CTicker",
                    name: "ctickerText",
                    cellstyle: "column_align_left",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "ATicker",
                    name: "atickerText",
                    cellstyle: "column_align_left",
                    visible: true,
                    editable: false,
                    sortable: true
                }
            ]
        },
        methods: {
            update: function() {
                playerKeyName = PLAYERS[playerKey]["name"];

                var url = "?date=" + URL_PARAMS["date"];
                if (playerKey != CHARACTER) {
                    url += "&p=" + playerKey;
                }
                var length = this.killmailKeys.length;
                if (length != KILLMAIL_KEYS_LENGTH && length != 0) {
                    url += "&k=" + this.killmailKeys.join(",");
                }
                window.history.pushState(null, null, url);

                this.values.splice(0, this.values.length);
                Array.prototype.push.apply(this.values, loadValues(this.killmailKeys));
            },
            loadCharacters: function() {
                playerKey = CHARACTER;
                this.update();
            },
            loadCorporations: function() {
                playerKey = CORPORATION;
                this.update();
            },
            loadAlliances: function () {
                playerKey = ALLIANCE;
                this.update();
            },
            downloadCSV: function() {
                var csv = [];
                var table = document.getElementsByTagName("table")[0];

                var trs = table.getElementsByTagName("tr");
                for (var i = 0; i < trs.length; i++) {
                    var tds = trs[i].getElementsByTagName("td");
                    if (tds.length == 0) {
                        continue;
                    }

                    var columns = []
                    for (var j = 0; j < tds.length; j++) {
                        columns.push(tds[j].innerText.trim());
                    }

                    csv.push(columns);
                }

                var ths = table.getElementsByTagName("th");
                var headers = [];
                for (var i = 0; i < ths.length; i++) {
                    headers.push(ths[i].innerText.trim());
                }
                csv.unshift(headers);

                var csv_string = csv.map(row => {
                    return row.map(str => {
                        return '"' + (str ? str.replace(/"/g, '""') : '') + '"';
                    });
                }).map(row => {
                    return row.join(",");
                }).join("\n");

                var bom = '\uFEFF';
                var blob = new Blob([bom, csv_string], { type: "text/csv" });
                var name = "aggregate.csv";
                var anchor = document.createElement("a");

                // ie
                if (window.navigator.msSaveBlob) {
                    window.navigator.msSaveBlob(blob, name);
                // chrome, firefox, etc.
                } else if (window.URL && anchor.download !== undefined) {
                    anchor.download = name;
                    anchor.href = window.URL.createObjectURL(blob);
                    document.body.appendChild(anchor);
                    anchor.click();
                    anchor.parentNode.removeChild(anchor);                    
                } else {
                    window.location.href = "data:attachment/csv;charset=utf-8," + encodeURIComponent(bom + data);
                }
            }
        }
    });
}
