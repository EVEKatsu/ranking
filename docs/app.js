//Vue.config.debug = true;
//Vue.config.devtools = true;


MODIFIERS = {
    "character": {
        "singular": "character",
        "ext": ".jpg"
    },
    "corporation": {
        "ext": ".png"
    },
    "alliance": {
        "ext": ".png"
    }
}


function getParameters() {
    var params = {};

    hashes = document.location.search.slice(1).split("&");
    for (var i = 0; i < hashes.length; i++) {
        hash = hashes[i].split("=");
        params[decodeURIComponent(hash[0])] = decodeURIComponent(hash[1]);
    }

    return params
}

var xmlHttpRequest = new XMLHttpRequest();
xmlHttpRequest.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
        if (this.response) {
            initialize(JSON.parse(this.response));
        }
    }
}

var params = getParameters();
var date = params["date"].split("-");
var DATE_URL = "year/" + date[0] + "/month/" + date[1] + "/";

xmlHttpRequest.open("GET", date[0] + "/" + date[1] + "/aggregate.json", true);
xmlHttpRequest.responseText = "json";
xmlHttpRequest.send(null);

document.getElementById("title").innerText += " " + params["date"];
document.title += " " + params["date"];

function initialize(aggregate) {
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

    var renderISK = function(colname, entry) {
        var value = entry[colname].toFixed(0);
        return String(value).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    };
    

    for (var key in aggregate) {
        for(var i in aggregate[key]) {
            item = aggregate[key][i];
            item["id"] = i;
            item["modifier"] = key;

            item["ships_efficiency"] = getEfficiency(item["ships_destroyed"], item["ships_lost"]);
            item["lsk_efficiency"] = getEfficiency(item["isk_destroyed"], item["isk_lost"]);
            item["points_efficiency"] = getEfficiency(item["points_destroyed"], item["points_lost"]);

            item["image_path"] = "images/" + key + "/" + i + MODIFIERS[key]["ext"]; 
    
            if (item["corporation_id"] || key == "corporation") {
                var corporation_id = key == "corporation" ? i : item["corporation_id"];
                item["cticker_text"] = "[" + aggregate["corporation"][corporation_id]["ticker"] + "]";
            }
    
            if (item["alliance_id"] || key == "alliance") {
                var alliance_id = key == "alliance" ? i : item["alliance_id"];
                item["aticker_text"] = "<" + aggregate["alliance"][alliance_id]["ticker"] + ">";
            }
        }
    }

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
            defaultOrderColumn: "ships_destroyed",
            defaultOrderDirection: false,
            multiColumnSortable: true,
            columns: [
                {
                    title: "Name",
                    name: "name",
                    cellstyle: "column_align_left",
                    renderfunction: function (colname, entry) {
                        var img = '<img src="' + entry["image_path"] + '" width="32">';
                        var url = "https://zkillboard.com/" + entry["modifier"] + "/" + entry["id"] + "/";
                        return img + ' <a href="' + url + DATE_URL + '">' + entry[colname] + "</a>";
                    },
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "ID",
                    name: "id",
                    cellstyle: "column_align_left",
                    visible: false,
                    editable: false,
                    sortable: false
                },
                {
                    title: "Ships(+)",
                    name: "ships_destroyed",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Ships(-)",
                    name: "ships_lost",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Ships(%)",
                    name: "ships_efficiency",
                    renderfunction: renderEfficiency,
                    visible: false,
                    editable: false,
                    sortable: true
                },
                {
                    title: "ISK(+)",
                    name: "isk_destroyed",
                    renderfunction: renderISK,
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "ISK(-)",
                    name: "isk_lost",
                    renderfunction: renderISK,
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "ISK(%)",
                    name: "lsk_efficiency",
                    renderfunction: renderEfficiency,
                    visible: false,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Points(+)",
                    name: "points_destroyed",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Points(-)",
                    name: "points_lost",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "Points(%)",
                    name: "points_efficiency",
                    renderfunction: renderEfficiency,
                    visible: false,
                    editable: false,
                    sortable: true
                },
                {
                    title: "CTicker",
                    name: "cticker_text",
                    cellstyle: "column_align_left",
                    visible: true,
                    editable: false,
                    sortable: true
                },
                {
                    title: "ATicker",
                    name: "aticker_text",
                    cellstyle: "column_align_left",
                    visible: true,
                    editable: false,
                    sortable: true
                }
            ],
            values: Object.values(aggregate["character"])
        },
        methods: {
            loadCharacters: function() {
                this.values.splice(0, this.values.length);
                Array.prototype.push.apply(this.values, Object.values(aggregate["character"]));
            },
            loadCorporations: function() {
                this.values.splice(0, this.values.length);
                Array.prototype.push.apply(this.values, Object.values(aggregate["corporation"]));
            },
            loadAlliances: function () {
                this.values.splice(0, this.values.length);
                Array.prototype.push.apply(this.values, Object.values(aggregate["alliance"]));
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
