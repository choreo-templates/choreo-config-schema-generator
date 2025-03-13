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
  return type === "string" || type === "number" || type === "boolean" || type === "secret" || type === undefined;
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
    if (schema.required === undefined || schema.required ) {
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
    if (schema.required === undefined || schema.required ) {
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
}

function main() {
  try {
    const sourceRootDir = core.getInput("source-root-dir-path");
    const fileContent = readComponentYaml(sourceRootDir);
    componentYamlFile = yaml.load(fileContent);

    const schema = [];
    const configs = componentYamlFile.configurations || componentYamlFile.configuration || {
      env: [],
      file: [],
    };

    if (configs.env) {
      configs.env.forEach((item) => {
        if (item.valueFrom?.configForm) {
          schema.push({
            name: item.name,
            type: item.valueFrom?.configForm?.type || "string",
            required: item.valueFrom?.configForm?.required,
            displayName: item.valueFromConfigForm?.displayName,
          })
        }
      })
    }

    if (configs.file) {
      configs.file.forEach((file) => {
        file?.values?.forEach((item) => {
          schema.push({
            name: item.name,
            ...item?.valueFrom?.configForm,
          })
        })
      })
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
