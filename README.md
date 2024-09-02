# Choreo Config Schema Generator

This action validates the source configuration files of Choreo.

## Inputs

### `source-root-dir`

**Required** The path to the root directory of the source code.

## Outputs

### `config-schema.json`

The result of the validation

## Example usage

```yaml
build:
  steps:
    - name: Choreo Config Schema Generator
      uses: choreo-templates/choreo-config-schema-generator@v0.1.0
      with:
        source-root-dir-path: ${{source-root-dir-path}}
```
