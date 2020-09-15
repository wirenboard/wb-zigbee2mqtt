var base_topic = "zigbee2mqtt";
var topicType = JSON.stringify({
    battery: "value",
    linkquality: "value",
    temperature: "temperature",
    voltage: "value",
    humidity: "rel_humidity",
    pressure: "atmospheric_pressure"
});

defineVirtualDevice("zigbee2mqtt", {
    title: "Zigbee2mqtt",
    cells: {
        "State": {
            type: "text",
            value: ""
        },
        "Permit join": {
            type: "switch",
            value: false
        },
        "Update devices": {
            type: "pushbutton"
        },
        "Version": {
            type: "text",
            value: ""
        },
        "Log level": {
            type: "text",
            value: ""
        },
        "Log": {
            type: "text",
            value: ""
        },
    }
});

defineRule("Update devices", {
    whenChanged: "zigbee2mqtt/Update devices",
    then: function(newValue, devName, cellName) {
        publish(base_topic + "/bridge/config/devices/get", "");
    }
});

defineRule("Permit join", {
    whenChanged: "zigbee2mqtt/Permit join",
    then: function(newValue, devName, cellName) {
        publish(base_topic + "/bridge/config/Permit join", newValue);
    }
});

(function() {
    trackMqtt(base_topic + "/bridge/state", function(obj) {
        dev["zigbee2mqtt"]["State"] = obj.value;
        if (obj.value == "online") {
            setTimeout(function() {
                publish(base_topic + "/bridge/config/devices/get", "");
            }, 5000);
        }
    });
    trackMqtt(base_topic + "/bridge/log", function(obj) {
        dev["zigbee2mqtt"]["Log"] = obj.value;
    });

    trackMqtt(base_topic + "/bridge/config", function(obj) {
        if (obj.value != '') {
            JSON.parse(obj.value, function(k, v) {
                if (k == 'Permit join') {
                    dev["zigbee2mqtt"]["Permit join"] = v;
                }
                if (k == 'Log level') {
                    dev["zigbee2mqtt"]["Log level"] = v;
                }
                if (k == 'version') {
                    dev["zigbee2mqtt"]["Version"] = v;
                }
            });
        }
    });

    trackMqtt(base_topic + "/bridge/config/devices", function(obj) {
        if (obj.value != '') {
            JSON.parse(obj.value, function(k, v) {
                if (k == 'friendly_name' && v != 'Coordinator') {
                    if (getDevice(v) === undefined) {
                        defineVirtualDevice(v, {
                            title: v,
                            cells: {},
                        });
                    } else {
                        if (!getDevice(v).isVirtual()) {
                            defineVirtualDevice(v, {
                                title: v,
                                cells: {},
                            });
                        }
                    }
                    initTracker(v);
                }
            });
        }
    });
})()

function initTracker(ctrlName) {
    trackMqtt(base_topic + "/" + ctrlName, function(obj) {
        JSON.parse(obj.value, function(k, v) {
            if (k != '') {
                var obj = JSON.parse(topicType);
                var ks = Object.keys(obj);
                var resultIndex = ks.indexOf(k, 0);
                if (resultIndex >= 0) {
                    if (!getDevice(ctrlName).isControlExists(k)) {
                        getDevice(ctrlName).addControl(k, {
                            type: obj[ks[resultIndex]],
                            value: v,
                            readonly: true
                        });
                    }
                    dev[ctrlName][k] = v;
                } else {
                    if (!getDevice(ctrlName).isControlExists(k)) {
                        getDevice(ctrlName).addControl(k, {
                            type: "text",
                            value: v,
                            readonly: true
                        });
                    }
                    dev[ctrlName][k] = v.toString();
                }
            }
        });
    });
}