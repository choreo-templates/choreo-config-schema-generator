const core = require("@actions/core");
const yaml = require("js-yaml");
const path = require("path");
const fs = require("fs");

const jsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {},
  required: [],
};

function readComponentYaml(filePath) {
  try {
    fullPath = path.join(filePath, ".choreo", "component.yaml");
    let fileContent = fs.readFileSync(fullPath, "utf8");
    return fileContent;
  } catch (error) {
    throw new Error(`Failed to read component.yaml: ${error.message}`);
  }
}

function isBaseType(type) {
  return (
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    type === "secret" ||
    type === undefined
  );
}

function generateSchemaForBaseType(schema, requiredItems, type) {
  // if required is not set or set to true, add the item to required list
  if (schema.required === undefined || schema.required) {
    requiredItems.push(schema.name);
  }
  const generatedSchema = {
    type: type || "string",
  };
  if (schema.values) {
    generatedSchema.enum = schema.values;
  }
  if (schema.displayName) {
    generatedSchema.title = schema.displayName;
  }
  return generatedSchema;
}

function generateSchemaFromYaml(schema, requiredItems) {
  if (isBaseType(schema.type)) {
    return generateSchemaForBaseType(schema, requiredItems, schema.type);
  }

  if (schema.type === "array") {
    const generatedSchema = {
      type: "array",
      items: {},
      title: schema.displayName,
    };

    const required = [];
    if (schema.required === undefined || schema.required) {
      requiredItems.push(schema.name);
    }

    if (isBaseType(schema.items.type)) {
      generatedSchema.items.type = schema.items.type;
      return generatedSchema;
    }
    return {
      type: "array",
      items: generateSchemaFromYaml(schema.items, required),
      title: schema.displayName,
    };
  }

  if (schema.type === "object") {
    let properties = {};
    const required = [];
    if (schema.required === undefined || schema.required) {
      requiredItems.push(schema.name);
    }

    if (schema.properties) {
      schema.properties.forEach((property) => {
        properties[property.name] = generateSchemaFromYaml(property, required);
      });
    }
    return {
      type: "object",
      properties: properties,
      required: required,
      title: schema.displayName,
    };
  }

  if (schema.type === "oneOf") {
    const required = [];
    const generatedSchema = {
      anyOf: [], // Use anyOf instead of oneOf as ballerina generates anyOf for oneOf
      title: schema.displayName,
    };

    if (schema.required === undefined || schema.required) {
      requiredItems.push(schema.name);
    }

    if (schema.oneOf) {
      schema.oneOf.forEach((item) => {
        generatedSchema.anyOf.push(generateSchemaFromYaml(item, required));
      });
    }
    return generatedSchema;
  }

  if (schema.type === "map") {
    let objProperties = {
      type: "object",
      properties: {},
    };
    const required = [];
    const generatedSchema = {
      type: "object",
      additionalProperties: {},
      title: schema.displayName,
    };

    if (schema.required === undefined || schema.required) {
      requiredItems.push(schema.name);
    }

    if (schema.properties) {
      if (isBaseType(schema.properties.type)) {
        generatedSchema.additionalProperties.type = schema.properties.type;
        return generatedSchema;
      }

      if (schema.properties.type === "object") {
        if (Array.isArray(schema.properties.additionalProperties)) {
          schema.properties.additionalProperties.forEach((property) => {
            objProperties.properties[property.name] = generateSchemaFromYaml(
              property,
              required
            );
          });
        } else if (schema.properties.additionalProperties) {
          generatedSchema.additionalProperties = generateSchemaFromYaml(
            schema.properties.additionalProperties,
            required
          );
          return generatedSchema;
        }
      }

      if (schema.properties.type === "array") {
        generatedSchema.additionalProperties.type = "array";
        generatedSchema.additionalProperties.items = generateSchemaFromYaml(
          schema.properties.items,
          required
        );
        return generatedSchema;
      }
    }
    return {
      type: "object",
      additionalProperties: objProperties,
      required: required,
      title: schema.displayName,
    };
  }
}

function main() {
  try {
    const sourceRootDir = core.getInput("source-root-dir-path");
    const fileContent = readComponentYaml(sourceRootDir);
    componentYamlFile = yaml.load(fileContent);

    const schema = [];
    const configs = componentYamlFile.configurations ||
      componentYamlFile.configuration || {
        env: [],
        file: [],
      };

    if (configs.env) {
      configs.env.forEach((item) => {
        if (item.valueFrom?.configForm) {
          if (item.valueFrom?.configForm) {
            const envSchema = {
              name: item.name,
              type: item.valueFrom?.configForm?.type || "string",
              required: item.valueFrom?.configForm?.required,
              displayName: item.valueFrom?.configForm?.displayName,
            };
            if (item.valueFrom?.configForm?.oneOf) {
              envSchema.type = "oneOf";
            }
            schema.push(envSchema);
          }
        }
      });
    }

    if (configs.file) {
      configs.file.forEach((file) => {
        file?.values?.forEach((item) => {
          if (item.valueFrom?.configForm?.oneOf) {
            schema.push({
              name: item.name,
              type: "oneOf",
              ...item?.valueFrom?.configForm,
            });
          } else {
            schema.push({
              name: item.name,
              ...item?.valueFrom?.configForm,
            });
          }
        });
      });
    }

    if (schema.length === 0) {
      console.log("No configurations found in the component.yaml");
      return;
    }

    schema.forEach((item) => {
      jsonSchema.properties[item.name] = generateSchemaFromYaml(
        item,
        jsonSchema.required
      );
    });

    fs.writeFileSync(
      `${sourceRootDir}/choreo-config-schema.json`,
      JSON.stringify(jsonSchema, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.log("config schema generation failed: ", error.message);
    core.setFailed("config schema generation failed ", error.message);
  }
}

main();
