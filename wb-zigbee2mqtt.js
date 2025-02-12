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

var majorVersion = 0;
var permit_join_info = false;
var publish_lock = false;

defineVirtualDevice('zigbee2mqtt', {
  title: { en: 'Zigbee2mqtt converter', ru: 'Zigbee2mqtt конвертер' },
  cells: {
    State: {
      title: { en: 'State', ru: 'Состояние' },
      type: 'text',
      value: '',
    },
    'Permit join': {
      title: { en: 'Permit join', ru: 'Разрешить сопряжение' },
      type: 'switch',
      value: false,
    },
    'Update devices': {
      title: { en: 'Update devices', ru: 'Обновить устройства' },
      type: 'pushbutton',
    },
    Version: {
      title: { en: 'Version', ru: 'Версия' },
      type: 'text',
      value: '',
    },
    'Log level': {
      title: { en: 'Log level', ru: 'Уровень логирования' },
      type: 'text',
      value: '',
    },
    Log: {
      title: { en: 'Log', ru: 'Лог' },
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
    var version = dev['zigbee2mqtt']['Version'] || '';
    var versionParts = version.split('.').map(Number);
    majorVersion = versionParts.length > 0 ? versionParts[0] : 0;

    //for zigbee2mqtt 1.42.x and below
    if (majorVersion < 2) {
      publish(base_topic + '/bridge/request/permit_join', newValue);
    }

    //for zigbee2mqtt 2.x.x and above
    else {
      var payload;
      payload = newValue ? JSON.stringify({ time: 254 }) : JSON.stringify({ time: 0 });
      //log.info("Состояние newValue: {}".format(newValue));
      //log.info("Состояние publish_lock: {}".format(publish_lock));
      if (!publish_lock) {
        if ((!permit_join_info && newValue)|(permit_join_info && !newValue)) {
          //log.info("Состояние publish: {}".format(true));
          publish(base_topic + '/bridge/request/permit_join', payload);
        }
      }
    }

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

    //for zigbee2mqtt 2.x.x and above
    if (majorVersion >= 2) {
      permit_join_info = msg['permit_join'];
      if (!msg['permit_join'] && dev['zigbee2mqtt']['Permit join']) {
        dev['zigbee2mqtt']['Permit join'] = false;
        publish_lock = false;
      }
    }

  });

  trackMqtt(base_topic + '/bridge/response/permit_join', function (obj) {
    if (obj.value != '') {
      JSON.parse(obj.value, function (k, v) {
        if (k == 'value') {
          dev['zigbee2mqtt']['Permit join'] = v;
        }

        //for zigbee2mqtt 2.x.x and above
        else if (k == 'time' && majorVersion >= 2) {
          if (v == 0 && dev['zigbee2mqtt']['Permit join']) {
            publish_lock = true;
            dev['zigbee2mqtt']['Permit join'] = false;
          }
          else if (v != 0 && !dev['zigbee2mqtt']['Permit join']) {
            publish_lock = true;
            dev['zigbee2mqtt']['Permit join'] = true;
          }
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

function getControlValue(contolName, controlValue, controlsTypes) {
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
          value: getControlValue(controlName, device[controlName], controlsTypes),
          readonly: true,
        });
      } else {
        dev[deviceName][controlName] = getControlValue(
          controlName,
          device[controlName],
          controlsTypes
        );
      }
    }
  });
}
