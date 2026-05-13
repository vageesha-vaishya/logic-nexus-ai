#!/usr/bin/env node
import fs from 'node:fs';

const openApiPath = './contracts/openapi/sos-services-canvas.openapi.yaml';
const asyncApiPath = './contracts/asyncapi/sos-services-canvas.asyncapi.yaml';

if (!fs.existsSync(openApiPath)) {
  console.error(`Missing OpenAPI contract: ${openApiPath}`);
  process.exit(1);
}

if (!fs.existsSync(asyncApiPath)) {
  console.error(`Missing AsyncAPI contract: ${asyncApiPath}`);
  process.exit(1);
}

const openApi = fs.readFileSync(openApiPath, 'utf8');
const asyncApi = fs.readFileSync(asyncApiPath, 'utf8');

if (!openApi.includes('openapi: 3.0')) {
  console.error('OpenAPI contract is missing required version header.');
  process.exit(1);
}

if (!asyncApi.includes('asyncapi:')) {
  console.error('AsyncAPI contract is missing required header.');
  process.exit(1);
}

console.log('Contract smoke check passed.');
