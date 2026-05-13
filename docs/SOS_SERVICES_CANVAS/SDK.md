# SOS Services Canvas SDK Strategy

## SDK Targets

- JavaScript/TypeScript
- Python
- Java
- Go

## Generation Model

- Source of truth: `OPENAPI.yaml`.
- Generate clients with consistent semantic versioning tags.
- Publish SDKs as independent artifacts that share API compatibility matrix.

## JavaScript SDK

- Package: `@sos/services-canvas-sdk`.
- Transport adapters: Fetch and Axios.
- Runtime support: Browser and Node.js.

## Python SDK

- Package: `sos_services_canvas`.
- Transport: `httpx` with sync and async clients.

## Java SDK

- Maven coordinates: `com.sos.canvas:services-canvas-sdk`.
- Transport: Java HTTP Client with pluggable interceptor chain.

## Go SDK

- Module path: `github.com/sos/services-canvas-sdk-go`.
- Context-aware API methods with retry and timeout options.

## Versioning and Compatibility

- Semantic versioning is mandatory.
- Backward compatibility maintained for two major versions minimum.
- Deprecations require:
  - announcement notes;
  - migration examples;
  - removal timeline.
