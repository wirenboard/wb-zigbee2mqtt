DESTDIR=/
dummy:
	echo


install:
	mkdir -p $(DESTDIR)/usr/share/wb-rules-system/rules
	install -D -m 0644  wb-zigbee2mqtt.js $(DESTDIR)/usr/share/wb-rules-system/rules/wb-zigbee2mqtt.js
	
.PHONY: dummy install
