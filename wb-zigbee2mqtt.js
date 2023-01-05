/*!
\file
\brief Zigbee2MQTT to Wiren Board MQTT Conventions bridge
\author vsnim
\version 0.2
\date 05.01.2023
\warning Not all value types are supported


Creates controls for devices, registered in Zigbee2MQTT.

Created devices will have *zb_device_prefix* prefix.

Supported value types are
- Binary
- Numeric
- Enum
- Text

\todo Add support of the following types:
- Composite
- List
- All specific types

See https://www.zigbee2mqtt.io/guide/usage/exposes.html for value types information.
*/

var zb_base_topic = "zigbee2mqtt";
var zb_device_prefix = "";

/// Access property (see https://www.zigbee2mqtt.io/guide/usage/exposes.html#access)
function isReadOnly(a) {
    return a & 2 ? false : true;
}

function isPublished(a) {
    return a & 1 ? true : false;
}

function isOnlyRetrievable(a) {
    return (a & 5) == 4 ? true : false;
}

(function() {
    if (getDevice("zigbee2mqtt") !== undefined && getDevice("zigbee2mqtt").isVirtual())
        return;

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
        publish(zb_base_topic + "/bridge/devices/get", "");
    }
});

defineRule("Permit join", {
    whenChanged: "zigbee2mqtt/Permit join",
    then: function(newValue, devName, cellName) {
        publish(zb_base_topic + "/bridge/request/permit_join", newValue);
    }
});


trackMqtt(zb_base_topic + "/bridge/state", function(obj) {
    dev["zigbee2mqtt"]["State"] = obj.value;
    if (obj.value == "online") {
        setTimeout(function() {
            publish(zb_base_topic + "/bridge/devices/get", "");
        }, 5000);
    }
});

trackMqtt(zb_base_topic + "/bridge/log", function(obj) {
    dev["zigbee2mqtt"]["Log"] = obj.value;
});

trackMqtt(zb_base_topic + "/bridge/config", function(obj) {
    if (obj.value != '') {
        JSON.parse(obj.value, function(k, v) {
            if (k == 'log_level') {
                dev["zigbee2mqtt"]["Log level"] = v;
            }
            if (k == 'version') {
                dev["zigbee2mqtt"]["Version"] = v;
            }
        });
    }
});

trackMqtt(zb_base_topic + "/bridge/response/permit_join", function(obj) {
    if (obj.value != '') {
        JSON.parse(obj.value, function(k, v) {
            if (k == 'value') {
                dev["zigbee2mqtt"]["Permit join"] = v;
            }
        });
    }
});

})()

function initBinaryControl(zbDevice, devName, feat) {
    //log("adding binary control", feat.property);
    var devControl = getDevice(devName);

    if (devControl.isControlExists(feat.property))
        devControl.removeControl(feat.property);

    devControl.addControl(feat.property, {
        type: "switch",
        readonly: isReadOnly(feat.access),
        description: [feat.value_off, feat.value_on].toString(),
        value: false
    });

    if (!isReadOnly(feat.access)) {
        defineRule({
            whenChanged: devName + "/" + feat.property,
            then: function(newValue) {
                var msg = "{\"" + feat.property + "\" : \"" + (newValue ? feat.value_on : feat.value_off) + "\"}";
                publish(zb_base_topic + "/" + zbDevice + "/set", msg);
                //log(a, b, zb_base_topic + "/" + zbDevice + "/set", "->", msg);
            }
        });
        /*
        		var toggle = "toggle " + feat.property;
        		
        		if (devControl.isControlExists(toggle))
        			devControl.removeControl(toggle);
        		
        		devControl.addControl(toggle, {
        			type: "pushbutton",
        			description: [feat.value_off, feat.value_on].toString(),
        			value: false
        		});
        		
        		defineRule({
        			whenChanged: devName + "/" + toggle,
        			then: function(newValue, a, b) {
        				var msg = "{\"" + feat.property + "\" : \"" + (dev[devName][feat.property] ? feat.value_off : feat.value_on) + "\"}";
        				//log(a, b, zb_base_topic + "/" + zbDevice + "/set", "->", msg);
        				publish(zb_base_topic + "/" + zbDevice + "/set", msg);
        			}
        		});
        */
    }
}

function initRangeControl(zbDevice, devName, feat) {
    //log(" adding range control", feat.property);
    var devControl = getDevice(devName);

    if (devControl.isControlExists(feat.property))
        devControl.removeControl(feat.property);

    devControl.addControl(feat.property, {
        type: "range",
        readonly: isReadOnly(feat.access),
        min: feat.value_min,
        max: feat.value_max,
        value: 0
    });

    if (!isReadOnly(feat.access))
        defineRule({
            whenChanged: devName + "/" + feat.property,
            then: function(newValue, a, b) {
                var msg = "{\"" + feat.property + "\" : " + newValue + "}";
                //log(a, b, zb_base_topic + "/" + zbDevice + "/set", "->", msg);
                publish(zb_base_topic + "/" + zbDevice + "/set", msg);
            }
        });
}

