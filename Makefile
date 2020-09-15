DESTDIR=/
dummy:
	echo


install:
	install -D -m 0644  wb-knxd-config.conf $(DESTDIR)/usr/share/wb-rules-system/rules/wb-zigbee2mqtt.js
	
.PHONY: dummy install
