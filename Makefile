.PHONY: all build check test lint clean safari safari-ios safari-macos safari-extension-build safari-ios-xcode safari-macos-xcode chrome

all: build

build:
	pnpm -r build

check:
	pnpm -r check

test:
	pnpm test

lint:
	pnpm lint

# Build Safari extension and convert platform-specific Xcode projects.
safari: safari-ios safari-macos

safari-extension-build:
	pnpm --filter @brijio/safari-extension build

safari-ios: safari-extension-build safari-ios-xcode

safari-macos: safari-extension-build safari-macos-xcode

safari-ios-xcode:
	xcrun safari-web-extension-converter \
		--force \
		--ios-only \
		--no-prompt \
		--no-open \
		--bundle-identifier uk.co.redvex.Brijio \
		--project-location clients/extensions/safari/Brijio-iOS \
		clients/extensions/safari/dist-ios

safari-macos-xcode:
	xcrun safari-web-extension-converter \
		--force \
		--macos-only \
		--no-prompt \
		--no-open \
		--bundle-identifier uk.co.redvex.Brijio \
		--project-location clients/extensions/safari/Brijio-macOS \
		clients/extensions/safari/dist-macos

chrome:
	pnpm --filter @brijio/chrome-extension build

clean:
	pnpm -r clean
	rm -rf clients/extensions/safari/Brijio
	rm -rf clients/extensions/safari/Brijio-iOS
	rm -rf clients/extensions/safari/Brijio-macOS
	rm -rf clients/extensions/safari/dist
	rm -rf clients/extensions/safari/dist-ios
	rm -rf clients/extensions/safari/dist-macos
	rm -rf clients/extensions/chrome/dist
	rm -rf packages/shared/dist
