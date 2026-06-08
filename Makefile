.PHONY: all build check test lint clean safari safari-xcode chrome

all: build

build:
	pnpm -r build

check:
	pnpm -r check

test:
	pnpm test

lint:
	pnpm lint

# Build Safari extension and convert to Xcode project
safari: safari-extension-build safari-xcode-project

safari-extension-build:
	pnpm --filter @brijio/safari-extension build

safari-xcode-project: safari-extension-build
	xcrun safari-web-extension-converter \
		--force \
		--bundle-identifier uk.co.redvex.Brijio \
		--project-location clients/extensions/safari/Brijio \
		clients/extensions/safari/dist

chrome:
	pnpm --filter @brijio/chrome-extension build

clean:
	pnpm -r clean
	rm -rf clients/extensions/safari/Brijio
	rm -rf clients/extensions/safari/dist
	rm -rf clients/extensions/chrome/dist
	rm -rf packages/shared/dist