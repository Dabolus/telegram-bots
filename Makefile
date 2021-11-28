LAYERS := $(wildcard layers/*)
.PHONY: layers $(LAYERS)

layers: $(LAYERS)
$(LAYERS):
	$(MAKE) -C $@
