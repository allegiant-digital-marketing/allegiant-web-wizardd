#!/usr/bin/env node
/**
 * Schema validation harness.
 *
 * Validates the Kirchner A.R.C. extraction example against arc-extraction.schema.json
 * and the Kirchner intake form example against intake-form.schema.json.
 *
 * Run: node tests/schemas/validate.js
 *
 * Exits 0 if all schemas + examples are valid; exits 1 with detailed errors if anything fails.
 *
 * This script is what we run before committing any schema or example change. It is also
 * what the eventual CI pipeline will run on every push to keep the contract honest.
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'schemas');
const EXAMPLES_DIR = path.join(SCHEMAS_DIR, 'examples');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validations = [
  {
    schemaPath: path.join(SCHEMAS_DIR, 'arc-extraction.schema.json'),
    examplePath: path.join(EXAMPLES_DIR, 'kirchner-arc.example.json'),
    label: 'A.R.C. extraction · Kirchner Electric'
  },
  {
    schemaPath: path.join(SCHEMAS_DIR, 'intake-form.schema.json'),
    examplePath: path.join(EXAMPLES_DIR, 'kirchner-intake.example.json'),
    label: 'Intake form · Kirchner Electric'
  }
];

let allPassed = true;

console.log('\n┌────────────────────────────────────────────────────────────┐');
console.log('│  Web WIZARDD schema validation                              │');
console.log('└────────────────────────────────────────────────────────────┘\n');

for (const { schemaPath, examplePath, label } of validations) {
  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

    const validate = ajv.compile(schema);
    const valid = validate(example);

    if (valid) {
      console.log(`✓ PASS  ${label}`);
      console.log(`        schema:  ${path.relative(REPO_ROOT, schemaPath)}`);
      console.log(`        example: ${path.relative(REPO_ROOT, examplePath)}\n`);
    } else {
      allPassed = false;
      console.log(`✗ FAIL  ${label}`);
      console.log(`        schema:  ${path.relative(REPO_ROOT, schemaPath)}`);
      console.log(`        example: ${path.relative(REPO_ROOT, examplePath)}`);
      console.log(`        errors:`);
      for (const err of validate.errors) {
        console.log(`          · ${err.instancePath || '(root)'}  ${err.message}`);
        if (err.params && Object.keys(err.params).length) {
          console.log(`            params: ${JSON.stringify(err.params)}`);
        }
      }
      console.log();
    }
  } catch (e) {
    allPassed = false;
    console.log(`✗ ERROR ${label}`);
    console.log(`        ${e.message}\n`);
  }
}

if (allPassed) {
  console.log('All schemas + examples passed validation.\n');
  process.exit(0);
} else {
  console.log('One or more validations failed. Fix the schema or the example before committing.\n');
  process.exit(1);
}