function initEnumControl(zbDevice, devName, feat) {
    //log(" adding enum control", feat.property);
    var devControl = getDevice(devName);

    if (devControl.isControlExists(feat.property))
        devControl.removeControl(feat.property);

    devControl.addControl(feat.property, {
        type: "text",
		description: feat.values.toString(),
        value: ""
    });

    if (!isReadOnly(feat.access)) {
        var toggle = "toggle_" + feat.property;

        if (devControl.isControlExists(toggle))
            devControl.removeControl(toggle);

        devControl.addControl(toggle, {
            type: "pushbutton",
            value: false
        });

        defineRule({
            whenChanged: devName + "/" + toggle,
            then: function(newValue, a, b) {
				var opts = devControl.getControl(feat.property).getDescription().split(',');
				var current = devControl.getControl(feat.property).getValue();
                var msg = "{\"" + feat.property + "\" : \"" + opts[(opts.indexOf(current) + 1) % opts.length] + "\"}";
//				log(dev[devName][feat.property], devControl.getControl(feat.property).getValue(), opts, opts.indexOf(current), opts.length, opts[(opts.indexOf(current) + 1) % opts.length]);
//              log(a, b, zb_base_topic + "/" + zbDevice + "/set", "->", msg);
                publish(zb_base_topic + "/" + zbDevice + "/set", msg);
            }
        });
    }
}

function initNumericControl(devName, controlName, val, units) {
    //log(" adding numeric control", controlName, "units [",units,"]");
    var device = getDevice(devName);

    if (device.isControlExists(controlName))
        device.removeControl(controlName);

    device.addControl(controlName, {
        type: "value",
        value: val
    });
    if (units !== undefined)
        device.getControl(controlName).setUnits(units);
}

function initTextControl(devName, controlName, val) {
    //log(" adding text control", controlName);
    var device = getDevice(devName);

    if (device.isControlExists(controlName))
        device.removeControl(controlName);

    device.addControl(controlName, {
        type: "text",
        value: val.toString()
    });
}

function initControl(zbDevice, devName, param) {
    if (param.type === "binary")
        initBinaryControl(zbDevice, devName, param);
    else if (param.type === "numeric" && param.value_min !== undefined && param.value_max !== undefined)
        initRangeControl(zbDevice, devName, param);
    else if (param.type === "enum")
        initEnumControl(zbDevice, devName, param);
    else if (param.type === "numeric")
        initNumericControl(devName, param.property, 0, param.unit);
}

trackMqtt(zb_base_topic + "/bridge/devices", function(str) {
    if (str.value == '')
        return;
	log ("wb-zigbee2mqtt devices update start");

    JSON.parse(str.value).forEach(function(obj) {
        if (obj.type === "Coordinator" || obj.definition === undefined)
            return;

        var zbDevice = obj.friendly_name;

        if (zbDevice === undefined || zbDevice == '')
            zbDevice = obj.ieee_address;

        var devName = zb_device_prefix + zbDevice;
        //log("Creating [" + devName + "] node for [" + zbDevice + "]");

        if (getDevice(devName) === undefined || !getDevice(devName).isVirtual()) {
            //log("Creating device node", devName);
            defineVirtualDevice(devName, {
                title: devName,
                cells: {},
            });
        }

        var devControl = getDevice(devName);

        devControl.controlsList().forEach(function(ctrl) {
            devControl.removeControl(ctrl.getId());
        });

        obj.definition.exposes.forEach(function(param) {
            //log("Exposes endpoint [" + param.endpoint + "] type [", param.type, "]");
            if (isOnlyRetrievable(param.access))
                publish(zb_base_topic + "/" + zbDevice + "/get", "{\"" + param.property + "\":\"\"}");

            initControl(zbDevice, devName, param);

            if (param.features !== undefined)
                param.features.forEach(function(feat) {
                    initControl(zbDevice, devName, feat);
                });
        });

        trackMqtt(zb_base_topic + "/" + zbDevice, function(s) {
            JSON.parse(s.value, function(k, v) {
                if (k === undefined || k === "")
                    return;

                if (!getDevice(devName).isControlExists(k))
                    getDevice(devName).addControl(k, {
                        type: "text",
                        value: v.toString(),
                        readonly: true
                    });

                if (devControl.getControl(k).getType() === "switch" && typeof v !== "boolean" && devControl.getControl(k).getDescription() !== "")
                    devControl.getControl(k).setValue({
                        value: !!devControl.getControl(k).getDescription().toLowerCase().split(',').indexOf(v.toLowerCase()),
                        notify: false
                    });
                else if (devControl.getControl(k).getType() === "range" || devControl.getControl(k).getType() === "value")
                    devControl.getControl(k).setValue({
                        value: v,
                        notify: false
                    });
                else
                    devControl.getControl(k).setValue({
                        value: v.toString(),
                        notify: false
                    });
            });
        });

        initTextControl(devName, "vendor", obj.definition.vendor);
        initTextControl(devName, "model", obj.definition.model);
        initTextControl(devName, "description", obj.definition.description);
    });
	  log ("wb-zigbee2mqtt devices update done");
});