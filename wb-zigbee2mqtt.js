var base_topic = 'zigbee2mqtt';
var controlsTypes = {
  battery: 'value',
  linkquality: 'value',
  temperature: 'temperature',
  humidity: 'rel_humidity',
  pressure: 'atmospheric_pressure',
  co2: 'concentration',
  voc: 'value',
  illuminance: 'value',
  illuminance_lux: 'value',
  noise: 'sound_level',
  occupancy_level: 'value',
  power: 'power',
  voltage: 'voltage',
};

defineVirtualDevice('zigbee2mqtt', {
  title: 'Zigbee2mqtt',
  cells: {
    State: {
      type: 'text',
      value: '',
    },
    'Permit join': {
      type: 'switch',
      value: false,
    },
    'Update devices': {
      type: 'pushbutton',
    },
    Version: {
      type: 'text',
      value: '',
    },
    'Log level': {
      type: 'text',
      value: '',
    },
    Log: {
      type: 'text',
      value: '',
    },
  },
});

defineRule('Update devices', {
  whenChanged: 'zigbee2mqtt/Update devices',
  then: function (newValue, devName, cellName) {
    publish(base_topic + '/bridge/devices/get', '');
  },
});

defineRule('Permit join', {
  whenChanged: 'zigbee2mqtt/Permit join',
  then: function (newValue, devName, cellName) {
    publish(base_topic + '/bridge/request/permit_join', newValue);
  },
});

(function () {
  trackMqtt(base_topic + '/bridge/state', function (obj) {
    dev['zigbee2mqtt']['State'] = obj.value;
    if (obj.value == 'online') {
      setTimeout(function () {
        publish(base_topic + '/bridge/devices/get', '');
      }, 5000);
    }
  });

  //for zigbee2mqtt 1.18.x
  trackMqtt(base_topic + '/bridge/log', function (obj) {
    dev['zigbee2mqtt']['Log'] = obj.value;
  });

  //for zigbee2mqtt 1.21.x and above
  trackMqtt(base_topic + '/bridge/logging', function (obj) {
    var msg = JSON.parse(obj.value);

    if (msg['message'].indexOf('MQTT publish') != 0) {
      dev['zigbee2mqtt']['Log'] = msg['message'];
      dev['zigbee2mqtt']['Log level'] = msg['level'];
    }
  });

  //for zigbee2mqtt 1.18.x
  trackMqtt(base_topic + '/bridge/config', function (obj) {
    if (obj.value != '') {
      JSON.parse(obj.value, function (k, v) {
        if (k == 'log_level') {
          dev['zigbee2mqtt']['Log level'] = v;
        }
        if (k == 'version') {
          dev['zigbee2mqtt']['Version'] = v;
        }
      });
    }
  });

  //for zigbee2mqtt 1.21.x and above
  trackMqtt(base_topic + '/bridge/info', function (obj) {
    var msg = JSON.parse(obj.value);
    dev['zigbee2mqtt']['Version'] = msg['version'];
  });

  trackMqtt(base_topic + '/bridge/response/permit_join', function (obj) {
    if (obj.value != '') {
      JSON.parse(obj.value, function (k, v) {
        if (k == 'value') {
          dev['zigbee2mqtt']['Permit join'] = v;
        }
      });
    }
  });

  trackMqtt(base_topic + '/bridge/devices', function (obj) {
    if (obj.value != '') {
      JSON.parse(obj.value, function (k, v) {
        if (k == 'friendly_name' && v != 'Coordinator') {
          var device = getDevice(v);
          if (device === undefined || !device.isVirtual()) {
            defineVirtualDevice(v, {
              title: v,
              cells: {},
            });
            initTracker(v);
          }
        }
      });
    }
  });
})();

function getControlType(controlName, controlsTypes) {
  return controlName in controlsTypes ? controlsTypes[controlName] : 'text';
}

function getContolValue(contolName, controlValue, controlsTypes) {
  if (contolName in controlsTypes) return controlValue;
  if (controlValue == null) return '';
  if (typeof controlValue === 'object') {
    return JSON.stringify(controlValue);
  }
  return controlValue.toString();
}

function initTracker(deviceName) {
  trackMqtt(base_topic + '/' + deviceName, function (obj) {
    var device = JSON.parse(obj.value);
    for (var controlName in device) {
      if (controlName == '') {
        continue;
      }

      if (!getDevice(deviceName).isControlExists(controlName)) {
        getDevice(deviceName).addControl(controlName, {
          type: getControlType(controlName, controlsTypes),
          value: getContolValue(controlName, device[controlName], controlsTypes),
          readonly: true,
        });
      } else {
        dev[deviceName][controlName] = getContolValue(
          controlName,
          device[controlName],
          controlsTypes
        );
      }
    }
  });
}
