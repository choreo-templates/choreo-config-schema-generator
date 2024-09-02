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

function readInput() {
  try {
    sourceRootDir = core.getInput("source-root-dir-path");
    return sourceRootDir;
  } catch (error) {
    throw new Error(`Failed to read input: ${error.message}`);
  }
}

function readComponentYaml(filePath) {
  try {
    fullPath = path.join(filePath, ".choreo", "component.yaml");
    let fileContent = fs.readFileSync(fullPath, "utf8");
    return fileContent;
  } catch (error) {
    throw new Error(`Failed to read component.yaml: ${error.message}`);
  }
}

function generateSchemaForBaseType(schema, requiredItems, type) {
      // if required is not set or set to true, add the item to required list
      if (schema.required === undefined || schema.required) {
        requiredItems.push(schema.name);
      }
      const generatedSchema = {
        type: type,
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
  if (schema.type === "string") {
    return generateSchemaForBaseType(schema, requiredItems, "string");
  }

  if (schema.type === "integer") {
    return generateSchemaForBaseType(schema, requiredItems, "integer");
  }

  if (schema.type === "array") {
    const generatedSchema = {
      type: "array",
      items: {
        type: "string",
      },
      title: schema.displayName,
    };
    if (schema.items.type === "string") {
      return generatedSchema;
    }
    if (schema.items.type === "integer") {
      generatedSchema.items.type = "integer";
      return generatedSchema;
    }
    return {
      type: "array",
      items: generateSchemaFromYaml(schema.items, requiredItems),
      title: schema.displayName,
    };
  }

  if (schema.type === "object") {
    let properties = {};
    let required = [];
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
    const sourceRootDir = readInput();
    const fileContent = readComponentYaml(sourceRootDir);
    componentYamlFile = yaml.load(fileContent);

    if (
      componentYamlFile.configurations &&
      componentYamlFile.configurations.schema
    ) {
      componentYamlFile.configurations.schema.forEach((item) => {
        jsonSchema.properties[item.name] = generateSchemaFromYaml(
          item,
          jsonSchema.required
        );
      });
    }

    fs.writeFileSync(
      `${sourceRootDir}/config-schema.json`,
      JSON.stringify(jsonSchema),
      "utf-8"
    );
  } catch (error) {
    console.log("config schema generation failed: ", error.message);
    core.setFailed("config schema generation failed ", error.message);
  }
}

main();
