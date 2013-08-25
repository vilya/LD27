DROPBOX_DIR = $(HOME)/Dropbox
DEPLOY_DIR = $(DROPBOX_DIR)/Public/LD27
SRC_DIR = public

.PHONY: deploy
deploy: deploy_dir
	cp -R $(SRC_DIR)/* $(DEPLOY_DIR)


.PHONY: deploy_dir
deploy_dir:
	mkdir -p $(DEPLOY_DIR)


clean:
	rm -rf $(DEPLOY_DIR)

