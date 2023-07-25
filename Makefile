PREFIX = /usr
dummy:
	echo

install:
	install -Dm0644 wb-zigbee2mqtt.js -t $(DESTDIR)$(PREFIX)/share/wb-rules-system/rules/
	
.PHONY: dummy install
